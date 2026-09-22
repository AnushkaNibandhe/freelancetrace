"""
FreelanceTrace – Markdown Requirements Parser

Parses a simplified markdown requirements document with exactly three sections:
  ## Introduction
  ## Requirements
  ## Context

Only list items under the ## Requirements section are extracted.
List items may start with:
  - dash (-)
  - asterisk (*)
  - a number followed by a period (e.g. 1.)

Type and priority classification is delegated to _classify() from srs_parser.py.
"""

import re
import uuid
import logging
from typing import List

from services.nlp.srs_parser import _classify

logger = logging.getLogger(__name__)

# Matches bullet list items: -, *, or numbered (1., 2., etc.)
_LIST_ITEM_RE = re.compile(r'^\s*(?:[-*]|\d+\.)\s+(.*)')


def extract_section(content: str, heading: str) -> str:
    """
    Extract the text content of a specific ## heading section.

    Scans the document for a line matching '## <heading>' (case-insensitive,
    leading/trailing whitespace ignored) and returns all lines up to the next
    ## heading or end of document.

    Returns empty string if the section is not found.
    """
    lines = content.splitlines()
    # Normalise the target heading for comparison
    target = heading.strip().lstrip('#').strip().lower()

    in_section = False
    section_lines: List[str] = []

    for line in lines:
        # Detect any ## heading
        heading_match = re.match(r'^##\s+(.*)', line)
        if heading_match:
            current_heading = heading_match.group(1).strip().lower()
            if current_heading == target:
                in_section = True
                # Don't include the heading line itself
                continue
            elif in_section:
                # We've hit the next ## heading — stop collecting
                break
        elif in_section:
            section_lines.append(line)

    return '\n'.join(section_lines)


def parse_requirements_document(content: str, project_id: str) -> list[dict]:
    """
    Parse a simplified markdown requirements document.

    Extracts list items from the ## Requirements section only.
    Each item is classified for type and priority using _classify() from
    srs_parser.py.

    Returns a list of requirement dicts:
        {
            "req_id":      str,   # UUID string
            "seq":         int,   # 1-based sequence number
            "project_id":  str,
            "text":        str,   # exact requirement text (bullet stripped)
            "section":     str,   # always "Requirements"
            "type":        str,   # FR | NFR | UI | CONSTRAINT | ASSUMPTION
            "priority":    str,   # HIGH | MEDIUM | LOW
            "order_index": int,   # 0-based index
        }

    If the ## Requirements section is missing, returns an empty list.
    Empty list items (after stripping) are silently skipped.
    """
    requirements_text = extract_section(content, 'Requirements')

    if not requirements_text.strip():
        logger.warning('[md_parser] ## Requirements section not found or empty.')
        return []

    results: List[dict] = []
    order_index = 0
    seq = 1

    for line in requirements_text.splitlines():
        match = _LIST_ITEM_RE.match(line)
        if not match:
            continue

        text = match.group(1).strip()
        if not text:
            # Skip empty items silently
            continue

        classification = _classify(text, 'Requirements')

        results.append({
            'req_id':      str(uuid.uuid4()),
            'seq':         seq,
            'project_id':  project_id,
            'text':        text,
            'section':     'Requirements',
            'type':        classification['type'],
            'priority':    classification['priority'],
            'order_index': order_index,
        })

        order_index += 1
        seq += 1

    return results
