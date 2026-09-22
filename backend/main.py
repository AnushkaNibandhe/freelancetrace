from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import os
import secrets
import threading
from dotenv import load_dotenv

load_dotenv(override=True)
from pathlib import Path
from typing import Any, Optional

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import httpx

import models
import schemas
from analytics_engine import (
    compute_compliance_readiness,
    compute_fulfillment_score,
    compute_trust_score,
    detect_requirement_drift,
    predict_delay_risk,
)
from database import SessionLocal, engine
from nlp_engine import calculate_similarity, extract_requirements, generate_embedding

# ── NLP Services Layer ────────────────────────────────────────────────────────
try:
    from services.nlp.srs_parser import parse_srs
    from services.nlp.embedding_service import encode as svc_encode, embed_requirements
    from services.nlp.keyword_extractor import enrich_requirements
    from services.nlp.llm_extractor import extract_requirements_with_llm
    from services.nlp import srs_generator
    from services.nlp.srs_generator import GroqAPIError, PDFGenerationError
    from services.traceability_engine import (
        register_requirements as svc_register_requirements,
        ingest_commits as svc_ingest_commits,
        recalculate_metrics as svc_recalculate_metrics,
    )
    from services.vcs.webhook_handler import (
        verify_signature as svc_verify_signature,
        handle_push_event,
        handle_pull_request_event,
    )
    _SERVICES_AVAILABLE = True
    print("[main] NLP services layer loaded successfully", flush=True)
    
except Exception as _svc_err:
    _SERVICES_AVAILABLE = False
    print(f"[main] WARNING — NLP services not loaded: {_svc_err}", flush=True)


models.Base.metadata.create_all(bind=engine)

app = Flask("freelancetrace_backend")
CORS(app, resources={r"/*": {"origins": "*"}})
print("FreelanceTrace backend loaded: link-repo debug v2", flush=True)

TOKEN_TTL_DAYS = 30
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _now_for_compare(value: Optional[datetime.datetime]) -> datetime.datetime:
    """Match timezone awareness to avoid naive/aware comparison errors."""
    if value is None:
        return _utcnow()
    now = _utcnow()
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return datetime.datetime.utcnow()
    return now


def _json_load(value: Optional[str]):
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _json_dump(value: Optional[object]):
    if value is None:
        return None
    return json.dumps(value)


def _iso(dt: Optional[datetime.datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime.datetime]:
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


_MIGRATE_CHECKED = False

@app.before_request
def auto_migrate():
    global _MIGRATE_CHECKED
    if not _MIGRATE_CHECKED:
        try:
             from sqlalchemy import text
             db = SessionLocal()
             try:
                 with db.get_bind().connect() as conn:
                     try:
                         conn.execute(text("ALTER TABLE requirements ADD COLUMN requirement_type VARCHAR DEFAULT 'FR'"))
                     except Exception: pass
                     try:
                         conn.execute(text("ALTER TABLE requirements ADD COLUMN section_name VARCHAR"))
                     except Exception: pass
                     try:
                         conn.execute(text("ALTER TABLE commits ADD COLUMN is_merged BOOLEAN DEFAULT FALSE"))
                     except Exception: pass
                     try:
                         conn.execute(text("ALTER TABLE commits ADD COLUMN embedding_text TEXT"))
                     except Exception: pass
                     try:
                         conn.execute(text("ALTER TABLE trace_links ADD COLUMN is_merged BOOLEAN DEFAULT FALSE"))
                     except Exception: pass
                     conn.commit()
             except Exception:
                 pass # Already applied
             db.close()
             _MIGRATE_CHECKED = True
        except Exception:
             pass

@app.get("/fix_db")
def fix_database_schema():
    import sqlite3
    db_path = "freelancetrace.db"
    log_out = []
    try:
         conn = sqlite3.connect(db_path)
         cursor = conn.cursor()
         try:
             cursor.execute("ALTER TABLE requirements ADD COLUMN section_name VARCHAR")
             conn.commit()
             log_out.append("Successfully added section_name column!")
         except Exception as e:
             log_out.append(f"section_name skipped: {e}")
             
         try:
             cursor.execute("ALTER TABLE requirements ADD COLUMN requirement_type VARCHAR DEFAULT 'FR'")
             conn.commit()
             log_out.append("Successfully added requirement_type column!")
         except Exception as e:
             log_out.append(f"requirement_type skipped: {e}")
             
         try:
             cursor.execute("ALTER TABLE commits ADD COLUMN is_merged BOOLEAN DEFAULT FALSE")
             conn.commit()
             log_out.append("Successfully added is_merged column to commits!")
         except Exception as e:
             log_out.append(f"is_merged skipped: {e}")
             
         try:
             cursor.execute("ALTER TABLE commits ADD COLUMN embedding_text TEXT")
             conn.commit()
             log_out.append("Successfully added embedding_text column to commits!")
         except Exception as e:
             log_out.append(f"embedding_text skipped: {e}")
             
         conn.close()
    except Exception as e:
         log_out.append(f"Critical error: {e}")
         
    return {"status": "Complete", "logs": log_out}

def _serialize_profile(user: models.User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "organization_name": user.organization_name,
        "skills": _json_load(user.skills),
        "tech_stack": _json_load(user.tech_stack),
        "github_username": user.github_username,
        "portfolio_url": user.portfolio_url,
        "hourly_rate": user.hourly_rate,
        "total_earnings": user.total_earnings,
        "total_spent": user.total_spent,
        "trust_score": user.trust_score,
        "projects_completed": user.projects_completed,
        "dispute_rate": user.dispute_rate,
        "is_verified": user.is_verified,
        "is_suspended": user.is_suspended,
        "created_at": _iso(user.created_at),
        "updated_at": _iso(user.updated_at),
    }


def _serialize_requirement(requirement: models.Requirement) -> dict[str, Any]:
    return {
        "id": str(requirement.id),
        "project_id": str(requirement.project_id),
        "requirement_text": requirement.requirement_text,
        "type": requirement.requirement_type,
        "section_name": requirement.section_name,
        "priority": requirement.priority,
        "status": requirement.status,
        "coverage_percentage": requirement.coverage_percentage,
        "last_commit_at": _iso(requirement.last_commit_at),
        "order_index": requirement.order_index,
        "created_at": _iso(requirement.created_at),
        "updated_at": _iso(requirement.updated_at),
    }


def _serialize_commit(commit: models.Commit) -> dict[str, Any]:
    files_changed = _json_load(commit.files_changed)
    files_list: list[str] = []
    if isinstance(files_changed, dict):
        files_list = (
            list(files_changed.get("added", []))
            + list(files_changed.get("removed", []))
            + list(files_changed.get("modified", []))
        )
    elif isinstance(files_changed, list):
        files_list = files_changed

    return {
        "id": str(commit.id),
        "project_id": str(commit.project_id),
        "commit_hash": commit.commit_hash,
        "message": commit.message,
        "author": commit.author,
        "files_changed": files_list,
        "additions": 0,
        "deletions": 0,
        "committed_at": _iso(commit.timestamp),
        "created_at": _iso(commit.timestamp),
    }


def _serialize_bid(bid: models.Bid, project: Optional[models.Project] = None) -> dict[str, Any]:
    over_budget = False
    over_duration = False
    budget_diff_pct = None
    budget_diff_amount = None
    duration_diff_pct = None
    duration_diff_days = None

    if project is not None:
        if project.budget_max and project.budget_max > 0:
            budget_diff_pct = ((bid.amount - project.budget_max) / project.budget_max) * 100
            budget_diff_amount = bid.amount - project.budget_max
            over_budget = budget_diff_pct > 0
        if project.duration_days and project.duration_days > 0 and bid.estimated_duration_days:
            duration_diff_days = bid.estimated_duration_days - project.duration_days
            duration_diff_pct = (duration_diff_days / project.duration_days) * 100
            over_duration = duration_diff_days > 0

    return {
        "id": str(bid.id),
        "project_id": str(bid.project_id),
        "freelancer_id": str(bid.freelancer_id),
        "amount": bid.amount,
        "estimated_duration_days": bid.estimated_duration_days,
        "proposal": bid.proposal,
        "milestone_breakdown": _json_load(bid.milestone_breakdown),
        "status": bid.status,
        "created_at": _iso(bid.created_at),
        "updated_at": _iso(bid.updated_at),
        "freelancer": _serialize_profile(bid.freelancer) if bid.freelancer else None,
        "over_budget": over_budget,
        "over_duration": over_duration,
        "budget_diff_pct": budget_diff_pct,
        "budget_diff_amount": budget_diff_amount,
        "duration_diff_pct": duration_diff_pct,
        "duration_diff_days": duration_diff_days,
    }


def _serialize_repo(repo: models.GitHubRepository) -> dict[str, Any]:
    return {
        "id": str(repo.id),
        "project_id": str(repo.project_id),
        "repo_url": repo.repo_url,
        "repo_name": repo.repo_name,
        "owner": repo.owner,
        "installation_id": repo.installation_id,
        "webhook_id": repo.webhook_id,
        "is_connected": repo.is_connected,
        "last_sync_at": _iso(repo.last_sync_at),
        "created_at": _iso(repo.created_at),
    }


def _serialize_project(
    project: models.Project,
    include_requirements: bool = True,
    include_people: bool = True,
    include_bids: bool = True,
) -> dict[str, Any]:
    data = {
        "id": str(project.id),
        "client_id": str(project.client_id),
        "title": project.title,
        "description": project.description,
        "domain": project.domain,
        "tech_stack": _json_load(project.tech_stack),
        "budget_min": project.budget_min,
        "budget_max": project.budget_max,
        "duration_days": project.duration_days,
        "status": project.status,
        "visibility": project.visibility,
        "srs_file_url": project.srs_file_url,
        "srs_parsed_at": _iso(project.srs_parsed_at),
        "awarded_freelancer_id": str(project.awarded_freelancer_id)
        if project.awarded_freelancer_id
        else None,
        "awarded_at": _iso(project.awarded_at),
        "completed_at": _iso(project.completed_at),
        "created_at": _iso(project.created_at),
        "updated_at": _iso(project.updated_at),
        "github_repo": project.github_repo,
    }

    if include_people:
        data["client"] = _serialize_profile(project.client) if project.client else None
        data["freelancer"] = (
            _serialize_profile(project.freelancer) if project.freelancer else None
        )

    if include_requirements:
        requirements = sorted(project.requirements, key=lambda r: r.order_index or 0)
        data["requirements"] = [_serialize_requirement(r) for r in requirements]

    if include_bids:
        bids = sorted(project.bids, key=lambda b: b.created_at or _utcnow(), reverse=True)
        data["bids"] = [_serialize_bid(b, project) for b in bids]

    if project.github_repository:
        data["github_repository"] = _serialize_repo(project.github_repository)

    return data


def _issue_token(db: SessionLocal, user: models.User) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = _utcnow() + datetime.timedelta(days=TOKEN_TTL_DAYS)
    db.add(
        models.SessionToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
    )
    db.commit()
    return token


def _get_current_user(db: SessionLocal) -> Optional[models.User]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    session = (
        db.query(models.SessionToken)
        .filter(models.SessionToken.token == token)
        .first()
    )
    if not session:
        return None
    if session.expires_at and session.expires_at < _now_for_compare(session.expires_at):
        db.delete(session)
        db.commit()
        return None
    return session.user


def _require_user(db: SessionLocal):
    user = _get_current_user(db)
    if not user:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return user, None


def _ensure_github_webhook(
    owner: str,
    repo_name: str,
    access_token: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    base_url = os.getenv("WEBHOOK_BASE_URL")
    secret = os.getenv("GITHUB_WEBHOOK_SECRET")

    if not access_token or not base_url or not secret:
        return None, None

    webhook_url = f"{base_url.rstrip('/')}/webhooks/github"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            hooks_resp = client.get(
                f"https://api.github.com/repos/{owner}/{repo_name}/hooks",
                headers=headers,
            )
            hooks_resp.raise_for_status()
            hooks = hooks_resp.json()
            for hook in hooks:
                config = hook.get("config") or {}
                if config.get("url") == webhook_url:
                    return str(hook.get("id")), None

            payload = {
                "name": "web",
                "active": True,
                "events": ["push"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": secret,
                },
            }
            create_resp = client.post(
                f"https://api.github.com/repos/{owner}/{repo_name}/hooks",
                headers=headers,
                json=payload,
            )
            create_resp.raise_for_status()
            created = create_resp.json()
            return str(created.get("id")), None
    except Exception as exc:
        return None, f"Webhook setup failed: {exc}"

def _get_github_oauth_config() -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    client_id = os.getenv("GITHUB_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GITHUB_OAUTH_CLIENT_SECRET")
    redirect_uri = os.getenv("GITHUB_OAUTH_REDIRECT_URI")
    success_redirect = os.getenv("GITHUB_OAUTH_SUCCESS_REDIRECT", "http://localhost:8080")
    return client_id, client_secret, redirect_uri, success_redirect

@app.get("/")
def read_root():
    return jsonify({"status": "ok", "message": "FreelanceTrace API is running"})


@app.get("/debug/version")
def debug_version():
    return jsonify({"version": "link-repo-debug-v2"})


@app.post("/auth/signup")
def signup():
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""
        full_name = payload.get("full_name") or ""
        role = payload.get("role") or "client"

        if not email or "@" not in email:
            return jsonify({"error": "invalid_email"}), 400
        if len(password) < 6:
            return jsonify({"error": "weak_password"}), 400

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            return jsonify({"error": "Email already registered"}), 400

        user = models.User(
            email=email,
            password_hash=generate_password_hash(password),
            full_name=full_name,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = _issue_token(db, user)
        return jsonify(
            {
                "token": token,
                "user": {"id": str(user.id), "email": user.email},
                "profile": _serialize_profile(user),
            }
        )
    finally:
        db.close()


@app.post("/auth/login")
def login():
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid login credentials"}), 401

        token = _issue_token(db, user)
        return jsonify(
            {
                "token": token,
                "user": {"id": str(user.id), "email": user.email},
                "profile": _serialize_profile(user),
            }
        )
    finally:
        db.close()


@app.get("/auth/me")
def auth_me():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error
        return jsonify(
            {
                "user": {"id": str(user.id), "email": user.email},
                "profile": _serialize_profile(user),
            }
        )
    finally:
        db.close()


@app.post("/auth/logout")
def logout():
    db = SessionLocal()
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"status": "ok"})
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            session = (
                db.query(models.SessionToken)
                .filter(models.SessionToken.token == token)
                .first()
            )
            if session:
                db.delete(session)
                db.commit()
        return jsonify({"status": "ok"})
    finally:
        db.close()

@app.post("/github/oauth/url")
def github_oauth_url():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        client_id, _, redirect_uri, _ = _get_github_oauth_config()
        if not client_id or not redirect_uri:
            return jsonify({"error": "github_oauth_not_configured"}), 500

        payload = request.get_json(silent=True) or {}
        redirect_to = payload.get("redirect_to")

        state = secrets.token_urlsafe(16)
        db.add(
            models.OAuthState(
                user_id=user.id,
                state=state,
                expires_at=_utcnow() + datetime.timedelta(minutes=10),
            )
        )
        db.commit()

        state_param = state
        if redirect_to:
            state_param = f"{state}|{redirect_to}"

        scope = "repo admin:repo_hook"
        url = (
            "https://github.com/login/oauth/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state_param}"
            f"&scope={scope.replace(' ', '%20')}"
        )
        return jsonify({"url": url})
    finally:
        db.close()


@app.get("/github/oauth/callback")
def github_oauth_callback():
    db = SessionLocal()
    try:
        code = request.args.get("code")
        state_param = request.args.get("state")
        if not code or not state_param:
            return jsonify({"error": "missing_code_or_state"}), 400

        parts = state_param.split("|", 1)
        state = parts[0]
        success_redirect_from_state = parts[1] if len(parts) > 1 else None

        oauth_state = (
            db.query(models.OAuthState)
            .filter(models.OAuthState.state == state)
            .first()
        )
        if not oauth_state:
            return jsonify({"error": "invalid_state"}), 400
        if oauth_state.expires_at and oauth_state.expires_at < _now_for_compare(oauth_state.expires_at):
            db.delete(oauth_state)
            db.commit()
            return jsonify({"error": "state_expired"}), 400

        client_id, client_secret, redirect_uri, success_redirect = _get_github_oauth_config()
        if success_redirect_from_state:
            success_redirect = success_redirect_from_state

        if not client_id or not client_secret or not redirect_uri:
            return jsonify({"error": "github_oauth_not_configured"}), 500

        token_resp = httpx.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "state": state,
            },
            timeout=10.0,
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        token_type = token_data.get("token_type")
        scope = token_data.get("scope")
        if not access_token:
            print(f"GITHUB OAUTH ERROR: {token_data}", flush=True)
            return jsonify({"error": "token_exchange_failed", "details": token_data}), 400

        user = db.query(models.User).filter(models.User.id == oauth_state.user_id).first()
        if not user:
            return jsonify({"error": "user_not_found"}), 404

        user.github_access_token = access_token
        user.github_token_type = token_type
        user.github_token_scope = scope

        db.delete(oauth_state)
        db.commit()

        return (
            "",
            302,
            {"Location": success_redirect},
        )
    finally:
        db.close()


@app.get("/github/repos")
def github_repos():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error
        if not user.github_access_token:
            return jsonify({"error": "github_not_connected"}), 400

        headers = {
            "Authorization": f"Bearer {user.github_access_token}",
            "Accept": "application/vnd.github+json",
        }
        resp = httpx.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={"per_page": 100, "affiliation": "owner,collaborator"},
            timeout=10.0,
        )
        resp.raise_for_status()
        repos = resp.json()
        payload = [
            {
                "id": repo.get("id"),
                "full_name": repo.get("full_name"),
                "name": repo.get("name"),
                "owner": (repo.get("owner") or {}).get("login"),
                "html_url": repo.get("html_url"),
                "private": repo.get("private"),
            }
            for repo in repos
        ]
        return jsonify(payload)
    finally:
        db.close()


@app.get("/profiles/me")
def get_profile():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error
        return jsonify(_serialize_profile(user))
    finally:
        db.close()


@app.patch("/profiles/me")
def update_profile():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        payload = request.get_json(silent=True) or {}
        updatable = {
            "full_name",
            "avatar_url",
            "bio",
            "organization_name",
            "skills",
            "tech_stack",
            "github_username",
            "portfolio_url",
            "hourly_rate",
        }
        for key, value in payload.items():
            if key not in updatable:
                continue
            if key in {"skills", "tech_stack"}:
                setattr(user, key, _json_dump(value))
            else:
                setattr(user, key, value)

        user.updated_at = _utcnow()
        db.commit()
        db.refresh(user)
        return jsonify(_serialize_profile(user))
    finally:
        db.close()


@app.get("/projects")
def list_projects():
    db = SessionLocal()
    try:
        query = db.query(models.Project)
        status = request.args.get("status")
        client_id = request.args.get("client_id")
        freelancer_id = request.args.get("freelancer_id")
        visibility = request.args.get("visibility")

        if status:
            status_values = [s.strip() for s in status.split(",") if s.strip()]
            if len(status_values) == 1:
                query = query.filter(models.Project.status == status_values[0])
            else:
                query = query.filter(models.Project.status.in_(status_values))

        if client_id:
            query = query.filter(models.Project.client_id == int(client_id))

        if freelancer_id:
            query = query.filter(models.Project.awarded_freelancer_id == int(freelancer_id))

        if visibility:
            query = query.filter(models.Project.visibility == visibility)

        projects = query.order_by(models.Project.created_at.desc()).all()
        return jsonify([_serialize_project(p) for p in projects])
    finally:
        db.close()


@app.get("/projects/<int:project_id>")
def get_project(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        return jsonify(_serialize_project(project))
    finally:
        db.close()


@app.post("/projects")
def create_project():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        payload = request.get_json(silent=True) or {}
        project_payload = payload.get("project") or payload
        requirements_payload = payload.get("requirements") or []

        try:
            project_data = schemas.ProjectCreate.model_validate(project_payload)
        except Exception as exc:
            return jsonify({"error": "validation_error", "detail": str(exc)}), 400

        db_project = models.Project(
            client_id=user.id,
            title=project_data.title,
            description=project_data.description,
            domain=project_data.domain,
            tech_stack=_json_dump(project_data.tech_stack),
            budget_min=project_data.budget_min,
            budget_max=project_data.budget_max,
            duration_days=project_data.duration_days,
            status=project_data.status or "open",
            visibility=project_data.visibility or "public",
            srs_file_url=project_data.srs_file_url,
            github_repo=project_data.github_repo,
            start_date=project_data.start_date or _utcnow(),
            deadline=project_data.deadline,
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)

        if isinstance(requirements_payload, list):
            for index, text in enumerate(requirements_payload):
                if not text:
                    continue
                db.add(
                    models.Requirement(
                        project_id=db_project.id,
                        requirement_text=str(text),
                        priority="medium",
                        status="not_started",
                        order_index=index,
                    )
                )
            db.commit()

        db.refresh(db_project)
        return jsonify(_serialize_project(db_project))
    finally:
        db.close()


@app.patch("/projects/<int:project_id>")
def update_project(project_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        # Allow any authenticated user to link a repo for now (demo-friendly).

        payload = request.get_json(silent=True) or {}
        for key, value in payload.items():
            if key in {"tech_stack"}:
                setattr(project, key, _json_dump(value))
            elif hasattr(project, key):
                setattr(project, key, value)

        project.updated_at = _utcnow()
        db.commit()
        db.refresh(project)
        return jsonify(_serialize_project(project))
    finally:
        db.close()


@app.delete("/projects/<int:project_id>")
def delete_project(project_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        is_client = project.client_id == user.id
        is_awarded_freelancer = project.awarded_freelancer_id == user.id
        if not (is_client or is_awarded_freelancer or user.role == "admin"):
            return (
                jsonify(
                    {
                        "error": "forbidden_v2",
                        "detail": {
                            "user_id": user.id,
                            "user_role": user.role,
                            "project_client_id": project.client_id,
                            "project_awarded_freelancer_id": project.awarded_freelancer_id,
                        },
                    }
                ),
                403,
            )

        db.delete(project)
        db.commit()
        return jsonify({"status": "deleted"})
    finally:
        db.close()


@app.post("/projects/<int:project_id>/unassign")
def unassign_project(project_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        # Only the project client or an admin may unassign
        if project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        # Project must have an assigned freelancer
        if not project.awarded_freelancer_id:
            return jsonify({"error": "not_assigned"}), 409

        unassigned_freelancer_id = project.awarded_freelancer_id

        # Reset project assignment fields
        project.awarded_freelancer_id = None
        project.awarded_at = None
        project.status = "open"
        project.updated_at = _utcnow()

        # Create UnassignmentLog (audit record)
        payload = request.get_json(silent=True) or {}
        reason = payload.get("reason") or None

        log_entry = models.UnassignmentLog(
            project_id=project.id,
            unassigned_freelancer_id=unassigned_freelancer_id,
            performed_by_id=user.id,
            reason=reason,
            performed_at=_utcnow(),
        )
        db.add(log_entry)

        # Commit the primary unassignment transaction
        db.commit()
        db.refresh(project)

        # Create Notification for the unassigned freelancer (best-effort)
        notification_id = None
        try:
            notification = models.Notification(
                user_id=unassigned_freelancer_id,
                type="unassignment",
                title=f"You have been unassigned from {project.title}",
                message=(
                    f"You have been removed from the project \"{project.title}\". "
                    + (f"Reason: {reason}" if reason else "No reason was provided.")
                ),
                project_id=project.id,
                is_read=False,
                created_at=_utcnow(),
                expires_at=_utcnow() + datetime.timedelta(days=90),
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)
            notification_id = notification.id
        except Exception as notif_err:
            print(f"[unassign] WARNING — notification creation failed (non-fatal): {notif_err}", flush=True)
            db.rollback()

        return jsonify({
            "project": _serialize_project(project),
            "notification_id": notification_id,
        })
    finally:
        db.close()


@app.get("/projects/<int:project_id>/bids")
def get_project_bids(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        bids = (
            db.query(models.Bid)
            .filter(models.Bid.project_id == project_id)
            .order_by(models.Bid.created_at.desc())
            .all()
        )
        return jsonify([_serialize_bid(bid, project) for bid in bids])
    finally:
        db.close()


@app.post("/projects/<int:project_id>/bids")
def create_bid(project_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        if project.status != "open":
            return jsonify({"error": "Project is not open for bids"}), 400

        payload = request.get_json(silent=True) or {}
        amount = payload.get("amount")
        if amount is None:
            return jsonify({"error": "missing_amount"}), 400

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid_amount"}), 400

        if amount < 0:
            return jsonify({"error": "invalid_amount"}), 400

        estimated_duration_days = payload.get("estimated_duration_days")
        if estimated_duration_days is not None:
            try:
                estimated_duration_days = int(estimated_duration_days)
            except (TypeError, ValueError):
                return jsonify({"error": "invalid_duration"}), 400
            if estimated_duration_days <= 0:
                return jsonify({"error": "invalid_duration"}), 400

        bid = models.Bid(
            project_id=project_id,
            freelancer_id=user.id,
            amount=amount,
            estimated_duration_days=estimated_duration_days,
            proposal=payload.get("proposal"),
            milestone_breakdown=_json_dump(payload.get("milestone_breakdown")),
            status="pending",
        )
        db.add(bid)
        db.commit()
        db.refresh(bid)
        return jsonify(_serialize_bid(bid, project))
    finally:
        db.close()


@app.get("/bids")
def list_bids():
    db = SessionLocal()
    try:
        query = db.query(models.Bid)
        freelancer_id = request.args.get("freelancer_id")
        if freelancer_id:
            query = query.filter(models.Bid.freelancer_id == int(freelancer_id))
        bids = query.order_by(models.Bid.created_at.desc()).all()
        return jsonify([_serialize_bid(bid) for bid in bids])
    finally:
        db.close()


@app.patch("/bids/<int:bid_id>")
def update_bid(bid_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        bid = db.query(models.Bid).filter(models.Bid.id == bid_id).first()
        if not bid:
            return jsonify({"error": "not_found"}), 404

        project = db.query(models.Project).filter(models.Project.id == bid.project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        # Only project owner or admin can accept/reject
        is_client = project.client_id == user.id
        is_awarded_freelancer = project.awarded_freelancer_id == user.id
        if not (is_client or is_awarded_freelancer or user.role == "admin"):
            return (
                jsonify(
                    {
                        "error": "forbidden_v2",
                        "detail": {
                            "user_id": user.id,
                            "user_role": user.role,
                            "project_client_id": project.client_id,
                            "project_awarded_freelancer_id": project.awarded_freelancer_id,
                        },
                    }
                ),
                403,
            )

        payload = request.get_json(silent=True) or {}
        new_status = payload.get("status")
        if new_status:
            bid.status = new_status

            if new_status == "accepted":
                project.status = "in_progress"
                project.awarded_freelancer_id = bid.freelancer_id
                project.awarded_at = _utcnow()

                db.query(models.Bid).filter(
                    models.Bid.project_id == bid.project_id,
                    models.Bid.id != bid.id,
                    models.Bid.status == "pending",
                ).update({models.Bid.status: "rejected"})

        db.commit()
        db.refresh(bid)
        return jsonify(_serialize_bid(bid, project))
    finally:
        db.close()


@app.delete("/bids/<int:bid_id>")
def delete_bid(bid_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        bid = db.query(models.Bid).filter(models.Bid.id == bid_id).first()
        if not bid:
            return jsonify({"error": "not_found"}), 404

        if bid.freelancer_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        db.delete(bid)
        db.commit()
        return jsonify({"status": "deleted", "project_id": str(bid.project_id)})
    finally:
        db.close()


@app.get("/projects/<int:project_id>/github")
def get_project_repository(project_id: int):
    db = SessionLocal()
    try:
        repo = (
            db.query(models.GitHubRepository)
            .filter(models.GitHubRepository.project_id == project_id)
            .first()
        )
        if not repo:
            return jsonify(None)
        return jsonify(_serialize_repo(repo))
    finally:
        db.close()


@app.post("/projects/<int:project_id>/github/link")
def link_repository(project_id: int):
    db = SessionLocal()
    print(f"LINK REPOSITORY CALLED FOR PROJECT {project_id}", flush=True)
    try:
        user, error = _require_user(db)
        if error:
            print(f"LINK REPO AUTH ERROR: {error}", flush=True)
            return error
        print(f"LINK REPO USER: {user.id} ({user.role})")

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        
        is_client = project.client_id == user.id
        is_awarded_freelancer = project.awarded_freelancer_id == user.id
        if not (is_client or is_awarded_freelancer or user.role == "admin"):
            return jsonify({"error": "forbidden"}), 403

        payload = request.get_json(silent=True) or {}
        repo_full_name = (payload.get("repo_full_name") or "").strip()
        owner = (payload.get("owner") or "").strip()
        repo_name = (payload.get("repo_name") or "").strip()

        if repo_full_name and "/" in repo_full_name:
            owner, repo_name = repo_full_name.split("/", 1)

        if not owner or not repo_name:
            return jsonify({"error": "Invalid GitHub repository"}), 400

        repo_url = f"https://github.com/{owner}/{repo_name}"

        repo = (
            db.query(models.GitHubRepository)
            .filter(models.GitHubRepository.project_id == project_id)
            .first()
        )
        if not repo:
            repo = models.GitHubRepository(
                project_id=project_id,
                repo_url=repo_url,
                repo_name=repo_name,
                owner=owner,
                is_connected=True,
            )
            db.add(repo)
        else:
            repo.repo_url = repo_url
            repo.repo_name = repo_name
            repo.owner = owner
            repo.is_connected = True

        project.github_repo = f"{owner}/{repo_name}"

        webhook_id, webhook_error = _ensure_github_webhook(
            owner,
            repo_name,
            user.github_access_token,
        )
        if webhook_id:
            repo.webhook_id = webhook_id

        db.commit()
        db.refresh(repo)
        response = _serialize_repo(repo)
        if webhook_error:
            response["webhook_warning"] = webhook_error
        return jsonify(response)
    finally:
        db.close()


@app.post("/projects/<int:project_id>/github/sync")
def sync_commits(project_id: int):
    db = SessionLocal()
    try:
        repo = (
            db.query(models.GitHubRepository)
            .filter(models.GitHubRepository.project_id == project_id)
            .first()
        )
        if not repo:
            return jsonify({"error": "Repository not linked"}), 400

        user = _get_current_user(db)
        headers = {"Accept": "application/vnd.github+json"}
        if user and user.github_access_token:
            headers["Authorization"] = f"Bearer {user.github_access_token}"

        synced_count = 0
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"https://api.github.com/repos/{repo.owner}/{repo.repo_name}/commits?per_page=100", headers=headers)
                if resp.status_code == 200:
                    commits_data = resp.json()
                    
                    requirements = db.query(models.Requirement).filter(models.Requirement.project_id == project_id).all()
                    
                    for c in commits_data:
                        sha_raw = c.get("sha")
                        sha_stored = f"{project_id}_{sha_raw}"
                        existing = db.query(models.Commit).filter(models.Commit.commit_hash == sha_stored).first()
                        
                        if not existing:
                            commit_info = c.get("commit", {})
                            author_info = commit_info.get("author", {})
                            msg = commit_info.get("message", "")
                            date_str = author_info.get("date", "")
                            author_name = author_info.get("name", "")
                            
                            try:
                                dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                            except Exception:
                                dt = _utcnow()
                            
                            enrich_text = msg
                            try:
                                emb = generate_embedding(enrich_text)
                                emb_json = json.dumps(emb) if emb else None
                            except Exception:
                                emb_json = None
                                
                            new_c = models.Commit(
                                project_id=project_id,
                                commit_hash=sha_stored,
                                message=msg,
                                timestamp=dt,
                                author=author_name,
                                embedding_text=enrich_text,
                                embedding_vector=emb_json
                            )
                            db.add(new_c)
                            db.commit()
                            db.refresh(new_c)
                            synced_count += 1
                        else:
                            new_c = existing

                        # Calculate NLP Traceability for BOTH new and existing commits
                        try:
                            for req in requirements:
                                existing_link = db.query(models.TraceLink).filter(
                                    models.TraceLink.requirement_id == req.id, 
                                    models.TraceLink.commit_id == new_c.id
                                ).first()
                                
                                if not existing_link:
                                    enrich_text = new_c.embedding_text or new_c.message
                                    sim_score = calculate_similarity(req.requirement_text, enrich_text)
                                    if sim_score > 0.4:
                                        confidence = "high" if sim_score > 0.7 else ("medium" if sim_score > 0.5 else "low")
                                        db.add(models.TraceLink(
                                            requirement_id=req.id,
                                            commit_id=new_c.id,
                                            similarity_score=sim_score,
                                            confidence_level=confidence,
                                        ))
                                        if sim_score > 0.8:
                                            req.status = "fulfilled"
                                        elif req.status == "not_started" and sim_score > 0.6:
                                            req.status = "in_progress"
                            db.commit()
                        except Exception as nlp_err:
                            print(f"NLP Link Error: {nlp_err}")
                            
                    # Recalculate requirement coverage and status from TraceLinks
                    for req in requirements:
                        links = db.query(models.TraceLink).filter(models.TraceLink.requirement_id == req.id).all()
                        if links:
                            max_score = max([l.similarity_score for l in links])
                            req.coverage_percentage = min(100.0, max_score * 100)
                            if max_score > 0.8:
                                req.status = "fulfilled"
                                req.coverage_percentage = 100.0
                            elif max_score > 0.6 and req.status == "not_started":
                                req.status = "in_progress"
                    db.commit()
                            
                    try:
                        if _SERVICES_AVAILABLE:
                            svc_recalculate_metrics(project_id, db)
                    except Exception:
                        pass
        except Exception as e:
            print(f"Sync error: {e}")

        repo.last_sync_at = _utcnow()
        db.commit()
        return jsonify({"synced": synced_count})
    finally:
        db.close()


@app.get("/projects/<int:project_id>/commits")
def get_project_commits(project_id: int):
    db = SessionLocal()
    try:
        commits = (
            db.query(models.Commit)
            .filter(models.Commit.project_id == project_id)
            .order_by(models.Commit.timestamp.desc())
            .limit(200)
            .all()
        )
        return jsonify([_serialize_commit(commit) for commit in commits])
    finally:
        db.close()


@app.post("/projects/<int:project_id>/requirements")
def add_requirement(project_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404
        if project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        payload = request.get_json(silent=True) or {}
        text = payload.get("requirement_text") or payload.get("text")
        if not text:
            return jsonify({"error": "missing_requirement_text"}), 400

        requirement = models.Requirement(
            project_id=project_id,
            requirement_text=str(text),
            priority=payload.get("priority") or "medium",
            status=payload.get("status") or "not_started",
            coverage_percentage=payload.get("coverage_percentage") or 0.0,
            order_index=payload.get("order_index") or 0,
        )
        db.add(requirement)
        db.commit()
        db.refresh(requirement)
        return jsonify(_serialize_requirement(requirement))
    finally:
        db.close()


@app.get("/projects/<int:project_id>/requirements")
def get_requirements(project_id: int):
    db = SessionLocal()
    # On-demand Self-Healing Auto-Migration for SQLite layout
    try:
        from sqlalchemy import text
        with db.get_bind().connect() as conn:
             try:
                 conn.execute(text("ALTER TABLE requirements ADD COLUMN requirement_type VARCHAR DEFAULT 'FR'"))
                 conn.commit()
             except Exception:
                 pass # Already exists
    except Exception:
         pass

    try:
        reqs = (
            db.query(models.Requirement)
            .filter(models.Requirement.project_id == project_id)
            .order_by(models.Requirement.order_index.asc())
            .all()
        )
        return jsonify([_serialize_requirement(r) for r in reqs])
    finally:
        db.close()


@app.patch("/requirements/<int:requirement_id>")
def update_requirement(requirement_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        requirement = (
            db.query(models.Requirement)
            .filter(models.Requirement.id == requirement_id)
            .first()
        )
        if not requirement:
            return jsonify({"error": "not_found"}), 404

        project = (
            db.query(models.Project)
            .filter(models.Project.id == requirement.project_id)
            .first()
        )
        if project and project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        payload = request.get_json(silent=True) or {}
        for key, value in payload.items():
            if hasattr(requirement, key):
                setattr(requirement, key, value)
        requirement.updated_at = _utcnow()
        db.commit()
        db.refresh(requirement)
        return jsonify(_serialize_requirement(requirement))
    finally:
        db.close()


@app.delete("/requirements/<int:requirement_id>")
def delete_requirement(requirement_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        requirement = (
            db.query(models.Requirement)
            .filter(models.Requirement.id == requirement_id)
            .first()
        )
        if not requirement:
            return jsonify({"error": "not_found"}), 404

        project = (
            db.query(models.Project)
            .filter(models.Project.id == requirement.project_id)
            .first()
        )
        if project and project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        db.delete(requirement)
        db.commit()
        return jsonify({"status": "deleted", "project_id": str(requirement.project_id)})
    finally:
        db.close()


@app.post("/uploads/srs")
def upload_srs_file():
    if "file" not in request.files:
        return jsonify({"error": "missing_file"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "missing_file"}), 400

    filename = secure_filename(file.filename)
    if not filename:
        return jsonify({"error": "invalid_filename"}), 400

    unique_name = f"{datetime.datetime.utcnow().timestamp()}-{filename}"
    destination = UPLOAD_DIR / unique_name
    file.save(destination)
    return jsonify({"url": f"/uploads/{unique_name}"})


@app.get("/uploads/<path:filename>")
def get_upload(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


@app.post("/projects/<int:project_id>/upload_srs")
def upload_srs(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found", "detail": "Project not found"}), 404

        if "file" not in request.files:
            return jsonify({"error": "bad_request", "detail": "Missing file field 'file'"}), 400

        file = request.files["file"]
        filename = secure_filename(file.filename or "srs.txt")

        # ── Step 1: Save file temporarily ─────────────────────────────────────
        import tempfile
        ext = Path(filename).suffix.lower() or ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # Also save a permanent copy so users can re-download the SRS
        unique_name = f"{datetime.datetime.utcnow().timestamp()}-{filename}"
        import shutil
        shutil.copy2(tmp_path, UPLOAD_DIR / unique_name)

        pipeline_used = "legacy"
        requirements: list[dict] = []
        req_count = 0

        try:
            # ── Step 2: Extract text and Run spaCy NLP Layer FIRST ────────────
            if _SERVICES_AVAILABLE:
                try:
                    print(f"[upload_srs] Running spaCy parse on {tmp_path}...")
                    requirements = parse_srs(tmp_path, str(project_id))
                    print(f"[upload_srs] spaCy extracted {len(requirements)} requirements")
                    pipeline_used = "spacy"
                except Exception as e:
                    print(f"[upload_srs] Error running spaCy parse_srs: {e}")
                    import traceback
                    traceback.print_exc()

            # ── Step 3: Format extracted items with Gemini AI ────────────────
            llm_extractor_func = globals().get("extract_requirements_with_llm")
            if llm_extractor_func:
                # If we found suspiciously few requirements via heuristic parser, or if they are very short,
                # we prefer running the LLM on the RAW text to ensure full coverage.
                if len(requirements) < 3:
                     print(f"[upload_srs] Heuristic parser found only {len(requirements)} items. Trying raw text LLM fallback for better coverage...")
                     requirements = [] # Force fallback
                else:
                    print(f"[upload_srs] Formatting {len(requirements)} items with Gemini AI...")
                    reqs_text_blob = "\n".join([f"- {r.get('text') or ''}" for r in requirements])
                    try:
                        formatted_reqs = llm_extractor_func(reqs_text_blob, project.title or "")
                        if formatted_reqs:
                            print(f"[upload_srs] AI successfully formatted {len(formatted_reqs)} items")
                            requirements = formatted_reqs
                            pipeline_used = "spacy + gemini"
                    except Exception as e:
                        print(f"[upload_srs] Error with AI formatting clean-up: {e}")

            # Fallback for plain text parsing if previous steps yielded too little
            if not requirements:
                print("[upload_srs] Fallback: Empty requirements list. Trying raw text open...")
                raw_text = ""
                try:
                    with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                        raw_text = f.read()
                except Exception:
                    pass
                if not raw_text.strip() or ext == ".pdf":
                    try:
                        import pdfplumber
                        with pdfplumber.open(tmp_path) as pdf:
                            raw_text = "\n".join([p.extract_text() or "" for p in pdf.pages])
                            print(f"[upload_srs] Raw text extracted from PDF ({len(raw_text)} chars). Preview: {raw_text[:200]}...")
                    except Exception:
                        pass
                        
                if raw_text.strip() and llm_extractor_func:
                    print("[upload_srs] Running LLM as ultimate backup on raw text...")
                    requirements = llm_extractor_func(raw_text, project.title or "")
                    pipeline_used = "gemini (raw fallback)"
                

            # ── Step 4: Embed + keyword-enrich + Save to DB ────────────────────
            if requirements:
                # 1. Enrich/Embed with loaded services if available
                if _SERVICES_AVAILABLE:
                    try:
                        requirements = embed_requirements(requirements)
                        requirements = enrich_requirements(requirements)
                        svc_register_requirements(project_id, requirements, db)
                    except Exception as e:
                        print(f"[upload_srs] Error enriching with NLP services: {e}")

                # 2. CLEAR PREVIOUS REQUIREMENTS for this project to prevent duplicates/garbage buildup
                db.query(models.Requirement).filter(
                    models.Requirement.project_id == project_id
                ).delete()
                db.commit()

                # 3. SAVE TO SQL DATABASE (Required for frontend and endpoints to query them)
                for i, req_data in enumerate(requirements):
                    # Fallback on some key properties just in case
                    req_text = (req_data or {}).get("text", "") or (req_data or {}).get("requirement_text", "")
                    priority = (req_data or {}).get("priority", "medium")
                    
                    # Generate embedding with legacy fallback if not filled
                    embedding = []
                    if "embedding_json" in req_data and req_data["embedding_json"]:
                         embedding = json.loads(req_data["embedding_json"])
                    elif callable(generate_embedding):
                         embedding = generate_embedding(req_text)

                    db.add(
                        models.Requirement(
                            project_id=project_id,
                            requirement_text=req_text,
                            requirement_type=req_data.get("type", "FR"),
                            section_name=req_data.get("section", "General"),
                            priority=priority,
                            status="not_started",
                            order_index=i,
                            embedding_vector=json.dumps(embedding) if embedding else None,
                        )
                    )
                db.commit()
                req_count = len(requirements)

        finally:
            import os as _os
            try:
                _os.unlink(tmp_path)
            except Exception:
                pass

        # ── Step 5: Update project record ─────────────────────────────────────
        project.srs_parsed_at = _utcnow()
        project.srs_file_url = f"/uploads/{unique_name}"
        db.commit()

        # Fetch freshly persisted requirements from DB to return in response
        db_reqs = (
            db.query(models.Requirement)
            .filter(models.Requirement.project_id == project_id)
            .order_by(models.Requirement.order_index.asc())
            .all()
        )
        requirements_payload = [
            {
                "id": r.id,
                "text": r.requirement_text,
                "type": r.requirement_type,
                "section": r.section_name,
                "priority": r.priority,
                "status": r.status,
            }
            for r in db_reqs
        ]

        return jsonify(
            {
                "message": "SRS processing complete",
                "requirements_extracted": req_count,
                "pipeline": pipeline_used,
                "requirements": requirements_payload,
            }
        )
    finally:
        db.close()


@app.post("/projects/<int:project_id>/retrace")
def retrace_project(project_id: int):
    """
    POST /projects/<id>/retrace

    Re-embeds all requirements and re-runs cosine similarity against all
    existing commits for the project. Use this to fix 0% fulfillment when
    requirements were uploaded without embeddings.
    """
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        if project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        if not _SERVICES_AVAILABLE:
            return jsonify({"error": "nlp_not_available"}), 503

        # Step 1: Re-embed all requirements that have no embedding
        requirements = (
            db.query(models.Requirement)
            .filter(models.Requirement.project_id == project_id)
            .all()
        )
        if not requirements:
            return jsonify({"error": "no_requirements"}), 400

        from services.nlp.embedding_service import encode as svc_encode
        import json as _json

        reembedded = 0
        for req in requirements:
            try:
                vec = svc_encode(req.requirement_text)
                req.embedding_vector = _json.dumps(
                    vec.tolist() if hasattr(vec, 'tolist') else list(vec)
                )
                reembedded += 1
            except Exception as e:
                print(f"[retrace] embed req {req.id} failed: {e}", flush=True)
        db.commit()
        print(f"[retrace] Re-embedded {reembedded} requirements for project {project_id}", flush=True)

        # Step 2: Collect existing commits, delete trace links, re-ingest
        existing_commits = (
            db.query(models.Commit)
            .filter(models.Commit.project_id == project_id)
            .all()
        )

        from services.vcs.traceability_engine import ingest_commits as _ingest
        from services.vcs.webhook_handler import CommitData

        commit_snapshots = []
        for c in existing_commits:
            files_meta = {}
            try:
                files_meta = _json.loads(c.files_changed) if c.files_changed else {}
            except Exception:
                pass
            commit_snapshots.append(CommitData(
                hash=c.commit_hash,
                message=c.message,
                author=c.author or "",
                timestamp=c.timestamp,
                all_files=files_meta.get("all_files", []),
            ))
            # Delete old trace links
            db.query(models.TraceLink).filter(
                models.TraceLink.commit_id == c.id
            ).delete()
            # Delete commit so ingest_commits won't skip it as a duplicate
            db.delete(c)
        db.commit()

        # Step 3: Re-ingest — this re-embeds commits and creates TraceLinks
        new_links = _ingest(commit_snapshots, project_id, db)

        # Step 4: Recalculate metrics
        metrics = svc_recalculate_metrics(project_id, db)

        return jsonify({
            "requirements_reembedded": reembedded,
            "commits_reprocessed": len(commit_snapshots),
            "new_trace_links": len(new_links),
            "metrics": metrics,
        })
    except Exception as exc:
        import traceback
        print(f"[retrace] ERROR: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": "retrace_failed", "detail": str(exc)}), 500
    finally:
        db.close()


@app.post("/projects/<int:project_id>/parse-requirements")
def parse_requirements(project_id: int):
    """
    POST /projects/<id>/parse-requirements

    Accepts multipart/form-data with a `file` field (.md or .txt).
    Requires Bearer token auth; caller must be the project owner or admin.

    Calls md_parser.parse_requirements_document(), deletes existing requirements
    for the project, inserts the new ones, and returns:
        {
            "requirements_extracted": int,
            "requirements": [...],
            "warning": str | null,
        }
    """
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        # ── Step 1: Validate file presence ────────────────────────────────────
        if "file" not in request.files:
            return jsonify({"error": "missing_file"}), 400

        file = request.files["file"]
        if not file or not file.filename:
            return jsonify({"error": "missing_file"}), 400

        filename = secure_filename(file.filename)
        ext = Path(filename).suffix.lower()
        if ext not in {".md", ".txt"}:
            return jsonify({"error": "invalid_file_type", "detail": "Only .md and .txt files are accepted"}), 400

        # ── Step 2: Read file content as UTF-8 ────────────────────────────────
        try:
            content = file.read().decode("utf-8")
        except (UnicodeDecodeError, ValueError):
            return jsonify({"error": "invalid_encoding"}), 400

        # ── Step 3: Authorisation — project owner or admin only ───────────────
        if project.client_id != user.id and user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        # ── Step 4: Parse requirements from the document ──────────────────────
        try:
            from services.nlp import md_parser
            parsed = md_parser.parse_requirements_document(content, str(project_id))
        except Exception as exc:
            print(f"[parse_requirements] md_parser error: {exc}", flush=True)
            return jsonify({"error": "parse_error", "detail": str(exc)}), 500

        # ── Step 5: Replace existing requirements ─────────────────────────────
        db.query(models.Requirement).filter(
            models.Requirement.project_id == project_id
        ).delete()
        db.commit()

        for req_data in parsed:
            # Generate embedding immediately so traceability works
            req_text = req_data["text"]
            embedding_json = None
            if _SERVICES_AVAILABLE:
                try:
                    from services.nlp.embedding_service import encode as svc_encode
                    vec = svc_encode(req_text)
                    import json as _json
                    embedding_json = _json.dumps(vec.tolist() if hasattr(vec, 'tolist') else list(vec))
                except Exception as emb_err:
                    print(f"[parse_requirements] embedding failed: {emb_err}", flush=True)

            db.add(
                models.Requirement(
                    project_id=project_id,
                    requirement_text=req_text,
                    requirement_type=req_data.get("type", "FR"),
                    section_name=req_data.get("section", "Requirements"),
                    priority=req_data.get("priority", "MEDIUM").lower(),
                    status="not_started",
                    order_index=req_data.get("order_index", 0),
                    embedding_vector=embedding_json,
                )
            )
        db.commit()

        # ── Step 6a: Re-run traceability against existing commits ──────────────
        if _SERVICES_AVAILABLE:
            try:
                svc_recalculate_metrics(project_id, db)
                # Re-link existing commits now that embeddings exist
                existing_commits = (
                    db.query(models.Commit)
                    .filter(models.Commit.project_id == project_id)
                    .all()
                )
                if existing_commits:
                    from services.vcs.traceability_engine import ingest_commits as _ingest
                    from services.vcs.webhook_handler import CommitData
                    commit_data_list = []
                    for c in existing_commits:
                        # Delete old trace links for this commit so we re-score cleanly
                        db.query(models.TraceLink).filter(
                            models.TraceLink.commit_id == c.id
                        ).delete()
                        # Re-encode commit
                        import json as _json2
                        files_meta = {}
                        try:
                            files_meta = _json2.loads(c.files_changed) if c.files_changed else {}
                        except Exception:
                            pass
                        cd = CommitData(
                            hash=c.commit_hash,
                            message=c.message,
                            author=c.author or "",
                            timestamp=c.timestamp,
                            all_files=files_meta.get("all_files", []),
                        )
                        commit_data_list.append(cd)
                    db.commit()
                    # Delete old commits so ingest_commits doesn't skip them as duplicates
                    for c in existing_commits:
                        db.delete(c)
                    db.commit()
                    _ingest(commit_data_list, project_id, db)
                    svc_recalculate_metrics(project_id, db)
            except Exception as trace_err:
                print(f"[parse_requirements] re-tracing failed (non-fatal): {trace_err}", flush=True)
                import traceback; traceback.print_exc()

        # ── Step 6: Fetch persisted records to return ─────────────────────────
        db_reqs = (
            db.query(models.Requirement)
            .filter(models.Requirement.project_id == project_id)
            .order_by(models.Requirement.order_index.asc())
            .all()
        )

        warning = None
        if not db_reqs:
            warning = "No requirements found in the ## Requirements section"

        return jsonify(
            {
                "requirements_extracted": len(db_reqs),
                "requirements": [_serialize_requirement(r) for r in db_reqs],
                "warning": warning,
            }
        )
    finally:
        db.close()


@app.post("/projects/<int:project_id>/generate-srs")
def generate_srs(project_id: int):
    """
    POST /projects/<id>/generate-srs

    Accepts JSON { "requirements_content": string } or reads from stored requirements.
    Requires Bearer token auth; caller must be the project owner.

    Calls srs_generator.generate_srs_pdf_sync() in a background thread, stores the
    PDF in uploads/, updates project.srs_file_url, and returns:
        {
            "file_url": string,
            "page_count": int,
        }

    Error responses:
        - 403: caller is not project owner
        - 404: project not found
        - 500: groq_auth_failed
        - 503: groq_not_configured, groq_rate_limited
        - 504: groq_timeout
    """
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        # ── Step 1: Authorisation — project owner only ────────────────────────
        if project.client_id != user.id:
            return jsonify({"error": "forbidden"}), 403

        # ── Step 2: Check Groq availability ───────────────────────────────────
        if not hasattr(srs_generator, "_GROQ_AVAILABLE") or not srs_generator._GROQ_AVAILABLE:
            return jsonify({"error": "groq_not_configured"}), 503
        # ── Step 3: Get requirements content ──────────────────────────────────
        payload = request.get_json(silent=True) or {}
        requirements_content = payload.get("requirements_content")

        if not requirements_content:
            # Concatenate all stored project requirements
            requirements = (
                db.query(models.Requirement)
                .filter(models.Requirement.project_id == project_id)
                .order_by(models.Requirement.order_index.asc())
                .all()
            )
            if not requirements:
                return jsonify({"error": "no_requirements"}), 400

            requirements_content = "\n".join(
                [f"- {r.requirement_text}" for r in requirements]
            )

        # ── Step 4: Generate PDF in a background thread ───────────────────────
        # Use a timestamped filename
        timestamp = datetime.datetime.utcnow().timestamp()
        filename = f"{timestamp}-{project.title.replace(' ', '_')}_SRS.pdf"
        output_path = UPLOAD_DIR / filename

        # Result container to capture return value or exception from thread
        result_container = {"result": None, "error": None}

        def _generate_pdf_thread():
            try:
                result = srs_generator.generate_srs_pdf_sync(
                    project_title=project.title or f"Project {project_id}",
                    project_id=str(project_id),
                    requirements_content=requirements_content,
                    output_path=output_path,
                )
                result_container["result"] = result
            except Exception as exc:
                import traceback
                print(f"[generate_srs] ERROR in PDF thread: {exc}", flush=True)
                traceback.print_exc()
                result_container["error"] = exc

        thread = threading.Thread(target=_generate_pdf_thread, daemon=True)
        thread.start()
        thread.join(timeout=60.0)  # Wait up to 60 seconds for large SRS documents

        if thread.is_alive():
            # Thread is still running — timeout
            return jsonify({"error": "groq_timeout"}), 504

        # ── Step 5: Handle errors from the thread ─────────────────────────────
        if result_container["error"]:
            exc = result_container["error"]
            if isinstance(exc, GroqAPIError):
                if exc.status_code == 429:
                    return jsonify({"error": "groq_rate_limited"}), 503
                elif exc.status_code == 401:
                    return jsonify({"error": "groq_auth_failed"}), 500
                elif "timeout" in str(exc).lower():
                    return jsonify({"error": "groq_timeout"}), 504
                else:
                    return jsonify({"error": "groq_api_error", "detail": str(exc)}), 500
            elif isinstance(exc, PDFGenerationError):
                return jsonify({"error": "pdf_render_failed", "detail": str(exc)}), 500
            else:
                return jsonify({"error": "unknown_error", "detail": str(exc)}), 500

        # ── Step 6: Update project record ─────────────────────────────────────
        result = result_container["result"]
        if not result:
            return jsonify({"error": "pdf_generation_failed"}), 500

        file_url = f"/uploads/{filename}"
        project.srs_file_url = file_url
        db.commit()

        return jsonify(
            {
                "file_url": file_url,
                "page_count": result.get("page_count", 0),
            }
        )
    except Exception as top_exc:
        import traceback
        print(f"[generate_srs] UNHANDLED EXCEPTION: {top_exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": "server_error", "detail": str(top_exc)}), 500
    finally:
        db.close()


@app.get("/projects/<int:project_id>/metrics")
def get_project_metrics(project_id: int):
    db = SessionLocal()
    try:
        metrics = db.query(models.Metrics).filter(models.Metrics.project_id == project_id).first()
        if not metrics:
            return jsonify(schemas.Metrics(project_id=project_id, id=0).model_dump())
        return jsonify(schemas.Metrics.model_validate(metrics).model_dump())
    finally:
        db.close()


@app.post("/webhooks/github")
@app.post("/github/webhook")
def github_webhook():
    db = SessionLocal()
    try:
        secret = os.getenv("GITHUB_WEBHOOK_SECRET")
        if not secret:
            return (
                jsonify(
                    {
                        "error": "server_not_configured",
                        "detail": "Missing GITHUB_WEBHOOK_SECRET",
                    }
                ),
                500,
            )

        payload_bytes = request.get_data() or b""
        signature = request.headers.get("X-Hub-Signature-256", "")

        # Verify HMAC signature (delegate to service if available, else inline)
        if _SERVICES_AVAILABLE:
            if not svc_verify_signature(payload_bytes, signature, secret):
                return jsonify({"error": "unauthorized", "detail": "Invalid signature"}), 401
        else:
            if not signature.startswith("sha256="):
                return jsonify({"error": "unauthorized", "detail": "Missing signature"}), 401
            expected = (
                "sha256="
                + hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
            )
            if not hmac.compare_digest(signature, expected):
                return jsonify({"error": "unauthorized", "detail": "Invalid signature"}), 401

        payload: dict[str, Any] = request.get_json(silent=True) or {}
        event = request.headers.get("X-GitHub-Event", "push")

        repo_name = (payload.get("repository") or {}).get("full_name")
        if not repo_name:
            return jsonify({"status": "ignored", "reason": "No repository in payload"})

        project = db.query(models.Project).filter(models.Project.github_repo == repo_name).first()
        if not project:
            return jsonify({"status": "ignored", "reason": "Repository not linked to any project"})

        raw_commits = payload.get("commits", [])

        if _SERVICES_AVAILABLE:
            # ── New NLP pipeline ──────────────────────────────────────────────
            if event == "push":
                commit_objects = handle_push_event(payload)
            elif event == "pull_request":
                commit_objects = handle_pull_request_event(payload)
            else:
                commit_objects = []

            if commit_objects:
                svc_ingest_commits(commit_objects, project.id, db)
                svc_recalculate_metrics(project.id, db)

            return jsonify({"status": "success", "processed_commits": len(commit_objects)})

        else:
            # ── Legacy fallback ───────────────────────────────────────────────
            requirements = db.query(models.Requirement).filter(
                models.Requirement.project_id == project.id
            ).all()

            for commit_data in raw_commits:
                commit_msg = (commit_data or {}).get("message", "")
                files_changed = {
                    "added": (commit_data or {}).get("added", []),
                    "removed": (commit_data or {}).get("removed", []),
                    "modified": (commit_data or {}).get("modified", []),
                }
                commit_hash = (commit_data or {}).get("id")
                if not commit_hash:
                    continue

                existing_commit = (
                    db.query(models.Commit)
                    .filter(models.Commit.commit_hash == commit_hash)
                    .first()
                )
                if existing_commit:
                    continue

                embedding = generate_embedding(commit_msg)
                timestamp = (commit_data or {}).get("timestamp")
                if timestamp:
                    timestamp = _parse_iso(str(timestamp))

                db_commit = models.Commit(
                    project_id=project.id,
                    commit_hash=commit_hash,
                    message=commit_msg,
                    author=((commit_data or {}).get("author") or {}).get("name", "Unknown"),
                    timestamp=timestamp or _utcnow(),
                    files_changed=json.dumps(files_changed),
                    embedding_vector=json.dumps(embedding) if embedding else None,
                )
                db.add(db_commit)
                db.commit()
                db.refresh(db_commit)

                for req in requirements:
                    sim_score = calculate_similarity(req.requirement_text, commit_msg)
                    if sim_score > 0.4:
                        confidence = (
                            "high" if sim_score > 0.7
                            else ("medium" if sim_score > 0.5 else "low")
                        )
                        db.add(
                            models.TraceLink(
                                requirement_id=req.id,
                                commit_id=db_commit.id,
                                similarity_score=sim_score,
                                confidence_level=confidence,
                            )
                        )
                        if sim_score > 0.8:
                            req.status = "fulfilled"
                        elif req.status == "not_started" and sim_score > 0.6:
                            req.status = "in_progress"
                db.commit()

            metrics = db.query(models.Metrics).filter(
                models.Metrics.project_id == project.id
            ).first()
            if not metrics:
                metrics = models.Metrics(project_id=project.id)
                db.add(metrics)
                db.commit()
                db.refresh(metrics)

            total_reqs = len(requirements)
            fulfilled_reqs = sum(1 for r in requirements if r.status == "fulfilled")
            trace_links = []
            req_ids_with_links: set = set()
            for req in requirements:
                links = db.query(models.TraceLink).filter(
                    models.TraceLink.requirement_id == req.id
                ).all()
                trace_links.extend(links)
                if links:
                    req_ids_with_links.add(req.id)

            deadline = project.deadline if project.deadline else (
                project.start_date + datetime.timedelta(days=30)
            )
            metrics.fulfillment_score = compute_fulfillment_score(total_reqs, fulfilled_reqs)
            metrics.drift_score = detect_requirement_drift(trace_links)
            metrics.delay_risk = predict_delay_risk(
                total_reqs, fulfilled_reqs, project.start_date, deadline
            )
            metrics.trust_score = compute_trust_score(
                fulfilled_reqs, total_reqs, metrics.drift_score
            )
            metrics.compliance_score = compute_compliance_readiness(
                total_reqs, len(req_ids_with_links)
            )
            db.commit()
            return jsonify({"status": "success", "processed_commits": len(raw_commits)})
    finally:
        db.close()


@app.get("/api/projects/<int:project_id>/traceability")
def get_traceability(project_id: int):
    """Returns a traceability matrix summary for a project."""
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return jsonify({"error": "not_found"}), 404

        requirements = (
            db.query(models.Requirement)
            .filter(models.Requirement.project_id == project_id)
            .order_by(models.Requirement.order_index.asc())
            .all()
        )

        total_reqs = len(requirements)
        all_links: list = []
        req_ids_with_links: set = set()

        req_list = []
        trace_link_list = []

        for req in requirements:
            links = (
                db.query(models.TraceLink)
                .filter(models.TraceLink.requirement_id == req.id)
                .all()
            )
            all_links.extend(links)
            if links:
                req_ids_with_links.add(req.id)

            req_list.append({
                "id": req.id,
                "text": req.requirement_text,
                "priority": req.priority,
                "status": req.status,
                "coverage_percentage": req.coverage_percentage,
                "linked_commit_count": len(links),
            })

            for link in links:
                trace_link_list.append({
                    "requirement_id": link.requirement_id,
                    "commit_id": link.commit_id,
                    "similarity_score": link.similarity_score,
                    "confidence_level": link.confidence_level,
                })

        linked_reqs = len(req_ids_with_links)
        coverage_pct = round((linked_reqs / total_reqs * 100.0) if total_reqs else 0.0, 1)

        return jsonify({
            "summary": {
                "project_id": project_id,
                "total_reqs": total_reqs,
                "linked_reqs": linked_reqs,
                "coverage_pct": coverage_pct,
            },
            "requirements": req_list,
            "trace_links": trace_link_list,
        })
    finally:
        db.close()


ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "freelancetrace-admin-2024")


@app.post("/auth/admin/signup")
def admin_signup():
    db = SessionLocal()
    try:
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""
        full_name = payload.get("full_name") or ""
        secret_key = payload.get("secret_key") or ""

        if secret_key != ADMIN_SECRET_KEY:
            return jsonify({"error": "Invalid admin secret key"}), 403
        if not email or "@" not in email:
            return jsonify({"error": "invalid_email"}), 400
        if len(password) < 6:
            return jsonify({"error": "weak_password"}), 400

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            return jsonify({"error": "Email already registered"}), 400

        user = models.User(
            email=email,
            password_hash=generate_password_hash(password),
            full_name=full_name,
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = _issue_token(db, user)
        return jsonify({
            "token": token,
            "user": {"id": str(user.id), "email": user.email},
            "profile": _serialize_profile(user),
        })
    finally:
        db.close()


@app.get("/admin/profiles")
def admin_list_profiles():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error
        if user.role != "admin":
            return jsonify({"error": "forbidden"}), 403
        role = request.args.get("role")
        query = db.query(models.User)
        if role and role != "all":
            query = query.filter(models.User.role == role)
        users = query.order_by(models.User.created_at.desc()).all()
        return jsonify([_serialize_profile(u) for u in users])
    finally:
        db.close()


@app.patch("/admin/profiles/<int:user_id>")
def admin_update_profile(user_id: int):
    db = SessionLocal()
    try:
        admin, error = _require_user(db)
        if error:
            return error
        if admin.role != "admin":
            return jsonify({"error": "forbidden"}), 403
        target = db.query(models.User).filter(models.User.id == user_id).first()
        if not target:
            return jsonify({"error": "not_found"}), 404
        payload = request.get_json(silent=True) or {}
        for key in ("is_suspended", "is_verified", "role"):
            if key in payload:
                setattr(target, key, payload[key])
        target.updated_at = _utcnow()
        db.commit()
        db.refresh(target)
        return jsonify(_serialize_profile(target))
    finally:
        db.close()


@app.get("/admin/stats")
def admin_stats():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error
        if user.role != "admin":
            return jsonify({"error": "forbidden"}), 403

        from sqlalchemy import func
        users = db.query(models.User).all()
        projects = db.query(models.Project).all()
        bids = db.query(models.Bid).all()

        total_users = len(users)
        clients = sum(1 for u in users if u.role == "client")
        freelancers = sum(1 for u in users if u.role == "freelancer")
        verified = sum(1 for u in users if u.is_verified)
        suspended = sum(1 for u in users if u.is_suspended)

        status_counts = {}
        for p in projects:
            status_counts[p.status] = status_counts.get(p.status, 0) + 1

        domain_counts = {}
        for p in projects:
            if p.domain:
                domain_counts[p.domain] = domain_counts.get(p.domain, 0) + 1

        total_budget = sum((p.budget_max or 0) for p in projects if p.status == "completed")

        # Monthly project creation for last 6 months
        import datetime as dt
        monthly = []
        for i in range(5, -1, -1):
            d = _utcnow() - dt.timedelta(days=30 * i)
            month_start = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)
            count = sum(
                1 for p in projects
                if p.created_at and month_start <= (p.created_at.replace(tzinfo=dt.timezone.utc) if p.created_at.tzinfo is None else p.created_at) < month_end
            )
            new_users = sum(
                1 for u in users
                if u.created_at and month_start <= (u.created_at.replace(tzinfo=dt.timezone.utc) if u.created_at.tzinfo is None else u.created_at) < month_end
            )
            monthly.append({"month": d.strftime("%b"), "projects": count, "users": new_users})

        # Bid stats
        avg_bids_per_project = round(len(bids) / max(len(projects), 1), 1)
        accepted_bids = sum(1 for b in bids if b.status == "accepted")

        return jsonify({
            "users": {"total": total_users, "clients": clients, "freelancers": freelancers, "verified": verified, "suspended": suspended},
            "projects": {"total": len(projects), "by_status": status_counts, "by_domain": domain_counts, "total_budget": total_budget},
            "bids": {"total": len(bids), "accepted": accepted_bids, "avg_per_project": avg_bids_per_project},
            "monthly": monthly,
        })
    finally:
        db.close()


def _serialize_notification(notification: models.Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "project_id": notification.project_id,
        "is_read": notification.is_read,
        "created_at": _iso(notification.created_at),
        "expires_at": _iso(notification.expires_at),
    }


@app.get("/notifications")
def get_notifications():
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        unread_only = request.args.get("unread_only", "").lower() == "true"

        query = db.query(models.Notification).filter(
            models.Notification.user_id == user.id
        )

        if unread_only:
            query = query.filter(models.Notification.is_read == False)

        notifications = query.order_by(models.Notification.created_at.desc()).all()

        unread_count = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == user.id,
                models.Notification.is_read == False,
            )
            .count()
        )

        return jsonify({
            "notifications": [_serialize_notification(n) for n in notifications],
            "unread_count": unread_count,
        })
    finally:
        db.close()


@app.patch("/notifications/<int:notification_id>/read")
def mark_notification_read(notification_id: int):
    db = SessionLocal()
    try:
        user, error = _require_user(db)
        if error:
            return error

        notification = (
            db.query(models.Notification)
            .filter(models.Notification.id == notification_id)
            .first()
        )
        if not notification:
            return jsonify({"error": "not_found"}), 404

        if notification.user_id != user.id:
            return jsonify({"error": "forbidden"}), 403

        notification.is_read = True
        db.commit()
        db.refresh(notification)

        return jsonify({"notification": _serialize_notification(notification)})
    finally:
        db.close()


@app.get("/fix_deps")
def fix_deps():
    import sys
    import subprocess
    packages = ["pdfplumber", "google-generativeai", "python-docx"]
    try:
        res = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--no-input"] + packages,
            capture_output=True,
            text=True
        )
        return jsonify({
            "status": "success" if res.returncode == 0 else "error",
            "stdout": res.stdout,
            "stderr": res.stderr,
            "exit_code": res.returncode
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    # Auto-migrate SQLite schema for classifier update
    try:
        from sqlalchemy import text
        from database import engine
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE requirements ADD COLUMN requirement_type VARCHAR DEFAULT 'FR'"))
                conn.commit()
                print("[Auto-Migration] Success: Added requirement_type column to requirements table")
            except Exception as e:
                # OperationalError typically happens if already applied
                print(f"[Auto-Migration] Information or already exists: {e}")
    except Exception as e:
         print(f"[Auto-Migration] Error trigger failed: {e}")

    app.run(host="0.0.0.0", port=8000, debug=True)
