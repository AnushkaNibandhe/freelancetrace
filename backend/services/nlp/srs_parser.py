"""
FreelanceTrace – SRS Parser v2
Replace backend/services/nlp/srs_parser.py with this file.

What changed vs v1
------------------
Fix 1 – Line-break rejoining
    PDF columns wrap long sentences mid-line. Raw pdfplumber output looks like:
        "The system shall allow users to register a new account by providing a valid email"
        "address, a password meeting the defined strength policy, and a display name."
    This is now merged into one sentence before spaCy runs.

Fix 2 – Stronger fragment filter
    New rules on top of the old keyword check:
      • Must end with sentence-ending punctuation (complete sentence)
      • Must start with a capital letter (not a mid-sentence fragment)
      • Minimum 10 words (raised from 6)
      • (cid:NNN) PDF bullet artifacts are stripped before checking

Fix 3 – Type and priority classifier (no LLM needed)
    Each requirement is now tagged with:
      type     → FR | NFR | UI | CONSTRAINT | ASSUMPTION
      priority → HIGH | MEDIUM | LOW
    Using section-heading context + inline regex signals.
"""

import re
import uuid
import logging
from pathlib import Path
from typing import List

import spacy

try:
    from docx import Document as DocxDocument
    _DOCX_AVAILABLE = True
except ImportError:
    _DOCX_AVAILABLE = False

logger = logging.getLogger(__name__)

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError("Run: python -m spacy download en_core_web_sm")
    return _nlp


# =============================================================================
# FIX 1 – Line-break rejoining
# =============================================================================

def _looks_like_heading(line: str) -> bool:
    stripped = line.rstrip(":").strip()
    if len(stripped.split()) > 10:
        return False
    if stripped.isupper() and len(stripped) > 3:
        return True
    if re.match(r'^\d+(\.\d+)*\s+[A-Z]', stripped):
        return True
    return False


def _rejoin_broken_lines(raw_text: str) -> str:
    """
    Merge soft-wrapped PDF lines back into complete sentences.

    A line is merged with the next one when:
      - The current line does NOT end with sentence-ending punctuation
      - The next line starts with a lowercase letter or mid-sentence
        punctuation (comma, semicolon, parenthesis, dash)
      - The next line is not a new section heading or numbered item
    """
    lines = raw_text.split("\n")
    merged: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            merged.append("")
            i += 1
            continue

        while i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if not next_line:
                break
            if re.search(r'[.!?:]\s*$', line):
                break
            if _looks_like_heading(next_line):
                break
            if re.match(r'^\d+[\.\)]\s', next_line):
                break
            if re.match(r'^[a-z,;()\-]', next_line):
                line = line + " " + next_line
                i += 1
            else:
                break

        merged.append(line)
        i += 1
    return "\n".join(merged)


# =============================================================================
# FIX 2 – Stronger sentence filter
# =============================================================================

# Strip PDF bullet/dingbat artifacts before any check
_CID_ARTIFACT = re.compile(r'\(cid:\d+\)\s*')

def _clean(text: str) -> str:
    text = _CID_ARTIFACT.sub('', text)
    # Strip leading bullets, numbers, and markdown stars
    text = re.sub(r'^[\s\*\-\d\.\)]+', '', text)
    # Strip markdown emphasis
    text = text.replace('**', '').replace('__', '')
    return re.sub(r'  +', ' ', text).strip()


_REQ_TRIGGER = re.compile(
    r'\b(shall|must'
    r'|the\s+system|the\s+application|the\s+platform'
    r'|the\s+backend|the\s+frontend|the\s+database|the\s+user\s+interface'
    r'|FR-\d+|NFR-\d+|REQ-\d+)\b',
    re.IGNORECASE,
)

_JUNK = re.compile(
    r'^(it\s+is\s+intended'
    r'|each\s+requirement'
    r'|is\s+assigned'
    r'|the\s+following\s+functional\s+requirements\s+define)',
    re.IGNORECASE,
)

_MIN_WORDS = 10
_MAX_WORDS = 150


def _is_valid_requirement(text: str) -> bool:
    text = text.strip()

    # Must end with sentence-ending punctuation
    if not re.search(r'[.!?]$', text):
        return False

    # Must start with a capital letter (not a mid-sentence fragment)
    # Relaxed slightly to handle the case where a bullet was just stripped
    if not re.match(r'^[A-Z(0-9]', text):
        return False

    word_count = len(text.split())
    if word_count < _MIN_WORDS or word_count > _MAX_WORDS:
        return False

    if not _REQ_TRIGGER.search(text):
        return False

    if _JUNK.match(text):
        return False

    # Reject document meta-commentary
    if re.search(r'\bthis\s+(srs|document|specification)\b', text, re.IGNORECASE):
        return False

    return True


# =============================================================================
# FIX 3 – Type and priority classifier
# =============================================================================

# Ordered: first match wins
_SECTION_TYPE_MAP = [
    (r'non.functional',                                                   'NFR'),
    (r'user\s+interface|external\s+interface|ui\b',                       'UI'),
    (r'constraint',                                                        'CONSTRAINT'),
    (r'assumption',                                                        'ASSUMPTION'),
    (r'performance|scalab|availab|maintainab|accessib|usability|security'
     r'|data\s+retention',                                                 'NFR'),
    (r'functional',                                                        'FR'),
]

_TYPE_SIGNALS = [
    (r'\bFR-\d+',                                                          'FR'),
    (r'\bNFR-\d+',                                                         'NFR'),
    (r'\b(response\s+time|latency|concurrent\s+user|throughput)',          'NFR'),
    (r'\b(tls|ssl|owasp|xss|csrf|sql\s+injection|encrypt)',                'NFR'),
    (r'\b(uptime|availability|99\.\d+%)',                                   'NFR'),
    (r'\b(horizontal\s+scal|scale\s+out)',                                  'NFR'),
    (r'\b(wcag|accessibility|sus\s+score|usability)',                       'NFR'),
    (r'\b(test\s+coverage|code\s+coverage)',                               'NFR'),
    (r'\b(data\s+retention|regulatory|audit\s+log)',                       'NFR'),
    (r'\b(responsive|screen\s+width|browser\s+compatib|design\s+system)',  'UI'),
    (r'\b(docker|postgresql|flask|react\s+with\s+typescript|github)',      'CONSTRAINT'),
    (r'\b(client\s+will\s+provide|out\s+of\s+scope|assumed?)',             'ASSUMPTION'),
]

_PRI_EXPLICIT = re.compile(r'\b(HIGH|MEDIUM|LOW)\b', re.IGNORECASE)

_PRI_HIGH_SIGNALS = re.compile(
    r'\b(shall\s+not\s+store|must\s+not|shall\s+encrypt'
    r'|payment|authentication|jwt\b|tls\b|ssl\b|owasp'
    r'|security|data\s+breach|unauthori)',
    re.IGNORECASE,
)

_PRI_LOW_SIGNALS = re.compile(
    r'\b(may\b|optionally|out\s+of\s+scope|wishlist'
    r'|personalised|recommendation|sms\s+notif|version\s+2)',
    re.IGNORECASE,
)


def _classify(text: str, section: str) -> dict:
    # --- type ---
    req_type = "FR"
    for pattern, t in _SECTION_TYPE_MAP:
        if re.search(pattern, section, re.IGNORECASE):
            req_type = t
            break
    for pattern, t in _TYPE_SIGNALS:
        if re.search(pattern, text, re.IGNORECASE):
            req_type = t
            break

    # --- priority ---
    priority = "MEDIUM"
    m = _PRI_EXPLICIT.search(text)
    if m and m.group(1).upper() in ("HIGH", "MEDIUM", "LOW"):
        priority = m.group(1).upper()
    elif _PRI_HIGH_SIGNALS.search(text):
        priority = "HIGH"
    elif _PRI_LOW_SIGNALS.search(text):
        priority = "LOW"

    return {"type": req_type, "priority": priority}


# =============================================================================
# Text extraction
# =============================================================================

def _extract_pdf(path: str) -> str:
    # Added local import to match fix from before
    import pdfplumber
    parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text(x_tolerance=2, y_tolerance=2)
            if t:
                parts.append(t)
    return "\n".join(parts)


def _extract_docx(path: str) -> str:
    if not _DOCX_AVAILABLE:
        raise ImportError("pip install python-docx")
    doc = DocxDocument(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_text(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(path)
    elif suffix in (".docx", ".doc"):
        return _extract_docx(path)
    elif suffix in (".txt", ".md"):
        return Path(path).read_text(encoding="utf-8", errors="replace")
    raise ValueError(f"Unsupported file type: {suffix}")


# =============================================================================
# Public API
# =============================================================================

def parse_srs(file_path: str, project_id: str) -> List[dict]:
    """
    Parse an SRS document and return well-formed, classified requirement dicts.

    Each dict:
        req_id    – stable UUID
        seq       – display sequence number (1-based)
        project_id
        text      – complete, non-truncated requirement sentence
        section   – section heading from the document
        type      – FR | NFR | UI | CONSTRAINT | ASSUMPTION
        priority  – HIGH | MEDIUM | LOW
        keywords  – "" (filled by keyword_extractor)
        embedding – None (filled by embedding_service)
    """
    raw = _extract_text(file_path)
    rejoined = _rejoin_broken_lines(raw)   # Fix 1
    nlp = _get_nlp()

    requirements: List[dict] = []
    current_section = "General"
    seq = 1

    for block in rejoined.split("\n"):
        block = _clean(block.strip())      # Fix 2a: strip PDF artifacts
        if not block:
            continue

        if _looks_like_heading(block):
            current_section = block.rstrip(":")
            continue

        doc = nlp(block)
        for sent in doc.sents:
            text = _clean(sent.text.strip())
            if not _is_valid_requirement(text):   # Fix 2b: filter
                continue

            classification = _classify(text, current_section)   # Fix 3

            requirements.append({
                "req_id":     str(uuid.uuid4()),
                "seq":        seq,
                "project_id": project_id,
                "text":       text,
                "section":    current_section,
                "type":       classification["type"],
                "priority":   classification["priority"],
                "keywords":   "",
                "embedding":  None,
            })
            seq += 1

    # =========================================================================
    # RESCUE MODE: If we found suspiciously few requirements, try raw regex grab
    # =========================================================================
    if len(requirements) < 5:
        logger.warning("[srs_parser] Heuristic parse found only %d items. Triggering Regex Rescue...", len(requirements))
        rescue_reqs = []
        # Pattern to find: REQ-XX (Priority): The system shall...
        # We split by REQ-XX to ensure they are individual items.
        # We look for REQ and then everything until the next REQ or end of string.
        matches = re.finditer(r'(REQ-\d+.*?)(?=REQ-\d+|$)', rejoined, re.DOTALL | re.IGNORECASE)
        for i, match in enumerate(matches, 1):
            text = _clean(match.group(1).strip())
            # Strip trailing decorative bullets like • if they exist
            text = re.sub(r'[\s•·\*]+$', '', text)
            
            if len(text) > 15 and _REQ_TRIGGER.search(text):
                classification = _classify(text, "Rescued")
                rescue_reqs.append({
                    "req_id":     str(uuid.uuid4()),
                    "seq":        i,
                    "project_id": project_id,
                    "text":       text,
                    "section":    "Auto-Extracted (Rescue)",
                    "type":       classification["type"],
                    "priority":   classification["priority"],
                    "keywords":   "",
                    "embedding":  None,
                })
        if len(rescue_reqs) > len(requirements):
            logger.info("[srs_parser] Regex Rescue recovered %d requirements!", len(rescue_reqs))
            requirements = rescue_reqs

    return requirements


def group_by_type(requirements: List[dict]) -> dict:
    """
    Bucket requirements by type for the UI tabs.
    Returns: {"FR": [...], "NFR": [...], "UI": [...], "CONSTRAINT": [...], "ASSUMPTION": [...]}
    """
    buckets: dict = {t: [] for t in ("FR", "NFR", "UI", "CONSTRAINT", "ASSUMPTION")}
    for r in requirements:
        buckets.setdefault(r["type"], []).append(r)
    return buckets


def group_by_section(requirements: List[dict]) -> dict:
    """
    Bucket requirements by section heading.
    Returns: {"3.1 User Authentication": [...], ...}
    """
    buckets: dict = {}
    for r in requirements:
        buckets.setdefault(r["section"], []).append(r)
    return buckets
