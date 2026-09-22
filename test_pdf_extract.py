import sys
import os
import json

# Ensure backend/ found on sys.path
sys.path.insert(0, os.path.abspath("backend"))

from services.nlp.srs_parser import extract_text, parse_srs
from services.nlp.llm_extractor import extract_requirements_with_llm

pdf_file = "backend/uploads/1773818926.354751-ITD_G6_SEAPM_assignment05_1.pdf"

print("--- Testing extract_text ---")
try:
    text = extract_text(pdf_file)
    print(f"Extracted {len(text)} characters of text.")
    print("Snippet:")
    print(text[:400])
except Exception as e:
    print(f"FAILED raw text extraction: {e}")

print("\n--- Testing parse_srs (spaCy) ---")
try:
    reqs = parse_srs(pdf_file, project_id="test")
    print(f"spaCy parsed {len(reqs)} requirements.")
    for r in reqs[:3]:
        print(f" - {r.get('text')}")
except Exception as e:
    print(f"FAILED spaCy parse: {e}")

print("\n--- Testing extract_requirements_with_llm ---")
try:
    # Set fake API key for import test if needed, or if mock exists
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key:
        reqs_llm = extract_requirements_with_llm(text[:8000], project_title="Test Project")
        print(f"LLM parsed {len(reqs_llm)} requirements.")
        for r in reqs_llm[:3]:
            print(f" - {r.get('text')} [Priority: {r.get('priority')}]")
    else:
        print("GEMINI_API_KEY absent, skipping LLM test.")
except Exception as e:
    print(f"FAILED LLM extraction: {e}")
