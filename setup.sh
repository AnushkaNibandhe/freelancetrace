#!/usr/bin/env bash
# =============================================================================
#  FreelanceTrace – NLP Layer Setup Script
#  Run from the ROOT of your freelancetrace repo:
#      bash setup.sh
#
#  What this script does:
#    1. Creates the full backend/services/ directory tree
#    2. Writes every NLP source file with complete code
#    3. Creates requirements_nlp.txt
#    4. Creates __init__.py package markers
#    5. Sets up + activates a Python venv
#    6. Installs all dependencies
#    7. Downloads the spaCy language model
#    8. Runs a smoke-test to confirm every module imports cleanly
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}━━━  $*  ━━━${RESET}"; }

# ── Guard: must be run from repo root ─────────────────────────────────────────
if [ ! -d "backend" ]; then
  error "No 'backend/' directory found. Run this script from the FreelanceTrace repo root."
fi

# =============================================================================
# STEP 1 – Directory structure
# =============================================================================
section "STEP 1 / 8 — Creating directory structure"

mkdir -p backend/services/nlp
mkdir -p backend/services/analytics
mkdir -p backend/services/vcs

success "Directory tree created"

# =============================================================================
# STEP 2 – __init__.py package markers
# =============================================================================
section "STEP 2 / 8 — Writing package markers"

touch backend/services/__init__.py
touch backend/services/nlp/__init__.py
touch backend/services/analytics/__init__.py
touch backend/services/vcs/__init__.py

success "__init__.py files written"

# =============================================================================
# STEP 3 – requirements_nlp.txt
# =============================================================================
section "STEP 3 / 8 — Writing requirements_nlp.txt"

cat > backend/requirements_nlp.txt << 'REQEOF'
# FreelanceTrace – NLP Layer Python dependencies
# Install with:  pip install -r requirements_nlp.txt
# Then download the spaCy model:  python -m spacy download en_core_web_sm

# ── NLP core ───────────────────────────────────────────────
spacy>=3.7,<4.0
sentence-transformers>=2.6,<3.0
keybert>=0.8,<1.0
transformers>=4.38,<5.0
torch>=2.1

# ── Document parsing ───────────────────────────────────────
pdfplumber>=0.10,<1.0
python-docx>=1.1,<2.0

# ── Numerics ───────────────────────────────────────────────
numpy>=1.26,<2.0
scikit-learn>=1.4

# ── Web framework (existing) ───────────────────────────────
flask>=3.0
flask-cors>=4.0

# ── Database (existing) ────────────────────────────────────
sqlalchemy>=2.0
psycopg2-binary>=2.9

# ── Utilities ──────────────────────────────────────────────
python-dotenv>=1.0
requests>=2.31
REQEOF

success "requirements_nlp.txt written"

# =============================================================================
# STEP 4 – Write all NLP source files
# =============================================================================
section "STEP 4 / 8 — Writing NLP source files"

# ─────────────────────────────────────────────────────────────────────────────
# services/nlp/srs_parser.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/nlp/srs_parser.py << 'PYEOF'
"""
FreelanceTrace – SRS Parser
Extracts individual requirement statements from uploaded PDF / DOCX documents,
tags each with a unique ID, and persists them to the database.

Dependencies (add to requirements.txt):
    spacy>=3.7
    pdfplumber>=0.10
    python-docx>=1.1
    sentence-transformers>=2.6
    keybert>=0.8
    numpy>=1.26
    sqlalchemy>=2.0

Run once to download the spaCy model:
    python -m spacy download en_core_web_sm
"""

import re
import uuid
import logging
from pathlib import Path
from typing import List, Tuple

import pdfplumber
import spacy
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# spaCy model (loaded lazily so import doesn't crash if model is absent)
# ---------------------------------------------------------------------------
_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError(
                "spaCy model not found. Run:  python -m spacy download en_core_web_sm"
            )
    return _nlp


# ---------------------------------------------------------------------------
# Raw text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file using pdfplumber."""
    text_parts: List[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            raw = page.extract_text()
            if raw:
                text_parts.append(raw)
    return "\n".join(text_parts)


def extract_text_from_docx(file_path: str) -> str:
    """Extract all paragraph text from a DOCX file."""
    doc = DocxDocument(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_text(file_path: str) -> str:
    """Auto-detect file type and extract text."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(file_path)
    elif suffix in (".docx", ".doc"):
        return extract_text_from_docx(file_path)
    elif suffix in (".txt", ".md"):
        return path.read_text(encoding="utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


# ---------------------------------------------------------------------------
# Requirement heuristics
# ---------------------------------------------------------------------------

_REQ_KEYWORDS = re.compile(
    r"\b(shall|must|should|will|need to|is required to|has to"
    r"|the system|the application|the platform|the user|the client"
    r"|FR-|NFR-|REQ-|requirement)\b",
    re.IGNORECASE,
)

_MIN_WORDS = 6
_MAX_WORDS = 120


def _is_requirement_sentence(sentence: str) -> bool:
    word_count = len(sentence.split())
    if word_count < _MIN_WORDS or word_count > _MAX_WORDS:
        return False
    return bool(_REQ_KEYWORDS.search(sentence))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_srs(file_path: str, project_id: str) -> List[dict]:
    """
    Parse an SRS document and return a list of requirement dicts.

    Each dict has:
        req_id      – stable UUID for this requirement
        project_id  – foreign key to the project
        text        – cleaned requirement sentence
        section     – best-guess section heading (or "General")
        keywords    – comma-separated key phrases (populated by keyword_extractor)
        embedding   – None (filled later by embedding_service)
    """
    raw_text = extract_text(file_path)
    nlp = _get_nlp()

    requirements: List[dict] = []
    current_section = "General"

    for block in raw_text.split("\n"):
        block = block.strip()
        if not block:
            continue

        if _is_section_heading(block):
            current_section = block.rstrip(":")
            continue

        doc = nlp(block)
        for sent in doc.sents:
            text = sent.text.strip()
            if _is_requirement_sentence(text):
                requirements.append(
                    {
                        "req_id": str(uuid.uuid4()),
                        "project_id": project_id,
                        "text": text,
                        "section": current_section,
                        "keywords": "",
                        "embedding": None,
                    }
                )

    logger.info("Parsed %d requirements from %s", len(requirements), file_path)
    return requirements


def _is_section_heading(line: str) -> bool:
    """Heuristic: short line that looks like a heading."""
    stripped = line.rstrip(":")
    if len(stripped.split()) > 8:
        return False
    if stripped.isupper():
        return True
    if re.match(r"^\d+(\.\d+)*\s+\w", stripped):
        return True
    return False
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# services/nlp/embedding_service.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/nlp/embedding_service.py << 'PYEOF'
"""
FreelanceTrace – Embedding Service
Encodes text (SRS requirements or commit messages) into dense vectors
using Sentence-BERT (SBERT).  Vectors are stored as JSON-serialised float
lists in the database and loaded back for cosine similarity computations.

Model used: all-MiniLM-L6-v2  (fast, 384-dim, good semantic quality)
Swap to "all-mpnet-base-v2" for higher accuracy at the cost of speed.
"""

import json
import logging
import numpy as np
from typing import List, Union

logger = logging.getLogger(__name__)

_model = None
MODEL_NAME = "all-MiniLM-L6-v2"


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading SBERT model: %s", MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
    return _model


# ---------------------------------------------------------------------------
# Encoding
# ---------------------------------------------------------------------------

def encode(texts: Union[str, List[str]]) -> np.ndarray:
    """
    Encode one or more texts into L2-normalised sentence embeddings.

    Returns np.ndarray  shape (N, 384) for a list, or (384,) for a single string.
    """
    single = isinstance(texts, str)
    if single:
        texts = [texts]
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors[0] if single else vectors


def encode_to_json(text: str) -> str:
    """Encode a single text and return a JSON string for database storage."""
    vec = encode(text)
    return json.dumps(vec.tolist())


def decode_from_json(json_str: str) -> np.ndarray:
    """Restore a numpy vector from its JSON representation."""
    return np.array(json.loads(json_str), dtype=np.float32)


# ---------------------------------------------------------------------------
# Similarity
# ---------------------------------------------------------------------------

def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Cosine similarity between two L2-normalised vectors.
    Since vectors are already normalised, this is just the dot product.
    Returns a float in [-1, 1]; values > 0.45 indicate semantic relatedness.
    """
    return float(np.dot(vec_a, vec_b))


def top_k_similar(
    query_vec: np.ndarray,
    candidate_vecs: List[np.ndarray],
    candidate_ids: List[str],
    k: int = 5,
    threshold: float = 0.40,
) -> List[dict]:
    """
    Return the top-k candidates most similar to the query vector.

    Parameters
    ----------
    query_vec      : encoded query (e.g. a commit message embedding)
    candidate_vecs : list of encoded candidates (e.g. requirement embeddings)
    candidate_ids  : matching IDs for candidates
    k              : max results to return
    threshold      : minimum cosine similarity to include a result

    Returns List of dicts: [{"id": ..., "score": float}, ...]  sorted descending.
    """
    scores = [
        {"id": cid, "score": cosine_similarity(query_vec, cvec)}
        for cid, cvec in zip(candidate_ids, candidate_vecs)
    ]
    filtered = [s for s in scores if s["score"] >= threshold]
    filtered.sort(key=lambda x: x["score"], reverse=True)
    return filtered[:k]


# ---------------------------------------------------------------------------
# Batch helpers used by the traceability engine
# ---------------------------------------------------------------------------

def embed_requirements(requirements: List[dict]) -> List[dict]:
    """
    Add an 'embedding_json' key to each requirement dict (in place) and return.
    Input dicts must have a 'text' key.
    """
    texts = [r["text"] for r in requirements]
    vecs = encode(texts)
    for req, vec in zip(requirements, vecs):
        req["embedding_json"] = json.dumps(vec.tolist())
    return requirements


def embed_commit(commit_message: str, file_paths: List[str] = None) -> np.ndarray:
    """
    Encode a commit for matching against requirements.
    Optionally appends file path tokens to the message for richer context.
    """
    enriched = commit_message
    if file_paths:
        path_tokens = " ".join(
            p.replace("/", " ").replace("_", " ").replace("-", " ").replace(".", " ")
            for p in file_paths
        )
        enriched = f"{commit_message} {path_tokens}"
    return encode(enriched)
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# services/nlp/keyword_extractor.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/nlp/keyword_extractor.py << 'PYEOF'
"""
FreelanceTrace – Keyword Extractor
Extracts domain-relevant keyphrases from SRS requirement text using KeyBERT.
Keywords are stored alongside each requirement and used to build a lightweight
inverted index for fast pre-filtering before full cosine similarity.
"""

import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

_kw_model = None


def _get_model():
    global _kw_model
    if _kw_model is None:
        from keybert import KeyBERT
        logger.info("Loading KeyBERT model...")
        _kw_model = KeyBERT(model="all-MiniLM-L6-v2")
    return _kw_model


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_keywords(text: str, top_n: int = 6) -> List[Tuple[str, float]]:
    """
    Extract up to `top_n` keyphrases from a requirement sentence.

    Returns List of (phrase, score) tuples, e.g.
        [("user authentication", 0.82), ("login form", 0.71), ...]
    """
    model = _get_model()
    try:
        keywords = model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            use_mmr=True,
            diversity=0.5,
            top_n=top_n,
        )
        return keywords
    except Exception as exc:
        logger.warning("KeyBERT extraction failed for text '%s...': %s", text[:40], exc)
        return []


def keywords_to_string(keywords: List[Tuple[str, float]]) -> str:
    """Serialise keyword list to a comma-separated string for DB storage."""
    return ", ".join(phrase for phrase, _ in keywords)


def enrich_requirements(requirements: List[dict]) -> List[dict]:
    """
    Add 'keywords' string to each requirement dict (in place) and return.
    Input dicts must have a 'text' key.
    """
    for req in requirements:
        kws = extract_keywords(req["text"])
        req["keywords"] = keywords_to_string(kws)
    return requirements


def keyword_overlap_score(req_keywords: str, commit_message: str) -> float:
    """
    Fast pre-filter: fraction of requirement keywords present in commit message.
    Returns 0.0-1.0. Use as a cheap gate before cosine similarity.
    """
    if not req_keywords:
        return 0.0
    req_kw_list = [k.strip().lower() for k in req_keywords.split(",") if k.strip()]
    msg_lower = commit_message.lower()
    matches = sum(1 for kw in req_kw_list if kw in msg_lower)
    return matches / len(req_kw_list) if req_kw_list else 0.0
PYEOF

success "NLP service files written  (srs_parser, embedding_service, keyword_extractor)"

# ─────────────────────────────────────────────────────────────────────────────
# services/analytics/fulfillment.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/analytics/fulfillment.py << 'PYEOF'
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
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# services/analytics/drift_detector.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/analytics/drift_detector.py << 'PYEOF'
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
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# services/analytics/risk_predictor.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/analytics/risk_predictor.py << 'PYEOF'
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
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# services/analytics/reputation.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/analytics/reputation.py << 'PYEOF'
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
PYEOF

success "Analytics files written  (fulfillment, drift_detector, risk_predictor, reputation)"

# ─────────────────────────────────────────────────────────────────────────────
# services/vcs/webhook_handler.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/vcs/webhook_handler.py << 'PYEOF'
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
PYEOF

success "VCS file written  (webhook_handler)"

# ─────────────────────────────────────────────────────────────────────────────
# services/traceability_engine.py
# ─────────────────────────────────────────────────────────────────────────────
cat > backend/services/traceability_engine.py << 'PYEOF'
"""
FreelanceTrace – Traceability Engine
The central orchestrator that:
  1. Ingests new commits from the VCS webhook.
  2. Embeds commit messages via the embedding service.
  3. Matches each commit to SRS requirements using cosine similarity.
  4. Persists trace links to the database.
  5. Triggers fulfillment and drift recalculation.

This module is the glue between the NLP services and the database models.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from services.nlp.embedding_service import (
    embed_commit,
    decode_from_json,
    top_k_similar,
)
from services.analytics.fulfillment import calculate_fcs
from services.analytics.drift_detector import detect_drift_for_requirement

logger = logging.getLogger(__name__)

# Minimum cosine similarity for a commit to be considered linked to a requirement
LINK_THRESHOLD = 0.40

# How many requirements a single commit can be linked to at most
MAX_LINKS_PER_COMMIT = 4


# ---------------------------------------------------------------------------
# In-memory store (replace with SQLAlchemy calls in production)
# ---------------------------------------------------------------------------
# In production, import from database and models:
#   from database import SessionLocal
#   from models import Requirement, Commit, TraceLink

_requirements_store: dict = {}
_commits_store: dict = {}
_trace_links_store: dict = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def register_requirements(project_id: str, requirements: List[dict]) -> None:
    """
    Store a project's requirements (after SRS parsing + embedding).
    Each req dict must have: req_id, text, embedding_json, keywords.
    """
    _requirements_store[project_id] = requirements
    logger.info("Registered %d requirements for project %s", len(requirements), project_id)


def ingest_commits(commits: List[dict], project_id: str) -> List[dict]:
    """
    Process a batch of new commits:
      - Embed each commit message (+ file paths for richer context).
      - Match to requirements via cosine similarity.
      - Persist trace links.
      - Return list of newly created link dicts.

    commits : list of dicts from webhook_handler (must have sha, message, files_changed)
    """
    requirements = _requirements_store.get(project_id, [])
    if not requirements:
        logger.warning("No requirements found for project %s -- skipping tracing", project_id)
        return []

    req_ids = [r["req_id"] for r in requirements]
    req_vecs = [decode_from_json(r["embedding_json"]) for r in requirements]

    new_links: List[dict] = []

    for commit in commits:
        commit_vec = embed_commit(
            commit["message"],
            file_paths=commit.get("files_changed", []),
        )
        commit["embedding_json"] = json.dumps(commit_vec.tolist())

        matches = top_k_similar(
            commit_vec, req_vecs, req_ids,
            k=MAX_LINKS_PER_COMMIT,
            threshold=LINK_THRESHOLD,
        )

        for match in matches:
            link = {
                "link_id": f"{commit['sha'][:8]}-{match['id'][:8]}",
                "project_id": project_id,
                "req_id": match["id"],
                "commit_sha": commit["sha"],
                "similarity": match["score"],
                "committed_at": commit.get("committed_at", datetime.now(timezone.utc)),
                "lines_changed": commit.get("lines_changed", 0),
                "auto_linked": True,
            }
            new_links.append(link)
            logger.debug(
                "Linked commit %s -> req %s (similarity=%.3f)",
                commit["sha"][:8], match["id"][:8], match["score"],
            )

    _commits_store.setdefault(project_id, []).extend(commits)
    _trace_links_store.setdefault(project_id, []).extend(new_links)

    logger.info(
        "Ingested %d commits -> %d new trace links for project %s",
        len(commits), len(new_links), project_id,
    )
    return new_links


def get_traceability_matrix(project_id: str) -> dict:
    """
    Return the full traceability matrix for a project.

    Returns dict with: requirements (without embedding vectors),
                       trace_links, summary (totals + coverage_pct)
    """
    requirements = _requirements_store.get(project_id, [])
    links = _trace_links_store.get(project_id, [])

    linked_req_ids = {lnk["req_id"] for lnk in links}

    clean_reqs = [
        {k: v for k, v in r.items() if k != "embedding_json"}
        for r in requirements
    ]

    total = len(requirements)
    linked = len(linked_req_ids)

    return {
        "requirements": clean_reqs,
        "trace_links": links,
        "summary": {
            "total_reqs": total,
            "linked_reqs": linked,
            "unlinked_reqs": total - linked,
            "coverage_pct": round(linked / total * 100, 1) if total else 0.0,
        },
    }


def recalculate_metrics(project_id: str, milestone_due: Optional[datetime] = None) -> dict:
    """
    Recompute FCS and drift for every requirement in the project.
    Called after each batch of commits is ingested.

    Returns dict of {req_id: {"fcs_result": ..., "drift_alert": ...}}
    """
    requirements = _requirements_store.get(project_id, [])
    all_links = _trace_links_store.get(project_id, [])
    all_commits = _commits_store.get(project_id, [])

    links_by_req: dict = {}
    for lnk in all_links:
        links_by_req.setdefault(lnk["req_id"], []).append(lnk)

    commits_by_req: dict = {}
    for lnk in all_links:
        sha = lnk["commit_sha"]
        commit = next((c for c in all_commits if c["sha"] == sha), None)
        if commit:
            commits_by_req.setdefault(lnk["req_id"], []).append(commit)

    results = {}
    for req in requirements:
        req_links = links_by_req.get(req["req_id"], [])
        req_commits = commits_by_req.get(req["req_id"], [])

        fcs_result = calculate_fcs(req_links, milestone_due=milestone_due)
        req["fcs"] = fcs_result["fcs"]

        drift_alert = None
        if req.get("embedding_json") and req_commits:
            drift_alert = detect_drift_for_requirement(req, req_commits)

        results[req["req_id"]] = {
            "fcs_result": fcs_result,
            "drift_alert": drift_alert.to_dict() if drift_alert else None,
        }

    return results
PYEOF

success "Traceability engine written"

# =============================================================================
# STEP 5 – Python virtual environment
# =============================================================================
section "STEP 5 / 8 — Setting up Python virtual environment"

cd backend

if [ ! -d "venv" ]; then
  python3 -m venv venv
  success "Virtual environment created at backend/venv"
else
  warn "Virtual environment already exists — skipping creation"
fi

# Activate
# shellcheck source=/dev/null
source venv/bin/activate
success "Virtual environment activated"

# =============================================================================
# STEP 6 – Install dependencies
# =============================================================================
section "STEP 6 / 8 — Installing Python dependencies"
info "This may take 3-8 minutes on first run (PyTorch + Transformers are large)..."

pip install --quiet --upgrade pip
pip install --quiet -r requirements_nlp.txt

success "All dependencies installed"

# =============================================================================
# STEP 7 – Download spaCy language model
# =============================================================================
section "STEP 7 / 8 — Downloading spaCy language model"

python -m spacy download en_core_web_sm --quiet
success "spaCy model en_core_web_sm downloaded"

# =============================================================================
# STEP 8 – Smoke test
# =============================================================================
section "STEP 8 / 8 — Running smoke tests"

python - << 'SMOKETEST'
import sys, os
sys.path.insert(0, os.path.abspath("."))  # ensure backend/ is on path

errors = []

# Test 1: spaCy
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    doc = nlp("The system shall allow users to log in.")
    print("  [PASS] spaCy model loaded and sentence parsing works")
except Exception as e:
    errors.append(f"spaCy: {e}")
    print(f"  [FAIL] spaCy: {e}")

# Test 2: SBERT embedding
try:
    from services.nlp.embedding_service import encode, cosine_similarity
    v1 = encode("User login authentication")
    v2 = encode("The system shall support secure login")
    sim = cosine_similarity(v1, v2)
    assert 0.0 < sim <= 1.0, f"Unexpected similarity value: {sim}"
    print(f"  [PASS] Embedding service OK (similarity={sim:.3f})")
except Exception as e:
    errors.append(f"Embedding: {e}")
    print(f"  [FAIL] Embedding: {e}")

# Test 3: KeyBERT keyword extraction
try:
    from services.nlp.keyword_extractor import extract_keywords
    kws = extract_keywords("The system shall provide secure user authentication via OAuth2.")
    assert len(kws) > 0, "No keywords extracted"
    print(f"  [PASS] KeyBERT OK (top keyword: '{kws[0][0]}')")
except Exception as e:
    errors.append(f"KeyBERT: {e}")
    print(f"  [FAIL] KeyBERT: {e}")

# Test 4: Fulfillment calculator
try:
    from services.analytics.fulfillment import calculate_fcs
    result = calculate_fcs([{"similarity": 0.75, "lines_changed": 120}])
    assert "fcs" in result, "No fcs key in result"
    print(f"  [PASS] Fulfillment calculator OK (fcs={result['fcs']})")
except Exception as e:
    errors.append(f"Fulfillment: {e}")
    print(f"  [FAIL] Fulfillment: {e}")

# Test 5: Risk predictor
try:
    from services.analytics.risk_predictor import predict_delay_risk
    from datetime import datetime, timezone, timedelta
    result = predict_delay_risk(
        requirements=[{"fcs": 0.3, "priority": 1}],
        fcs_snapshots=[
            {"date": datetime.now(timezone.utc) - timedelta(days=5), "total_fcs": 1.0},
            {"date": datetime.now(timezone.utc), "total_fcs": 1.5},
        ],
        deadline=datetime.now(timezone.utc) + timedelta(days=10),
    )
    assert result["risk_level"] in ("low","medium","high","critical")
    print(f"  [PASS] Risk predictor OK (risk_level={result['risk_level']})")
except Exception as e:
    errors.append(f"Risk predictor: {e}")
    print(f"  [FAIL] Risk predictor: {e}")

# Test 6: Trust score
try:
    from services.analytics.reputation import calculate_trust_score
    result = calculate_trust_score("dev_001", [
        {"milestone_fcs_list": [0.8, 0.7], "drift_alerts": [],
         "feedback_response_hours": [3.0], "on_time_flags": [True],
         "compliance_scores": [0.9]}
    ])
    assert 0 <= result["trust_score"] <= 100
    print(f"  [PASS] Trust score OK (score={result['trust_score']}, level={result['trust_level']})")
except Exception as e:
    errors.append(f"Trust score: {e}")
    print(f"  [FAIL] Trust score: {e}")

# Test 7: Webhook handler
try:
    from services.vcs.webhook_handler import handle_push_event
    fake_payload = {
        "ref": "refs/heads/main",
        "repository": {"full_name": "test/repo"},
        "commits": [{
            "id": "abc123def456",
            "message": "Implement user login endpoint",
            "author": {"name": "Dev", "email": "dev@test.com"},
            "timestamp": "2024-01-01T10:00:00Z",
            "added": ["src/auth/login.py"], "modified": [], "removed": []
        }]
    }
    commits = handle_push_event(fake_payload)
    assert commits and len(commits) == 1
    print(f"  [PASS] Webhook handler OK (parsed {len(commits)} commit)")
except Exception as e:
    errors.append(f"Webhook: {e}")
    print(f"  [FAIL] Webhook: {e}")

# Summary
print()
if errors:
    print(f"RESULT: {len(errors)} test(s) failed:")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
else:
    print("RESULT: All 7 smoke tests passed. NLP layer is ready.")
SMOKETEST

# =============================================================================
# DONE
# =============================================================================

cd ..

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  FreelanceTrace NLP Layer — Setup Complete!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Files created under ${CYAN}backend/services/${RESET}:"
echo "    nlp/srs_parser.py"
echo "    nlp/embedding_service.py"
echo "    nlp/keyword_extractor.py"
echo "    analytics/fulfillment.py"
echo "    analytics/drift_detector.py"
echo "    analytics/risk_predictor.py"
echo "    analytics/reputation.py"
echo "    vcs/webhook_handler.py"
echo "    traceability_engine.py"
echo ""
echo -e "  ${YELLOW}Next steps:${RESET}"
echo "    1. Add GITHUB_WEBHOOK_SECRET to backend/.env"
echo "    2. Register /github/webhook route in your Flask main.py"
echo "    3. Wire parse_srs() into your project creation endpoint"
echo "    4. Run:  ngrok http 8000  (for local GitHub webhook delivery)"
echo "    5. Configure the GitHub webhook to point at your ngrok URL"
echo ""
echo -e "  See ${CYAN}FreelanceTrace_NLP_Setup_Guide.docx${RESET} for full integration code snippets."
echo ""
