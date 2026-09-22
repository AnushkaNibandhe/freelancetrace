import hashlib
import hmac
import os
import threading
import logging
import json
import time
from datetime import datetime, timezone
import jwt
import httpx
from flask import Blueprint, request, jsonify

from database import SessionLocal
import models
import nlp_engine

bp = Blueprint("github", __name__)
logger = logging.getLogger(__name__)


def verify_signature(payload_bytes: bytes, signature_header: str) -> bool:
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        logger.warning("GITHUB_WEBHOOK_SECRET not set")
        return True  # allow in dev if secret not configured yet
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _get_installation_token(installation_id: str) -> str:
    app_id = os.environ.get("GITHUB_APP_ID")
    pem_path = "github_app.pem"
    if not app_id or not os.path.exists(pem_path):
        return ""
    
    with open(pem_path, "r") as f:
        cert_bytes = f.read()
    
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": app_id
    }
    encoded_jwt = jwt.encode(payload, cert_bytes, algorithm="RS256")
    
    headers = {
        "Authorization": f"Bearer {encoded_jwt}",
        "Accept": "application/vnd.github+json"
    }
    try:
        resp = httpx.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers=headers,
            timeout=10.0
        )
        if resp.status_code == 201:
            return resp.json().get("token", "")
    except Exception as e:
        logger.error(f"Error fetching installation token: {e}")
    return ""


def _get_project_id(db, repo_full_name: str) -> int | None:
    if "/" in repo_full_name:
        owner, repo_name = repo_full_name.split("/", 1)
        repo = db.query(models.GitHubRepository).filter(
            models.GitHubRepository.owner == owner,
            models.GitHubRepository.repo_name == repo_name
        ).first()
    else:
        repo = db.query(models.GitHubRepository).filter(
            models.GitHubRepository.repo_name == repo_full_name
        ).first()
    return repo.project_id if repo else None


def _process_push(payload: dict, project_id: int):
    db = SessionLocal()
    try:
        ref = payload.get("ref", "")
        branch_name = ref.replace("refs/heads/", "")
        repo_full_name = payload.get("repository", {}).get("full_name", "")
        commits = payload.get("commits", [])
        
        installation_id = payload.get("installation", {}).get("id")
        token = _get_installation_token(str(installation_id)) if installation_id else ""
        
        owner, repo_name = repo_full_name.split("/", 1) if "/" in repo_full_name else ("", repo_full_name)
        
        for commit_data in commits:
            commit_sha = commit_data.get("id")
            commit_msg = commit_data.get("message", "")
            added = commit_data.get("added", [])
            modified = commit_data.get("modified", [])
            file_paths = added + modified
            tokenized_paths = " ".join([" ".join(fp.replace("/", " ").replace("_", " ").replace("-", " ").replace(".", " ").split()) for fp in file_paths])
            
            enrichment_parts = [commit_msg, f"Branch: {branch_name}", f"Files: {tokenized_paths}"]
            
            # Fetch patch
            patch_texts = []
            if token and owner and repo_name and commit_sha:
                headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
                try:
                    resp = httpx.get(f"https://api.github.com/repos/{owner}/{repo_name}/commits/{commit_sha}", headers=headers, timeout=10.0)
                    if resp.status_code == 200:
                        detailed_commit = resp.json()
                        files = detailed_commit.get("files", [])
                        for f in files:
                            patch = f.get("patch", "")
                            if patch:
                                patch_texts.append(patch[:200])
                except Exception as e:
                    logger.error(f"Failed to fetch commit patch: {e}")
                            
            if patch_texts:
                enrichment_parts.append("Patch Context: " + " ".join(patch_texts))
                
            embedding_text = " | ".join(enrichment_parts)
            embedding_vector = nlp_engine.generate_embedding(embedding_text)
            
            existing_commit = db.query(models.Commit).filter(
                models.Commit.project_id == project_id,
                models.Commit.commit_hash == commit_sha
            ).first()
            
            if existing_commit:
                existing_commit.embedding_text = embedding_text
                existing_commit.embedding_vector = json.dumps(embedding_vector) if embedding_vector else None
            else:
                ts_str = commit_data.get("timestamp", "")
                try:
                    committed_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    committed_at = datetime.now(timezone.utc)

                new_commit = models.Commit(
                    project_id=project_id,
                    commit_hash=commit_sha,
                    message=commit_msg,
                    timestamp=committed_at,
                    author=commit_data.get("author", {}).get("name", ""),
                    files_changed=json.dumps({"added": added, "modified": modified, "removed": commit_data.get("removed", [])}),
                    embedding_text=embedding_text,
                    embedding_vector=json.dumps(embedding_vector) if embedding_vector else None
                )
                db.add(new_commit)
        db.commit()
    except Exception as e:
        logger.error(f"Error processing push event: {e}")
    finally:
        db.close()


def _process_pull_request(payload: dict, project_id: int):
    db = SessionLocal()
    try:
        action = payload.get("action", "")
        pr = payload.get("pull_request", {})
        merged = (action == "closed" and pr.get("merged") is True)
        
        pr_number = pr.get("number")
        title = pr.get("title") or ""
        body = pr.get("body") or ""
        head_ref = pr.get("head", {}).get("ref", "")
        base_ref = pr.get("base", {}).get("ref", "")
        repo_full_name = payload.get("repository", {}).get("full_name", "")
        
        # Build embedding text
        embedding_text = f"{title}. {body}. Branch: {head_ref}"
        
        # Upsert PullRequest
        existing_pr = db.query(models.PullRequest).filter(
            models.PullRequest.project_id == project_id,
            models.PullRequest.pr_number == pr_number,
            models.PullRequest.repo == repo_full_name
        ).first()
        
        if not existing_pr:
            existing_pr = models.PullRequest(
                pr_number=pr_number,
                project_id=project_id,
                repo=repo_full_name,
                title=title,
                body=body,
                head_ref=head_ref,
                base_ref=base_ref,
                merged=merged,
                embedding_text=embedding_text
            )
            db.add(existing_pr)
        else:
            existing_pr.title = title
            existing_pr.body = body
            existing_pr.head_ref = head_ref
            existing_pr.base_ref = base_ref
            existing_pr.merged = merged
            existing_pr.embedding_text = embedding_text
        
        if merged:
            merged_at_str = pr.get("merged_at")
            if merged_at_str:
                try:
                    existing_pr.merged_at = datetime.fromisoformat(merged_at_str.replace("Z", "+00:00"))
                except Exception:
                    pass

            commits_url = pr.get("commits_url")
            installation_id = payload.get("installation", {}).get("id")
            if commits_url and installation_id:
                token = _get_installation_token(str(installation_id))
                headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
                try:
                    resp = httpx.get(commits_url, headers=headers, timeout=10.0)
                    if resp.status_code == 200:
                        pr_commits = resp.json()
                        commit_shas = [c.get("sha") for c in pr_commits if c.get("sha")]
                        if commit_shas:
                            db_commits = db.query(models.Commit).filter(
                                models.Commit.project_id == project_id,
                                models.Commit.commit_hash.in_(commit_shas)
                            ).all()
                            for c in db_commits:
                                c.is_merged = True
                                for tl in c.trace_links:
                                    tl.is_merged = True
                except Exception as e:
                    logger.error(f"Error fetching PR commits: {e}")
        db.commit()
    except Exception as e:
        logger.error(f"Error processing PR: {e}")
    finally:
        db.close()


def _process_create_branch(payload: dict, project_id: int):
    db = SessionLocal()
    try:
        ref_type = payload.get("ref_type", "")
        if ref_type != "branch":
            return
        
        ref = payload.get("ref", "")
        repo_full_name = payload.get("repository", {}).get("full_name", "")
        
        tokens = ref.replace("-", " ").replace("_", " ")
        
        reqs = db.query(models.Requirement).filter(models.Requirement.project_id == project_id).all()
        scored_reqs = []
        for req in reqs:
            sim = nlp_engine.calculate_similarity(req.requirement_text, tokens)
            scored_reqs.append((sim, req.id))
            
        scored_reqs.sort(reverse=True, key=lambda x: x[0])
        top_3 = [{"requirement_id": r[1], "similarity": r[0]} for r in scored_reqs[:3]]
        
        new_branch = models.Branch(
            name=ref,
            project_id=project_id,
            repo=repo_full_name,
            branch_hints=top_3
        )
        db.add(new_branch)
        db.commit()
    except Exception as e:
        logger.error(f"Error processing create event: {e}")
    finally:
        db.close()


@bp.route("/github/webhook", methods=["POST"])
def github_webhook():
    raw = request.get_data()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if not verify_signature(raw, sig):
        logger.warning("Invalid webhook signature")
        return jsonify({"error": "invalid signature"}), 403

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.get_json(force=True)

    logger.info("GitHub event received: %s", event)

    repo_full_name = payload.get("repository", {}).get("full_name", "")
    if not repo_full_name:
        return jsonify({"status": "ignored", "reason": "no repository full_name"}), 200

    db = SessionLocal()
    project_id = _get_project_id(db, repo_full_name)
    db.close()

    if not project_id:
        return jsonify({"status": "ignored", "reason": "repository not mapped to any project"}), 200

    if event == "push":
        commits = payload.get("commits", [])
        logger.info("Push to %s — %d commit(s)", repo_full_name, len(commits))
        t = threading.Thread(target=_process_push, args=(payload, project_id))
        t.start()
        return jsonify({"status": "ok", "commits_received": len(commits)}), 200

    if event == "pull_request":
        action = payload.get("action", "")
        logger.info("PR %s", action)
        if action in ["opened", "synchronize", "closed"]:
            t = threading.Thread(target=_process_pull_request, args=(payload, project_id))
            t.start()
        return jsonify({"status": "ok"}), 200

    if event == "create":
        ref_type = payload.get("ref_type", "")
        if ref_type == "branch":
            t = threading.Thread(target=_process_create_branch, args=(payload, project_id))
            t.start()
        return jsonify({"status": "ok"}), 200

    return jsonify({"status": "ignored", "event": event}), 200