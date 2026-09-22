from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    domain: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    duration_days: Optional[int] = None
    status: Optional[str] = "open"
    visibility: Optional[str] = "public"
    srs_file_url: Optional[str] = None
    github_repo: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int
    client_id: int
    awarded_freelancer_id: Optional[int] = None
    awarded_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequirementBase(BaseModel):
    requirement_text: str
    requirement_type: Optional[str] = "FR"
    section_name: Optional[str] = "General"
    priority: Optional[str] = "medium"
    status: Optional[str] = "not_started"
    coverage_percentage: Optional[float] = 0.0
    last_commit_at: Optional[datetime] = None
    order_index: Optional[int] = 0


class RequirementCreate(RequirementBase):
    pass


class Requirement(RequirementBase):
    id: int
    project_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MetricsBase(BaseModel):
    fulfillment_score: float = 0.0
    drift_score: float = 0.0
    delay_risk: float = 0.0
    trust_score: float = 0.0
    compliance_score: float = 0.0


class Metrics(MetricsBase):
    id: int = Field(default=0)
    project_id: int

    class Config:
        from_attributes = True
