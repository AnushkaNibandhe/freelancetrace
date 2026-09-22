"""
FreelanceTrace – Fulfillment Calculator
Computes the multi-dimensional Fulfillment Confidence Score (FCS) for each
requirement by combining three sub-scores:

    FCS = w1 * commit_coverage  +  w2 * impl_depth  +  w3 * schedule_alignment

Weights default to (0.5, 0.3, 0.2) but are configurable per project.

Sub-score definitions
---------------------
commit_coverage    -- breadth: fraction of committed files touching this req,
                      weighted by semantic similarity of each commit to the req.
impl_depth         -- depth: log-scaled total lines changed across all
                      linked commits, normalised to [0, 1].
schedule_alignment -- recency: how close the most recent linked commit is to
                      the planned milestone date; 1.0 if on-time or early.
"""

import math
import logging
from datetime import datetime, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "commit_coverage": 0.50,
    "impl_depth": 0.30,
    "schedule_alignment": 0.20,
}

_IMPL_DEPTH_CEILING = 500


# ---------------------------------------------------------------------------
# Sub-score helpers
# ---------------------------------------------------------------------------

def _commit_coverage_score(trace_links: List[dict]) -> float:
    if not trace_links:
        return 0.0
    total_weight = sum(max(link["similarity"], 0.0) for link in trace_links)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(link["similarity"] * link["similarity"] for link in trace_links)
    return min(weighted_sum / total_weight, 1.0)


def _impl_depth_score(trace_links: List[dict]) -> float:
    total_lines = sum(link.get("lines_changed", 0) for link in trace_links)
    if total_lines <= 0:
        return 0.0
    normalised = math.log1p(total_lines) / math.log1p(_IMPL_DEPTH_CEILING)
    return min(normalised, 1.0)


def _schedule_alignment_score(
    trace_links: List[dict],
    milestone_due: Optional[datetime],
) -> float:
    if not milestone_due or not trace_links:
        return 0.5

    timestamps = [
        link.get("committed_at")
        for link in trace_links
        if link.get("committed_at")
    ]
    if not timestamps:
        return 0.5

    latest: datetime = max(timestamps)

    if milestone_due.tzinfo is None:
        milestone_due = milestone_due.replace(tzinfo=timezone.utc)
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)

    delta_days = (latest - milestone_due).days

    if delta_days <= 0:
        return 1.0
    elif delta_days <= 7:
        return 1.0 - (delta_days / 14)
    elif delta_days <= 30:
        return 0.5 - ((delta_days - 7) / 46)
    return 0.0


# ---------------------------------------------------------------------------
# Main FCS calculation
# ---------------------------------------------------------------------------

def calculate_fcs(
    trace_links: List[dict],
    milestone_due: Optional[datetime] = None,
    weights: Optional[dict] = None,
) -> dict:
    """
    Calculate the Fulfillment Confidence Score for a single requirement.

    Parameters
    ----------
    trace_links  : list of dicts with keys: similarity (float), lines_changed (int),
                   committed_at (datetime UTC)
    milestone_due: planned completion date for the enclosing milestone
    weights      : override DEFAULT_WEIGHTS

    Returns dict with: fcs, commit_coverage, impl_depth, schedule_alignment,
                       linked_commit_count
    """
    w = {**DEFAULT_WEIGHTS, **(weights or {})}

    cc = _commit_coverage_score(trace_links)
    id_ = _impl_depth_score(trace_links)
    sa = _schedule_alignment_score(trace_links, milestone_due)

    fcs = w["commit_coverage"] * cc + w["impl_depth"] * id_ + w["schedule_alignment"] * sa

    return {
        "fcs": round(fcs, 4),
        "commit_coverage": round(cc, 4),
        "impl_depth": round(id_, 4),
        "schedule_alignment": round(sa, 4),
        "linked_commit_count": len(trace_links),
    }


def calculate_project_fulfillment(req_scores: List[dict]) -> dict:
    """
    Aggregate per-requirement FCS into a project-level fulfillment summary.
    req_scores : list of dicts from calculate_fcs(), each with optional 'priority' (1/2/3).
    """
    if not req_scores:
        return {"overall_fcs": 0.0, "high_priority_fcs": 0.0,
                "coverage_pct": 0.0, "at_risk_count": 0}

    all_fcs = [r["fcs"] for r in req_scores]
    high_fcs = [r["fcs"] for r in req_scores if r.get("priority", 2) == 1]

    covered = sum(1 for f in all_fcs if f >= 0.5)
    at_risk = sum(1 for r in req_scores if r["fcs"] < 0.3 and r.get("priority", 2) == 1)

    return {
        "overall_fcs": round(sum(all_fcs) / len(all_fcs), 4),
        "high_priority_fcs": round(sum(high_fcs) / len(high_fcs), 4) if high_fcs else 0.0,
        "coverage_pct": round(covered / len(all_fcs) * 100, 1),
        "at_risk_count": at_risk,
    }
