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
