"""
FreelanceTrace – GitHub Webhook Handler
Parses incoming GitHub push and pull_request webhook payloads,
validates HMAC signatures, and queues commit data for the traceability engine.

Register this with GitHub as:
    https://<your-backend>/github/webhook

Environment variables required:
    GITHUB_WEBHOOK_SECRET  -- the secret you configured in GitHub webhook settings
"""

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def verify_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    Verify that the incoming webhook payload was signed by GitHub using
    the configured GITHUB_WEBHOOK_SECRET.
    signature_header : value of the X-Hub-Signature-256 HTTP header
    """
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        logger.warning("GITHUB_WEBHOOK_SECRET not set -- skipping signature check")
        return True  # Allow in dev; set secret in production

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_sig = "sha256=" + hmac.new(
        secret.encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_sig, signature_header)


# ---------------------------------------------------------------------------
# Payload parsing helpers
# ---------------------------------------------------------------------------

def _parse_commit(raw: dict, repo_full_name: str) -> dict:
    """Extract relevant fields from a single commit object in a push payload."""
    added = raw.get("added", [])
    modified = raw.get("modified", [])
    removed = raw.get("removed", [])
    all_files = added + modified + removed

    ts_str = raw.get("timestamp", "")
    try:
        committed_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        committed_at = datetime.now(timezone.utc)

    return {
        "sha": raw.get("id", ""),
        "message": (raw.get("message") or "").strip(),
        "author_name": raw.get("author", {}).get("name", ""),
        "author_email": raw.get("author", {}).get("email", ""),
        "committed_at": committed_at,
        "files_changed": all_files,
        "lines_added": 0,
        "lines_deleted": 0,
        "lines_changed": 0,
        "repo": repo_full_name,
        "embedding_json": None,
    }


# ---------------------------------------------------------------------------
# Public event handlers
# ---------------------------------------------------------------------------

def handle_push_event(payload: dict) -> Optional[List[dict]]:
    """
    Process a GitHub 'push' webhook event.
    Returns a list of commit dicts to forward to the traceability engine,
    or None if the push is to an untracked branch.
    """
    ref = payload.get("ref", "")
    tracked_branches = {"refs/heads/main", "refs/heads/master"}
    if ref not in tracked_branches and not ref.startswith("refs/heads/feature/"):
        logger.debug("Ignoring push to untracked ref: %s", ref)
        return None

    repo_full_name = payload.get("repository", {}).get("full_name", "unknown/unknown")
    raw_commits = payload.get("commits", [])

    commits = [_parse_commit(c, repo_full_name) for c in raw_commits]
    logger.info("Push event: %s -- %d commit(s) on %s", repo_full_name, len(commits), ref)
    return commits


def handle_pull_request_event(payload: dict) -> Optional[dict]:
    """
    Process a GitHub 'pull_request' webhook event.
    Returns a PR summary dict for opened/synchronised/merged PRs, else None.
    """
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "closed"):
        return None

    pr = payload.get("pull_request", {})
    merged = action == "closed" and pr.get("merged", False)

    return {
        "pr_number": pr.get("number"),
        "title": pr.get("title", ""),
        "body": pr.get("body", "") or "",
        "state": "merged" if merged else pr.get("state", ""),
        "author_login": pr.get("user", {}).get("login", ""),
        "base_branch": pr.get("base", {}).get("ref", ""),
        "head_branch": pr.get("head", {}).get("ref", ""),
        "created_at": pr.get("created_at"),
        "updated_at": pr.get("updated_at"),
        "merged_at": pr.get("merged_at"),
        "repo": payload.get("repository", {}).get("full_name", ""),
        "action": action,
    }
