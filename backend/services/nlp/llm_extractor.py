"""
services/nlp/llm_extractor.py
------------------------------
Google Gemini-backed requirement extraction from raw SRS text.

Usage:
    from services.nlp.llm_extractor import extract_requirements_with_llm
    requirements = extract_requirements_with_llm(raw_text, project_title="My App")

Returns a list of dicts:
    [{"text": "The system shall ...", "priority": "high"}, ...]

Falls back to [] (caller should then use the spaCy-based srs_parser) when:
  - GEMINI_API_KEY is not set
  - The API call fails
  - The LLM response cannot be parsed as JSON
"""
from __future__ import annotations

import json
import os
import re

# Limit the text sent to Gemini (free tier has 1M token context, but large PDFs can be huge)
MAX_TEXT_CHARS = 14_000


def _build_prompt(raw_text: str, project_title: str = "") -> str:
    title_hint = f' for a project titled "{project_title}"' if project_title else ""
    return f"""You are a world-class requirements engineer{title_hint}.
Your goal is to perform a high-precision extraction of every single requirement from the document below.

Instructions:
1. Scan the text for every unique functional or non-functional requirement.
2. Even if requirements are listed as bullets (e.g., REQ-01, REQ-02), extract each one as a separate, standalone entry.
3. Rewrite each into a formal, clear sentence starting with "The system shall..." or "The application must...".
4. Preserve the core meaning and any specific technical constraints (e.g., "JWT", "Stripe", "PostgreSQL").
5. Assign a priority: "high", "medium", or "low".
6. DO NOT summarize. DO NOT skip any requirement. DO NOT group them together.
7. Return ONLY a valid JSON array of objects.

Format:
[
  {{"text": "The system shall...", "priority": "high"}},
  ...
]

SRS Document Text:
---
{raw_text[:MAX_TEXT_CHARS]}
---

Return ONLY the JSON array:"""


def _parse_llm_response(response_text: str) -> list[dict]:
    """
    Robustly parse JSON from LLM response.
    Handles:
      - Raw JSON array
      - JSON wrapped in ```json ... ``` markdown
      - JSON with leading/trailing prose
    """
    # Strip markdown code blocks if present
    stripped = re.sub(r"```(?:json)?", "", response_text).strip()

    # Try full parse first
    try:
        result = json.loads(stripped)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Try to extract just the JSON array from the text
    match = re.search(r"\[.*\]", stripped, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    return []


def _validate_requirement(req: dict) -> dict | None:
    """Normalise and validate a single requirement dict."""
    if not isinstance(req, dict):
        return None
    text = str(req.get("text") or "").strip()
    if len(text) < 10:
        return None
    priority = str(req.get("priority") or "medium").lower()
    if priority not in {"high", "medium", "low"}:
        priority = "medium"
    return {"text": text, "priority": priority}


def extract_requirements_with_llm(
    raw_text: str,
    project_title: str = "",
) -> list[dict]:
    """
    Call Google Gemini to extract structured requirements from raw SRS text.

    Parameters
    ----------
    raw_text      : Plain text extracted from the SRS file
    project_title : Optional project title for context in the prompt

    Returns
    -------
    List of {"text": str, "priority": "high"|"medium"|"low"} dicts.
    Returns [] on any error (caller falls back to spaCy extraction).
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[llm_extractor] GEMINI_API_KEY not set — skipping LLM extraction")
        return []

    if not raw_text or not raw_text.strip():
        print("[llm_extractor] Empty text — skipping")
        return []

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        prompt = _build_prompt(raw_text, project_title)
        
        # EXHAUSTIVE fallback list for the user's Project Review Demo.
        # We try every possible stable/experimental model to find ONE that has quota.
        models_to_try = [
            "gemini-2.0-flash", 
            "gemini-1.5-pro", 
            "gemini-1.5-flash", 
            "gemini-1.5-flash-8b",
            "gemini-2.0-flash-exp"
        ]
        response_text = ""
        success_model = None

        for model_name in models_to_try:
            try:
                print(f"[llm_extractor] Attempting extraction with {model_name}...")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.1,
                        "max_output_tokens": 8192,
                    },
                )
                response_text = (response.text or "").strip()
                if response_text:
                    success_model = model_name
                    print(f"[llm_extractor] SUCCESS: Extracted using {model_name}")
                    break
            except Exception as e:
                err_msg = str(e).lower()
                print(f"[llm_extractor] {model_name} failed: {e}")
                continue

        if not response_text:
            print("[llm_extractor] EMERGENCY: All Gemini models failed.")
            return []

        raw_requirements = _parse_llm_response(response_text)

        requirements = []
        for req in raw_requirements:
            validated = _validate_requirement(req)
            if validated:
                requirements.append(validated)

        print(f"[llm_extractor] Extracted {len(requirements)} requirements via Gemini")
        return requirements

    except ImportError:
        print("[llm_extractor] google-generativeai not installed — run: pip install google-generativeai")
        return []
    except Exception as exc:
        print(f"[llm_extractor] Gemini API error: {exc}")
        return []
