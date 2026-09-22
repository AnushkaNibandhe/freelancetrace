"""
FreelanceTrace – Delay Risk Predictor
Estimates the probability that the remaining unfulfilled requirements will
be completed by the project deadline, based on observed commit velocity.

Algorithm
---------
1. Compute "effective velocity" = average FCS points gained per day over a
   rolling window of recent commits.
2. Estimate "work remaining" = total FCS deficit across all requirements.
3. Project completion date = today + (work_remaining / velocity).
4. Risk score = sigmoid of (projected_date - deadline) in days.
"""

import math
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)

VELOCITY_WINDOW_DAYS = 14
SIGMOID_K = 0.08


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _estimate_velocity(
    fcs_snapshots: List[dict],
    window_days: int = VELOCITY_WINDOW_DAYS,
) -> float:
    """
    Compute average daily FCS gain from a list of daily snapshots.
    fcs_snapshots : [{"date": datetime, "total_fcs": float}, ...] sorted chronologically.
    Returns FCS points per day (>= 0).
    """
    if len(fcs_snapshots) < 2:
        return 0.0

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=window_days)

    window = [s for s in fcs_snapshots if s["date"] >= cutoff]
    if len(window) < 2:
        window = fcs_snapshots[-2:]

    earliest = window[0]
    latest = window[-1]

    delta_fcs = latest["total_fcs"] - earliest["total_fcs"]
    delta_days = max((latest["date"] - earliest["date"]).total_seconds() / 86400, 0.01)

    return max(delta_fcs / delta_days, 0.0)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict_delay_risk(
    requirements: List[dict],
    fcs_snapshots: List[dict],
    deadline: datetime,
    milestone_label: str = "",
) -> dict:
    """
    Predict delay risk for a milestone or project.

    Parameters
    ----------
    requirements    : list of req dicts, each with 'fcs' float [0,1] and
                      optional 'priority' int (1=high).
    fcs_snapshots   : daily total-FCS history
    deadline        : target completion datetime (UTC)
    milestone_label : human-readable label

    Returns dict with: risk_score, risk_level, projected_completion,
                       days_remaining, days_overshoot, velocity_fcs_per_day,
                       work_remaining, milestone_label, message
    """
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    days_remaining = max((deadline - now).days, 0)

    work_remaining = 0.0
    for req in requirements:
        fcs = req.get("fcs", 0.0)
        deficit = max(1.0 - fcs, 0.0)
        priority_weight = {1: 1.5, 2: 1.0, 3: 0.6}.get(req.get("priority", 2), 1.0)
        work_remaining += deficit * priority_weight

    velocity = _estimate_velocity(fcs_snapshots)

    if velocity <= 0 or work_remaining <= 0:
        projected_days = 0 if work_remaining <= 0 else float("inf")
    else:
        projected_days = work_remaining / velocity

    projected_completion: Optional[datetime] = None
    days_overshoot = 0

    if projected_days == float("inf"):
        risk_score = 0.95 if work_remaining > 0 else 0.0
        projected_completion = None
    else:
        projected_completion = now + timedelta(days=projected_days)
        days_overshoot = int((projected_completion - deadline).days)
        risk_score = _sigmoid(days_overshoot * SIGMOID_K)

    if risk_score < 0.30:
        risk_level = "low"
    elif risk_score < 0.55:
        risk_level = "medium"
    elif risk_score < 0.75:
        risk_level = "high"
    else:
        risk_level = "critical"

    message = _build_message(risk_level, days_remaining, days_overshoot, velocity)

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "projected_completion": projected_completion.date().isoformat() if projected_completion else None,
        "days_remaining": days_remaining,
        "days_overshoot": days_overshoot,
        "velocity_fcs_per_day": round(velocity, 6),
        "work_remaining": round(work_remaining, 4),
        "milestone_label": milestone_label,
        "message": message,
    }


def _build_message(risk_level: str, days_remaining: int, days_overshoot: int, velocity: float) -> str:
    if velocity <= 0:
        return "No commit activity detected. Cannot estimate completion date."
    if risk_level == "low":
        return f"On track. {days_remaining} days to deadline with buffer of ~{abs(days_overshoot)} days."
    elif risk_level == "medium":
        return f"Moderate risk. Current velocity may result in a {days_overshoot}-day overshoot."
    elif risk_level == "high":
        return f"High risk. Projected to miss deadline by {days_overshoot} days. Increase commit frequency."
    else:
        return (
            f"CRITICAL: Estimated {days_overshoot}-day delay. "
            "Immediate attention required or milestone scope must be renegotiated."
        )
