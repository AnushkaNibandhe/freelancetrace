"""
FreelanceTrace – Freelancer Trust Score
Computes an evidence-based, engineering-grounded trust score for a freelancer
by aggregating signals across multiple completed or in-progress projects.

Score components (configurable weights, must sum to 1.0)
---------------------------------------------------------
fulfillment_rate  -- fraction of milestones where avg FCS >= threshold
drift_rate        -- penalises high-severity drift alerts (inverted)
responsiveness    -- how quickly the developer responds to feedback issues
on_time_rate      -- fraction of milestones delivered before deadline
compliance_score  -- average compliance/audit readiness score

Final score is in [0, 100] for display.  Internally we work in [0, 1].
"""

import logging
import math
from typing import List, Optional

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "fulfillment_rate": 0.35,
    "drift_penalty": 0.20,
    "responsiveness": 0.20,
    "on_time_rate": 0.15,
    "compliance_score": 0.10,
}

FULFILLMENT_THRESHOLD = 0.60
DRIFT_HIGH_PENALTY = 0.10
DRIFT_MEDIUM_PENALTY = 0.03


# ---------------------------------------------------------------------------
# Sub-score calculators
# ---------------------------------------------------------------------------

def _fulfillment_rate(milestone_fcs_list: List[float]) -> float:
    if not milestone_fcs_list:
        return 0.5
    fulfilled = sum(1 for f in milestone_fcs_list if f >= FULFILLMENT_THRESHOLD)
    return fulfilled / len(milestone_fcs_list)


def _drift_score(drift_alerts: List[dict]) -> float:
    penalty = 0.0
    for alert in drift_alerts:
        sev = alert.get("severity", "low")
        if sev == "high":
            penalty += DRIFT_HIGH_PENALTY
        elif sev == "medium":
            penalty += DRIFT_MEDIUM_PENALTY
        else:
            penalty += 0.005
    return max(0.0, 1.0 - penalty)


def _responsiveness_score(feedback_response_hours: List[float]) -> float:
    if not feedback_response_hours:
        return 0.5
    avg_hours = sum(feedback_response_hours) / len(feedback_response_hours)
    if avg_hours <= 4:
        return 1.0
    elif avg_hours <= 24:
        return 1.0 - (avg_hours - 4) / 20 * 0.5
    elif avg_hours <= 72:
        return 0.5 - (avg_hours - 24) / 48 * 0.5
    return 0.0


def _on_time_rate(on_time_flags: List[bool]) -> float:
    if not on_time_flags:
        return 0.5
    return sum(on_time_flags) / len(on_time_flags)


def _compliance_avg(compliance_scores: List[float]) -> float:
    if not compliance_scores:
        return 0.5
    return sum(compliance_scores) / len(compliance_scores)


def _confidence_factor(num_projects: int) -> float:
    return 1.0 / (1.0 + math.exp(-(num_projects - 3)))


# ---------------------------------------------------------------------------
# Main calculation
# ---------------------------------------------------------------------------

def calculate_trust_score(
    freelancer_id: str,
    project_data: List[dict],
    weights: Optional[dict] = None,
) -> dict:
    """
    Calculate the Freelancer Trust Score.

    Parameters
    ----------
    freelancer_id : str
    project_data  : list of project dicts, each containing:
        milestone_fcs_list       : List[float]
        drift_alerts             : List[dict]  -- {"severity": ...}
        feedback_response_hours  : List[float]
        on_time_flags            : List[bool]
        compliance_scores        : List[float]
    weights : optional override of DEFAULT_WEIGHTS

    Returns dict with: trust_score (0-100), trust_level, sub_scores,
                       num_projects, confidence_factor, badge
    """
    w = {**DEFAULT_WEIGHTS, **(weights or {})}

    all_fcs = [f for p in project_data for f in p.get("milestone_fcs_list", [])]
    all_drifts = [a for p in project_data for a in p.get("drift_alerts", [])]
    all_response_h = [h for p in project_data for h in p.get("feedback_response_hours", [])]
    all_on_time = [f for p in project_data for f in p.get("on_time_flags", [])]
    all_compliance = [c for p in project_data for c in p.get("compliance_scores", [])]

    num_projects = len(project_data)

    sub_scores = {
        "fulfillment_rate": _fulfillment_rate(all_fcs),
        "drift_score": _drift_score(all_drifts),
        "responsiveness": _responsiveness_score(all_response_h),
        "on_time_rate": _on_time_rate(all_on_time),
        "compliance_avg": _compliance_avg(all_compliance),
    }

    raw_score = (
        w["fulfillment_rate"] * sub_scores["fulfillment_rate"]
        + w["drift_penalty"] * sub_scores["drift_score"]
        + w["responsiveness"] * sub_scores["responsiveness"]
        + w["on_time_rate"] * sub_scores["on_time_rate"]
        + w["compliance_score"] * sub_scores["compliance_avg"]
    )

    cf = _confidence_factor(num_projects)
    adjusted_score = 0.5 + cf * (raw_score - 0.5)
    trust_score_int = int(round(adjusted_score * 100))

    if trust_score_int < 40 or num_projects < 1:
        trust_level = "new"
    elif trust_score_int < 60:
        trust_level = "developing"
    elif trust_score_int < 80:
        trust_level = "established"
    else:
        trust_level = "expert"

    badge = ""
    if trust_level == "expert" and sub_scores["drift_score"] >= 0.90:
        badge = "Engineering-Verified"
    elif trust_level in ("established", "expert"):
        badge = "Trusted Contributor"

    return {
        "freelancer_id": freelancer_id,
        "trust_score": trust_score_int,
        "trust_level": trust_level,
        "sub_scores": {k: round(v, 4) for k, v in sub_scores.items()},
        "num_projects": num_projects,
        "confidence_factor": round(cf, 4),
        "badge": badge,
    }
