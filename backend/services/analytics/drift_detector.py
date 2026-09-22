"""
FreelanceTrace – Requirement Drift Detector
Detects when the semantic content of recent commits diverges from the original
SRS requirements, signalling that development is drifting off-spec.

Two complementary signals are combined:
  1. Cosine similarity drop  -- avg similarity of the last N commits vs baseline
  2. Keyword erosion         -- fraction of requirement keywords still appearing
                               in recent commit messages

A DriftAlert is raised when either signal crosses its threshold.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

import numpy as np

from services.nlp.embedding_service import cosine_similarity, decode_from_json
from services.nlp.keyword_extractor import keyword_overlap_score

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = {
    "similarity_threshold": 0.38,
    "keyword_threshold": 0.20,
    "window_size": 10,
    "baseline_window": 5,
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class DriftAlert:
    req_id: str
    req_text: str
    drift_type: str          # "similarity" | "keyword_erosion" | "both"
    severity: str            # "low" | "medium" | "high"
    baseline_similarity: float
    current_similarity: float
    keyword_overlap: float
    recent_commit_shas: List[str] = field(default_factory=list)
    detected_at: datetime = field(default_factory=datetime.utcnow)
    message: str = ""

    def to_dict(self) -> dict:
        return {
            "req_id": self.req_id,
            "req_text": self.req_text[:120] + ("..." if len(self.req_text) > 120 else ""),
            "drift_type": self.drift_type,
            "severity": self.severity,
            "baseline_similarity": round(self.baseline_similarity, 4),
            "current_similarity": round(self.current_similarity, 4),
            "keyword_overlap": round(self.keyword_overlap, 4),
            "recent_commit_shas": self.recent_commit_shas,
            "detected_at": self.detected_at.isoformat(),
            "message": self.message,
        }


# ---------------------------------------------------------------------------
# Drift detection logic
# ---------------------------------------------------------------------------

def _severity(drop: float) -> str:
    if drop >= 0.20:
        return "high"
    elif drop >= 0.10:
        return "medium"
    return "low"


def detect_drift_for_requirement(
    req: dict,
    commit_history: List[dict],
    config: Optional[dict] = None,
) -> Optional[DriftAlert]:
    """
    Analyse a single requirement against its linked commit history.

    Parameters
    ----------
    req            : dict with keys: req_id, text, keywords, embedding_json
    commit_history : list of commit dicts in chronological order, each with:
                     sha, message, embedding_json, committed_at
    config         : optional overrides for DEFAULT_CONFIG

    Returns DriftAlert if drift detected, else None.
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if not commit_history:
        return None

    req_vec = decode_from_json(req["embedding_json"])

    similarities = [
        cosine_similarity(req_vec, decode_from_json(c["embedding_json"]))
        for c in commit_history
    ]

    baseline_window = min(cfg["baseline_window"], len(similarities))
    baseline_sim = float(np.mean(similarities[:baseline_window]))

    recent = commit_history[-cfg["window_size"]:]
    recent_sims = similarities[-cfg["window_size"]:]
    current_sim = float(np.mean(recent_sims))

    combined_recent_messages = " ".join(c["message"] for c in recent)
    kw_overlap = keyword_overlap_score(req.get("keywords", ""), combined_recent_messages)

    sim_drifted = current_sim < cfg["similarity_threshold"]
    kw_eroded = kw_overlap < cfg["keyword_threshold"]

    if not sim_drifted and not kw_eroded:
        return None

    if sim_drifted and kw_eroded:
        drift_type = "both"
    elif sim_drifted:
        drift_type = "similarity"
    else:
        drift_type = "keyword_erosion"

    drop = max(baseline_sim - current_sim, 0.0)
    severity = _severity(drop)

    alert = DriftAlert(
        req_id=req["req_id"],
        req_text=req["text"],
        drift_type=drift_type,
        severity=severity,
        baseline_similarity=baseline_sim,
        current_similarity=current_sim,
        keyword_overlap=kw_overlap,
        recent_commit_shas=[c["sha"] for c in recent],
        message=(
            f"Requirement may be drifting ({drift_type}). "
            f"Similarity dropped from {baseline_sim:.2f} to {current_sim:.2f}. "
            f"Keyword overlap: {kw_overlap:.0%}."
        ),
    )
    logger.warning("Drift detected: req=%s severity=%s", req["req_id"], severity)
    return alert


def detect_drift_for_project(
    requirements: List[dict],
    commit_history_by_req: dict,
    config: Optional[dict] = None,
) -> List[DriftAlert]:
    """
    Run drift detection across all requirements for a project.

    Parameters
    ----------
    requirements          : list of requirement dicts
    commit_history_by_req : {req_id: [commit_dict, ...]}
    config                : optional per-project config overrides

    Returns list of DriftAlert objects (empty if no drift).
    """
    alerts: List[DriftAlert] = []
    for req in requirements:
        history = commit_history_by_req.get(req["req_id"], [])
        alert = detect_drift_for_requirement(req, history, config)
        if alert:
            alerts.append(alert)
    alerts.sort(key=lambda a: ["high", "medium", "low"].index(a.severity))
    return alerts
