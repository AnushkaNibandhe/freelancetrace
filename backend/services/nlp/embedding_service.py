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
