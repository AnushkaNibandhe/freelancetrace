"""
services/vcs/traceability_engine.py
--------------------------------------
Central orchestrator for the FreelanceTrace NLP pipeline.

Responsibilities:
  1. Register parsed requirements (with embeddings) against a project.
  2. Ingest incoming commits: embed, deduplicate, create TraceLinks above threshold.
  3. Recalculate and persist all five NLP metrics after each ingest batch.
"""
from __future__ import annotations

import datetime
import json
import os
from typing import TYPE_CHECKING

from services.nlp.embedding_service import (
    encode,
    cosine_similarity,
)

if TYPE_CHECKING:
    from services.vcs.webhook_handler import CommitData

# Configurable thresholds (override via .env)
LINK_THRESHOLD: float = float(os.getenv("LINK_THRESHOLD", "0.40"))


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def register_requirements(project_id: int, requirements: list[dict], db) -> None:
    """
    Persist a list of parsed requirement dicts to the database.
    Each dict should have at least 'text', 'priority', 'order_index'.
    Embeddings ('embedding' key) are serialised to JSON for storage.

    Deletes any existing requirements for the project first (re-parse on SRS re-upload).
    """
    import models  # local import to avoid circular deps at module level

    # Remove old requirements (cascades to trace_links via ORM)
    db.query(models.Requirement).filter(
        models.Requirement.project_id == project_id
    ).delete()
    db.commit()

    for req in requirements:
        text = req.get("text") or ""
        embedding = req.get("embedding") or encode(text)
        db.add(models.Requirement(
            project_id=project_id,
            requirement_text=text,
            priority=req.get("priority", "medium"),
            status="not_started",
            order_index=req.get("order_index", 0),
            embedding_vector=json.dumps(embedding) if embedding else None,
        ))
    db.commit()
    print(f"[traceability_engine] Registered {len(requirements)} requirements for project {project_id}")


def ingest_commits(commits: list["CommitData"], project_id: int, db) -> list:
    """
    Process a batch of CommitData objects:
      1. Skip duplicates (same commit_hash already in DB).
      2. Embed the commit message.
      3. Run cosine similarity against all project requirements.
      4. Persist TraceLink rows for pairs above LINK_THRESHOLD.

    Returns a list of newly created TraceLink ORM objects.
    """
    import models  # local import

    requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.project_id == project_id)
        .all()
    )

    # Pre-load requirement embeddings (deserialise once per batch)
    req_embeddings: list[list[float]] = []
    for req in requirements:
        if req.embedding_vector:
            try:
                req_embeddings.append(json.loads(req.embedding_vector))
            except (json.JSONDecodeError, TypeError):
                req_embeddings.append(encode(req.requirement_text))
        else:
            vec = encode(req.requirement_text)
            req.embedding_vector = json.dumps(vec) if vec else None
            req_embeddings.append(vec)
    db.commit()

    new_links: list = []

    for commit_data in commits:
        # Deduplication
        existing = (
            db.query(models.Commit)
            .filter(models.Commit.commit_hash == commit_data.hash)
            .first()
        )
        if existing:
            continue

        # Encode commit (message + file list for richer context)
        commit_context = commit_data.message
        if commit_data.all_files:
            file_hints = " ".join(commit_data.all_files[:20])   # cap to 20 files
            commit_context = f"{commit_data.message} {file_hints}"

        commit_vec = encode(commit_context)

        db_commit = models.Commit(
            project_id=project_id,
            commit_hash=commit_data.hash,
            message=commit_data.message,
            author=commit_data.author,
            timestamp=commit_data.timestamp or _utcnow(),
            files_changed=json.dumps(commit_data.as_dict()),
            embedding_vector=json.dumps(commit_vec) if commit_vec else None,
        )
        db.add(db_commit)
        db.commit()
        db.refresh(db_commit)

        # Match against all requirements
        for req, req_vec in zip(requirements, req_embeddings):
            sim = cosine_similarity(req_vec, commit_vec) if (req_vec and commit_vec) else 0.0

            if sim < LINK_THRESHOLD:
                continue

            confidence = (
                "high" if sim > 0.70
                else ("medium" if sim > 0.55 else "low")
            )
            link = models.TraceLink(
                requirement_id=req.id,
                commit_id=db_commit.id,
                similarity_score=round(sim, 4),
                confidence_level=confidence,
            )
            db.add(link)
            new_links.append(link)

            # Update requirement status
            if sim > 0.80:
                req.status = "fulfilled"
                req.last_commit_at = db_commit.timestamp
            elif req.status == "not_started" and sim > 0.55:
                req.status = "in_progress"
                req.last_commit_at = db_commit.timestamp

        db.commit()

    print(f"[traceability_engine] Ingested {len(commits)} commits → {len(new_links)} new trace links (project {project_id})")
    return new_links


def recalculate_metrics(project_id: int, db) -> dict:
    """
    Recompute all five NLP metrics for a project and persist them
    to the Metrics table. Returns a dict suitable for API responses.
    """
    import models

    requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.project_id == project_id)
        .all()
    )
    project = db.query(models.Project).filter(models.Project.id == project_id).first()

    total_reqs = len(requirements)
    fulfilled_reqs = sum(1 for r in requirements if r.status == "fulfilled")
    in_progress_reqs = sum(1 for r in requirements if r.status == "in_progress")

    # Collect all trace links for this project
    all_links: list = []
    req_ids_with_links: set = set()
    for req in requirements:
        links = (
            db.query(models.TraceLink)
            .filter(models.TraceLink.requirement_id == req.id)
            .all()
        )
        all_links.extend(links)
        if links:
            req_ids_with_links.add(req.id)

    # ── Fulfillment score: % of requirements fulfilled ────────────────────────
    fulfillment_pct = round((fulfilled_reqs / total_reqs * 100.0) if total_reqs else 0.0, 1)

    # ── Drift score: deviation from perfect similarity (0 = no drift) ─────────
    if all_links:
        avg_sim = sum(lnk.similarity_score for lnk in all_links) / len(all_links)
        drift_score = round(max(0.0, (1.0 - avg_sim) * 100), 1)
    else:
        drift_score = 0.0

    # ── Delay risk: simple heuristic based on fulfillment vs timeline ─────────
    start = (project.start_date if project else None) or _utcnow()
    deadline = (project.deadline if project else None) or (start + datetime.timedelta(days=30))

    def _aware(dt: datetime.datetime) -> datetime.datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.timezone.utc)
        return dt

    start = _aware(start)
    deadline = _aware(deadline)
    now = _utcnow()

    total_days = max((deadline - start).days, 1)
    elapsed_days = max((now - start).days, 0)
    elapsed_pct = min(elapsed_days / total_days, 1.0)
    fulfillment_ratio = fulfilled_reqs / total_reqs if total_reqs else 0.0
    # Risk = how far behind schedule we are (0 = on track, 100 = fully behind)
    delay_risk = round(max(0.0, (elapsed_pct - fulfillment_ratio) * 100), 1)

    # ── Compliance: % of requirements with at least one trace link ────────────
    compliance_pct = round(
        (len(req_ids_with_links) / total_reqs * 100.0) if total_reqs else 0.0, 1
    )

    # ── Trust score: composite of fulfillment, compliance, low drift ──────────
    trust_score = round(
        (fulfillment_pct * 0.4 + compliance_pct * 0.4 + max(0.0, 100 - drift_score) * 0.2),
        1
    )

    # Persist / update Metrics row
    metrics = (
        db.query(models.Metrics)
        .filter(models.Metrics.project_id == project_id)
        .first()
    )
    if not metrics:
        metrics = models.Metrics(project_id=project_id)
        db.add(metrics)
        db.commit()
        db.refresh(metrics)

    metrics.fulfillment_score = fulfillment_pct
    metrics.drift_score = drift_score
    metrics.delay_risk = delay_risk
    metrics.trust_score = trust_score
    metrics.compliance_score = compliance_pct
    db.commit()

    result = {
        "project_id": project_id,
        "fulfillment_score": fulfillment_pct,
        "drift_score": drift_score,
        "delay_risk": delay_risk,
        "trust_score": trust_score,
        "compliance_score": compliance_pct,
    }
    print(f"[traceability_engine] Metrics updated for project {project_id}: {result}")
    return result
