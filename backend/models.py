from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="client")

    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    organization_name = Column(String, nullable=True)
    skills = Column(Text, nullable=True)
    tech_stack = Column(Text, nullable=True)
    github_username = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    github_access_token = Column(Text, nullable=True)
    github_token_type = Column(String, nullable=True)
    github_token_scope = Column(String, nullable=True)

    total_earnings = Column(Float, default=0.0)
    total_spent = Column(Float, default=0.0)
    trust_score = Column(Float, default=50.0)
    projects_completed = Column(Integer, default=0)
    dispute_rate = Column(Float, default=0.0)
    is_verified = Column(Boolean, default=False)
    is_suspended = Column(Boolean, default=False)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    client_projects = relationship(
        "Project",
        back_populates="client",
        foreign_keys="Project.client_id",
    )
    freelancer_projects = relationship(
        "Project",
        back_populates="freelancer",
        foreign_keys="Project.awarded_freelancer_id",
    )
    bids = relationship("Bid", back_populates="freelancer")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    domain = Column(String, nullable=True)
    tech_stack = Column(Text, nullable=True)
    budget_min = Column(Integer, nullable=True)
    budget_max = Column(Integer, nullable=True)
    duration_days = Column(Integer, nullable=True)
    status = Column(String, default="open")
    visibility = Column(String, default="public")
    srs_file_url = Column(Text, nullable=True)
    srs_parsed_at = Column(DateTime, nullable=True)
    github_repo = Column(String, nullable=True)
    start_date = Column(DateTime, default=utcnow)
    deadline = Column(DateTime, nullable=True)
    awarded_freelancer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    awarded_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    client = relationship(
        "User",
        back_populates="client_projects",
        foreign_keys=[client_id],
    )
    freelancer = relationship(
        "User",
        back_populates="freelancer_projects",
        foreign_keys=[awarded_freelancer_id],
    )
    requirements = relationship("Requirement", back_populates="project", cascade="all, delete-orphan")
    commits = relationship("Commit", back_populates="project", cascade="all, delete-orphan")
    metrics = relationship("Metrics", back_populates="project", uselist=False, cascade="all, delete-orphan")
    bids = relationship("Bid", back_populates="project", cascade="all, delete-orphan")
    github_repository = relationship(
        "GitHubRepository",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan"
    )


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    requirement_text = Column(Text, nullable=False)
    requirement_type = Column(String, default="FR")  # FR, NFR, UI, etc.
    section_name = Column(String, nullable=True)
    priority = Column(String, default="medium")
    status = Column(String, default="not_started")
    coverage_percentage = Column(Float, default=0.0)
    last_commit_at = Column(DateTime, nullable=True)
    order_index = Column(Integer, default=0)
    embedding_vector = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="requirements")
    trace_links = relationship("TraceLink", back_populates="requirement")


class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    commit_hash = Column(String, unique=True, index=True)
    message = Column(Text)
    author = Column(String)
    timestamp = Column(DateTime, default=utcnow)
    files_changed = Column(Text, nullable=True)
    is_merged = Column(Boolean, default=False)
    embedding_text = Column(Text, nullable=True)
    embedding_vector = Column(Text, nullable=True)

    project = relationship("Project", back_populates="commits")
    trace_links = relationship("TraceLink", back_populates="commit_record")


class TraceLink(Base):
    __tablename__ = "trace_links"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"))
    commit_id = Column(Integer, ForeignKey("commits.id"))
    similarity_score = Column(Float)
    confidence_level = Column(String)
    is_merged = Column(Boolean, default=False)

    requirement = relationship("Requirement", back_populates="trace_links")
    commit_record = relationship("Commit", back_populates="trace_links")


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id = Column(Integer, primary_key=True, index=True)
    pr_number = Column(Integer, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    repo = Column(String, nullable=False)
    title = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    head_ref = Column(String, nullable=True)
    base_ref = Column(String, nullable=True)
    merged = Column(Boolean, default=False)
    merged_at = Column(DateTime, nullable=True)
    embedding_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project")


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    repo = Column(String, nullable=False)
    branch_hints = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    project = relationship("Project")


class Metrics(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True)
    fulfillment_score = Column(Float, default=0.0)
    drift_score = Column(Float, default=0.0)
    delay_risk = Column(Float, default=0.0)
    trust_score = Column(Float, default=0.0)
    compliance_score = Column(Float, default=0.0)

    project = relationship("Project", back_populates="metrics")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    freelancer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    estimated_duration_days = Column(Integer, nullable=True)
    proposal = Column(Text, nullable=True)
    milestone_breakdown = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="bids")
    freelancer = relationship("User", back_populates="bids")


class GitHubRepository(Base):
    __tablename__ = "github_repositories"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    repo_url = Column(Text, nullable=False)
    repo_name = Column(String, nullable=False)
    owner = Column(String, nullable=False)
    installation_id = Column(String, nullable=True)
    webhook_id = Column(String, nullable=True)
    is_connected = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    project = relationship("Project", back_populates="github_repository")


class SessionToken(Base):
    __tablename__ = "session_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User")


class OAuthState(Base):
    __tablename__ = "oauth_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    state = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)          # e.g. "unassignment", "bid_accepted"
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)   # 90 days from creation

    user = relationship("User")
    project = relationship("Project")


class UnassignmentLog(Base):
    __tablename__ = "unassignment_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    unassigned_freelancer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    performed_at = Column(DateTime, default=utcnow)
