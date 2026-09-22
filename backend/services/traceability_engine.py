"""
FreelanceTrace – Traceability Engine
The central orchestrator that:
  1. Ingests new commits from the VCS webhook.
  2. Embeds commit messages via the embedding service.
  3. Matches each commit to SRS requirements using cosine similarity.
  4. Persists trace links to the database.
  5. Triggers fulfillment and drift recalculation.

This module is the glue between the NLP services and the database models.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from services.nlp.embedding_service import (
    embed_commit,
    decode_from_json,
    top_k_similar,
)
from services.analytics.fulfillment import calculate_fcs
from services.analytics.drift_detector import detect_drift_for_requirement

logger = logging.getLogger(__name__)

# Minimum cosine similarity for a commit to be considered linked to a requirement
LINK_THRESHOLD = 0.40

# How many requirements a single commit can be linked to at most
MAX_LINKS_PER_COMMIT = 4


# ---------------------------------------------------------------------------
# In-memory store (replace with SQLAlchemy calls in production)
# ---------------------------------------------------------------------------
# In production, import from database and models:
#   from database import SessionLocal
#   from models import Requirement, Commit, TraceLink

_requirements_store: dict = {}
_commits_store: dict = {}
_trace_links_store: dict = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def register_requirements(project_id: str, requirements: List[dict], db=None) -> None:
    """
    Store a project's requirements (after SRS parsing + embedding).
    Each req dict must have: req_id, text, embedding_json, keywords.
    """
    _requirements_store[project_id] = requirements
    logger.info("Registered %d requirements for project %s", len(requirements), project_id)


def ingest_commits(commits: List[dict], project_id: str) -> List[dict]:
    """
    Process a batch of new commits:
      - Embed each commit message (+ file paths for richer context).
      - Match to requirements via cosine similarity.
      - Persist trace links.
      - Return list of newly created link dicts.

    commits : list of dicts from webhook_handler (must have sha, message, files_changed)
    """
    requirements = _requirements_store.get(project_id, [])
    if not requirements:
        logger.warning("No requirements found for project %s -- skipping tracing", project_id)
        return []

    req_ids = [r["req_id"] for r in requirements]
    req_vecs = [decode_from_json(r["embedding_json"]) for r in requirements]

    new_links: List[dict] = []

    for commit in commits:
        commit_vec = embed_commit(
            commit["message"],
            file_paths=commit.get("files_changed", []),
        )
        commit["embedding_json"] = json.dumps(commit_vec.tolist())

        matches = top_k_similar(
            commit_vec, req_vecs, req_ids,
            k=MAX_LINKS_PER_COMMIT,
            threshold=LINK_THRESHOLD,
        )

        for match in matches:
            link = {
                "link_id": f"{commit['sha'][:8]}-{match['id'][:8]}",
                "project_id": project_id,
                "req_id": match["id"],
                "commit_sha": commit["sha"],
                "similarity": match["score"],
                "committed_at": commit.get("committed_at", datetime.now(timezone.utc)),
                "lines_changed": commit.get("lines_changed", 0),
                "auto_linked": True,
            }
            new_links.append(link)
            logger.debug(
                "Linked commit %s -> req %s (similarity=%.3f)",
                commit["sha"][:8], match["id"][:8], match["score"],
            )

    _commits_store.setdefault(project_id, []).extend(commits)
    _trace_links_store.setdefault(project_id, []).extend(new_links)

    logger.info(
        "Ingested %d commits -> %d new trace links for project %s",
        len(commits), len(new_links), project_id,
    )
    return new_links


def get_traceability_matrix(project_id: str) -> dict:
    """
    Return the full traceability matrix for a project.

    Returns dict with: requirements (without embedding vectors),
                       trace_links, summary (totals + coverage_pct)
    """
    requirements = _requirements_store.get(project_id, [])
    links = _trace_links_store.get(project_id, [])

    linked_req_ids = {lnk["req_id"] for lnk in links}

    clean_reqs = [
        {k: v for k, v in r.items() if k != "embedding_json"}
        for r in requirements
    ]

    total = len(requirements)
    linked = len(linked_req_ids)

    return {
        "requirements": clean_reqs,
        "trace_links": links,
        "summary": {
            "total_reqs": total,
            "linked_reqs": linked,
            "unlinked_reqs": total - linked,
            "coverage_pct": round(linked / total * 100, 1) if total else 0.0,
        },
    }


def recalculate_metrics(project_id: str, milestone_due: Optional[datetime] = None) -> dict:
    """
    Recompute FCS and drift for every requirement in the project.
    Called after each batch of commits is ingested.

    Returns dict of {req_id: {"fcs_result": ..., "drift_alert": ...}}
    """
    requirements = _requirements_store.get(project_id, [])
    all_links = _trace_links_store.get(project_id, [])
    all_commits = _commits_store.get(project_id, [])

    links_by_req: dict = {}
    for lnk in all_links:
        links_by_req.setdefault(lnk["req_id"], []).append(lnk)

    commits_by_req: dict = {}
    for lnk in all_links:
        sha = lnk["commit_sha"]
        commit = next((c for c in all_commits if c["sha"] == sha), None)
        if commit:
            commits_by_req.setdefault(lnk["req_id"], []).append(commit)

    results = {}
    for req in requirements:
        req_links = links_by_req.get(req["req_id"], [])
        req_commits = commits_by_req.get(req["req_id"], [])

        fcs_result = calculate_fcs(req_links, milestone_due=milestone_due)
        req["fcs"] = fcs_result["fcs"]

        drift_alert = None
        if req.get("embedding_json") and req_commits:
            drift_alert = detect_drift_for_requirement(req, req_commits)

        results[req["req_id"]] = {
            "fcs_result": fcs_result,
            "drift_alert": drift_alert.to_dict() if drift_alert else None,
        }

    return results
