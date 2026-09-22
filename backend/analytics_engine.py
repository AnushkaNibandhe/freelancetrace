import datetime

def compute_fulfillment_score(total_requirements: int, fulfilled_requirements: int) -> float:
    """
    Fulfillment Confidence Score
    Measures requirement completion.
    Formula: fulfilled_requirements / total_requirements (Weighted by commit coverage typically, but here simplified)
    """
    if total_requirements == 0:
        return 0.0
    return min(100.0, (fulfilled_requirements / total_requirements) * 100.0)


def detect_requirement_drift(trace_links: list) -> float:
    """
    Requirement Drift Detection
    Compares requirement text vs commit semantics.
    If similarity falls below threshold, it indicates drift.
    Returns a drift score from 0 to 100 (higher means more drift).
    """
    if not trace_links:
        return 0.0
    
    # Example logic: count how many links have low similarity
    drift_count = sum(1 for link in trace_links if link.similarity_score < 0.65)
    return min(100.0, (drift_count / len(trace_links)) * 100.0)


from typing import Optional

def predict_delay_risk(total_requirements: int, fulfilled_requirements: int, project_start: datetime.datetime, 
                       project_deadline: datetime.datetime, current_time: Optional[datetime.datetime] = None) -> float:
    """
    Delay Risk Prediction
    Estimate risk based on: commit velocity, remaining requirements, deadline proximity.
    Returns 0 to 100 risk score.
    """
    if current_time is None:
        current_time = datetime.datetime.now(datetime.timezone.utc)
        
    if total_requirements == 0 or project_deadline <= project_start:
        return 0.0
        
    total_duration = (project_deadline - project_start).total_seconds()
    elapsed = (current_time - project_start).total_seconds()
    
    if elapsed <= 0:
        return 0.0
        
    time_progress = min(1.0, elapsed / total_duration)
    work_progress = fulfilled_requirements / total_requirements
    
    # If time progress is much higher than work progress, high risk.
    if time_progress > work_progress:
        risk = (time_progress - work_progress) * 100.0
        # amplify risk as deadline approaches
        risk_multiplier = 1.0 + (time_progress * 0.5) 
        return min(100.0, risk * risk_multiplier)
    
    return 0.0


def compute_trust_score(fulfilled_requirements: int, total_requirements: int, drift_score: float) -> float:
    """
    Freelancer Trust Score
    Compute developer reliability based on fulfilled requirements, drift frequency, etc.
    0 to 100 score.
    """
    # Base trust starts at 50, improves with fulfillment, drops with drift
    base_trust = 50.0
    
    fulfillment_bonus = 0.0
    if total_requirements > 0:
        fulfillment_bonus = (fulfilled_requirements / total_requirements) * 50.0
        
    drift_penalty = drift_score * 0.5 # Up to 50 penalty points
    
    trust = base_trust + fulfillment_bonus - drift_penalty
    return max(0.0, min(100.0, trust))


def compute_compliance_readiness(total_requirements: int, requirements_with_links: int) -> float:
    """
    Compliance Readiness
    Check completeness of traceability links and documentation.
    Percentage of requirements explicitly linked to at least one commit.
    """
    if total_requirements == 0:
        return 0.0
    return min(100.0, (requirements_with_links / total_requirements) * 100.0)
