"""
FreelanceTrace – SRS Generator
services/nlp/srs_generator.py

Generates a professional PDF Software Requirements Specification (SRS) document
by calling the Groq LLM API to structure the requirements content, then rendering
the result with ReportLab.

Public API
----------
    async generate_srs_pdf(project_title, project_id, requirements_content, output_path)
        -> {"file_path": str, "page_count": int, "requirements_count": int}

    generate_srs_pdf_sync(project_title, project_id, requirements_content, output_path)
        -> {"file_path": str, "page_count": int, "requirements_count": int}
        (synchronous wrapper for use from background threads)

    build_pdf(project_title, project_id, structured_content, output_path) -> int
        (returns page count)

Custom Exceptions
-----------------
    GroqAPIError    – raised when the Groq API call fails after all retries
    PDFGenerationError – raised when ReportLab rendering fails
"""

import asyncio
import html
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Groq API availability check
# ---------------------------------------------------------------------------

_GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "").strip()
_GROQ_AVAILABLE: bool = bool(_GROQ_API_KEY)

if not _GROQ_AVAILABLE:
    logger.error(
        "[srs_generator] GROQ_API_KEY is missing or empty. "
        "SRS generation via Groq LLM is disabled."
    )

_GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL_PRIMARY = "llama-3.3-70b-versatile"
_GROQ_MODEL_FALLBACK = "llama3-8b-8192"

# Retry / timeout configuration
_MAX_ATTEMPTS = 3
_RETRY_DELAYS = [1, 2, 4]   # seconds between attempts (exponential backoff)
_TOTAL_TIMEOUT = 55.0        # seconds – hard cap across all attempts


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class GroqAPIError(Exception):
    """Raised when the Groq API call fails after all retries."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class PDFGenerationError(Exception):
    """Raised when ReportLab PDF rendering fails."""


# ---------------------------------------------------------------------------
# Groq prompt helpers
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a senior technical writer with expertise in IEEE 830-compliant Software Requirements "
    "Specifications. When given a list of requirements, you produce a comprehensive, professional "
    "SRS document structured as JSON. Be thorough and detailed — expand each requirement with "
    "precise, unambiguous language. Return ONLY a raw JSON object. "
    "Do NOT wrap it in markdown code fences. Do NOT include any text before or after the JSON."
)

_USER_PROMPT_TEMPLATE = """\
You are writing a formal Software Requirements Specification (SRS) document for the following project.

Project requirements input:
{content}

Produce a structured JSON response with EXACTLY these keys:

- "introduction": A detailed introduction (4-6 sentences) covering the purpose, scope, system \
overview, intended audience, and document conventions. Reference the project domain and goals.

- "functional_requirements": A comprehensive list of objects. Each object must have:
    - "id": string in format "FR-001", "FR-002", etc. (sequential)
    - "text": A precise, testable requirement statement starting with "The system shall..."
    - "priority": one of "HIGH", "MEDIUM", "LOW"
  IMPORTANT: Include ALL requirements from the input. For each input requirement, generate \
1-2 detailed sub-requirements that cover edge cases, error handling, and validation. \
The total number of functional requirements MUST be between 40 and 55.

- "non_functional_requirements": A list of objects with the same structure ("id" as "NFR-001" etc., \
"text" starting with "The system shall...", "priority"). Generate EXACTLY 10-15 non-functional \
requirements covering: response time, throughput, availability (99.9% uptime), security \
(authentication, authorization, data encryption), usability (accessibility, WCAG 2.1 AA), \
reliability, scalability, maintainability, and data backup/recovery.

- "constraints": A list of 5-8 strings describing technical, business, legal, or regulatory \
constraints. Be specific to the project domain.

- "assumptions": A list of 5-8 strings describing assumptions made during requirements analysis. \
Be specific and realistic.

Requirements document:
{content}
"""


def _build_prompt(requirements_content: str) -> list[dict]:
    """Return the messages list for the Groq chat completions API."""
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _USER_PROMPT_TEMPLATE.format(
                content=requirements_content.strip()
            ),
        },
    ]


# ---------------------------------------------------------------------------
# Groq API call with exponential backoff
# ---------------------------------------------------------------------------

async def _call_groq_api(requirements_content: str) -> dict:
    """
    Call the Groq chat completions API and return the parsed JSON response.

    Retries up to _MAX_ATTEMPTS times with exponential backoff.
    Total elapsed time is capped at _TOTAL_TIMEOUT seconds.

    Returns the structured dict from the LLM response.
    Raises GroqAPIError on failure.
    """
    if not _GROQ_AVAILABLE:
        raise GroqAPIError("Groq API is not configured (missing GROQ_API_KEY).")

    messages = _build_prompt(requirements_content)
    payload = {
        "model": _GROQ_MODEL_PRIMARY,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 8192,
    }
    headers = {
        "Authorization": f"Bearer {_GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    start_time = time.monotonic()
    last_error: Exception | None = None

    for attempt in range(_MAX_ATTEMPTS):
        elapsed = time.monotonic() - start_time
        remaining = _TOTAL_TIMEOUT - elapsed
        if remaining <= 0:
            raise GroqAPIError(
                f"Total timeout of {_TOTAL_TIMEOUT}s exceeded before attempt {attempt + 1}."
            )

        # Per-request timeout is the remaining budget (at least 1s)
        per_request_timeout = max(1.0, remaining)

        try:
            logger.info(
                "[srs_generator] Groq API attempt %d/%d (timeout=%.1fs)",
                attempt + 1,
                _MAX_ATTEMPTS,
                per_request_timeout,
            )
            async with httpx.AsyncClient(timeout=per_request_timeout) as client:
                response = await client.post(
                    _GROQ_ENDPOINT, json=payload, headers=headers
                )

            logger.debug(
                "[srs_generator] Groq response status: %d", response.status_code
            )

            if response.status_code == 200:
                data = response.json()
                raw_content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                logger.info("[srs_generator] Groq API call succeeded on attempt %d.", attempt + 1)
                return _parse_groq_response(raw_content)

            if response.status_code == 401:
                raise GroqAPIError(
                    "Groq API authentication failed (HTTP 401). Check GROQ_API_KEY.",
                    status_code=401,
                )

            if response.status_code == 429:
                # Rate limited – retry after backoff
                logger.warning(
                    "[srs_generator] Groq rate limit (HTTP 429) on attempt %d.", attempt + 1
                )
                last_error = GroqAPIError(
                    "Groq API rate limit exceeded.", status_code=429
                )
            else:
                last_error = GroqAPIError(
                    f"Groq API returned HTTP {response.status_code}.",
                    status_code=response.status_code,
                )

        except httpx.TimeoutException as exc:
            logger.warning(
                "[srs_generator] Groq request timed out on attempt %d: %s",
                attempt + 1,
                exc,
            )
            last_error = GroqAPIError(f"Groq API request timed out: {exc}")

        except httpx.RequestError as exc:
            logger.warning(
                "[srs_generator] Groq request error on attempt %d: %s",
                attempt + 1,
                exc,
            )
            last_error = GroqAPIError(f"Groq API request error: {exc}")

        # Wait before retrying (if there are more attempts left)
        if attempt < _MAX_ATTEMPTS - 1:
            delay = _RETRY_DELAYS[attempt]
            elapsed_after = time.monotonic() - start_time
            if elapsed_after + delay >= _TOTAL_TIMEOUT:
                # Not enough budget left to wait and retry
                break
            logger.info("[srs_generator] Retrying in %ds…", delay)
            await asyncio.sleep(delay)

    # Try fallback model on the last attempt if primary failed with non-auth error
    if last_error and (
        not isinstance(last_error, GroqAPIError)
        or last_error.status_code != 401
    ):
        elapsed = time.monotonic() - start_time
        remaining = _TOTAL_TIMEOUT - elapsed
        if remaining > 1.0:
            logger.info(
                "[srs_generator] Trying fallback model %s (%.1fs remaining).",
                _GROQ_MODEL_FALLBACK,
                remaining,
            )
            payload["model"] = _GROQ_MODEL_FALLBACK
            try:
                async with httpx.AsyncClient(timeout=remaining) as client:
                    response = await client.post(
                        _GROQ_ENDPOINT, json=payload, headers=headers
                    )
                if response.status_code == 200:
                    data = response.json()
                    raw_content = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                    )
                    logger.info("[srs_generator] Fallback model succeeded.")
                    return _parse_groq_response(raw_content)
            except Exception as exc:
                logger.warning("[srs_generator] Fallback model also failed: %s", exc)

    raise last_error or GroqAPIError("Groq API call failed after all retries.")


def _parse_groq_response(raw_content: str) -> dict:
    """
    Parse the raw string content from the Groq response.

    Strips markdown code fences (```json ... ```) if present, then parses JSON.
    On JSON parse failure, falls back to a minimal structure that treats
    the entire response as the introduction section.
    """
    text = raw_content.strip()

    # Strip markdown fences: ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first line (```json or ```) and last line (```)
        inner_lines = lines[1:] if len(lines) > 1 else lines
        if inner_lines and inner_lines[-1].strip() == "```":
            inner_lines = inner_lines[:-1]
        text = "\n".join(inner_lines).strip()

    # Find the first { and last } to extract the JSON object even if there's
    # surrounding prose
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        parsed = json.loads(text)
        return {
            "introduction": parsed.get("introduction", ""),
            "functional_requirements": parsed.get("functional_requirements", []),
            "non_functional_requirements": parsed.get("non_functional_requirements", []),
            "constraints": parsed.get("constraints", []),
            "assumptions": parsed.get("assumptions", []),
        }
    except (json.JSONDecodeError, ValueError):
        logger.warning(
            "[srs_generator] Groq response was not valid JSON. "
            "Falling back to minimal structure. Raw (first 500 chars): %s",
            raw_content[:500],
        )
        return {
            "introduction": raw_content.strip(),
            "functional_requirements": [],
            "non_functional_requirements": [],
            "constraints": [],
            "assumptions": [],
        }


# ---------------------------------------------------------------------------
# PDF rendering with ReportLab
# ---------------------------------------------------------------------------

def build_pdf(
    project_title: str,
    project_id: str,
    structured_content: dict,
    output_path: Path,
) -> int:
    """
    Render structured SRS content to a PDF file using ReportLab.

    Parameters
    ----------
    project_title : str
        Human-readable project name shown on the title page.
    project_id : str
        Project identifier shown in the footer.
    structured_content : dict
        Dict with keys: introduction, functional_requirements,
        non_functional_requirements, constraints, assumptions.
    output_path : Path
        Destination file path for the generated PDF.

    Returns
    -------
    int
        Number of pages in the generated PDF.

    Raises
    ------
    PDFGenerationError
        If ReportLab fails to render the PDF.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            BaseDocTemplate,
            Frame,
            NextPageTemplate,
            PageBreak,
            PageTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as exc:
        raise PDFGenerationError(
            "ReportLab is not installed. Run: pip install reportlab"
        ) from exc

    try:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        generation_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        # ------------------------------------------------------------------
        # Styles
        # ------------------------------------------------------------------
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "SRSTitle",
            parent=styles["Title"],
            fontSize=28,
            leading=34,
            spaceAfter=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1a1a2e"),
        )
        subtitle_style = ParagraphStyle(
            "SRSSubtitle",
            parent=styles["Normal"],
            fontSize=14,
            leading=18,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4a4a6a"),
        )
        heading1_style = ParagraphStyle(
            "SRSHeading1",
            parent=styles["Heading1"],
            fontSize=16,
            leading=20,
            spaceBefore=18,
            spaceAfter=8,
            textColor=colors.HexColor("#1a1a2e"),
            borderPad=4,
        )
        heading2_style = ParagraphStyle(
            "SRSHeading2",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.HexColor("#2d2d5e"),
        )
        body_style = ParagraphStyle(
            "SRSBody",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            spaceAfter=6,
        )
        req_id_style = ParagraphStyle(
            "SRSReqId",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#666699"),
            fontName="Helvetica-Bold",
        )
        req_text_style = ParagraphStyle(
            "SRSReqText",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            leftIndent=12,
        )
        priority_high_style = ParagraphStyle(
            "SRSPriorityHigh",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#cc0000"),
            fontName="Helvetica-Bold",
        )
        priority_medium_style = ParagraphStyle(
            "SRSPriorityMedium",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#cc7700"),
            fontName="Helvetica-Bold",
        )
        priority_low_style = ParagraphStyle(
            "SRSPriorityLow",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#007700"),
            fontName="Helvetica-Bold",
        )
        toc_style = ParagraphStyle(
            "SRSToc",
            parent=styles["Normal"],
            fontSize=11,
            leading=18,
            leftIndent=0,
        )
        footer_style = ParagraphStyle(
            "SRSFooter",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#888888"),
            alignment=TA_CENTER,
        )

        # ------------------------------------------------------------------
        # Page templates
        # ------------------------------------------------------------------
        page_width, page_height = A4
        margin = 2.5 * cm

        def _title_page_footer(canvas, doc):
            """No footer / page number on the title page."""
            pass

        def _content_page_footer(canvas, doc):
            """Footer with project ID, timestamp, and page number."""
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#888888"))

            footer_text = f"Project ID: {project_id}  |  Generated: {generation_ts}"
            canvas.drawCentredString(page_width / 2, margin / 2, footer_text)

            page_num_text = f"Page {doc.page}"
            canvas.drawRightString(
                page_width - margin, margin / 2, page_num_text
            )
            canvas.restoreState()

        title_frame = Frame(
            margin, margin,
            page_width - 2 * margin,
            page_height - 2 * margin,
            id="title_frame",
        )
        content_frame = Frame(
            margin, margin + 0.8 * cm,
            page_width - 2 * margin,
            page_height - 2 * margin - 0.8 * cm,
            id="content_frame",
        )

        title_template = PageTemplate(
            id="TitlePage",
            frames=[title_frame],
            onPage=_title_page_footer,
        )
        content_template = PageTemplate(
            id="ContentPage",
            frames=[content_frame],
            onPage=_content_page_footer,
        )

        doc = BaseDocTemplate(
            str(output_path),
            pagesize=A4,
            pageTemplates=[title_template, content_template],
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        # ------------------------------------------------------------------
        # Build story
        # ------------------------------------------------------------------
        story = []

        # ---- Title page ----
        story.append(Spacer(1, 4 * cm))
        story.append(Paragraph("Software Requirements Specification", title_style))
        story.append(Spacer(1, 0.5 * cm))
        story.append(Paragraph(project_title, subtitle_style))
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(f"Generated: {generation_ts}", subtitle_style))
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph(f"Project ID: {project_id}", subtitle_style))
        story.append(Spacer(1, 2 * cm))
        story.append(Paragraph("FreelanceTrace Platform", subtitle_style))

        # Switch to content template (with footer + page numbers)
        story.append(NextPageTemplate("ContentPage"))
        story.append(PageBreak())

        # ---- Table of Contents ----
        story.append(Paragraph("Table of Contents", heading1_style))
        story.append(Spacer(1, 0.3 * cm))

        fr_list = structured_content.get("functional_requirements", [])
        nfr_list = structured_content.get("non_functional_requirements", [])
        constraints_list = structured_content.get("constraints", [])
        assumptions_list = structured_content.get("assumptions", [])

        toc_entries = [
            ("1.", "Introduction"),
            ("2.", f"Functional Requirements ({len(fr_list)} items)"),
            ("3.", f"Non-Functional Requirements ({len(nfr_list)} items)"),
            ("4.", f"Constraints ({len(constraints_list)} items)"),
            ("5.", f"Assumptions ({len(assumptions_list)} items)"),
        ]
        for num, title in toc_entries:
            toc_row = Table(
                [[Paragraph(num, toc_style), Paragraph(title, toc_style)]],
                colWidths=[1.2 * cm, page_width - 2 * margin - 1.2 * cm],
            )
            toc_row.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(toc_row)

        story.append(PageBreak())

        # ---- 1. Introduction ----
        story.append(Paragraph("1. Introduction", heading1_style))
        intro_text = structured_content.get("introduction", "").strip()
        if intro_text:
            story.append(Paragraph(intro_text, body_style))
        else:
            story.append(Paragraph("No introduction provided.", body_style))
        story.append(Spacer(1, 0.5 * cm))

        # ---- 2. Functional Requirements ----
        story.append(Paragraph("2. Functional Requirements", heading1_style))
        if fr_list:
            for i, req in enumerate(fr_list, start=1):
                req_id = req.get("id") or f"REQ-{i:03d}"
                req_text = req.get("text", "").strip()
                priority = req.get("priority", "MEDIUM").upper()

                # Format REQ-NNN to ensure consistent numbering
                formatted_id = _format_req_id(req_id, "REQ", i)

                priority_style = {
                    "HIGH": priority_high_style,
                    "MEDIUM": priority_medium_style,
                    "LOW": priority_low_style,
                }.get(priority, priority_medium_style)

                story.append(Paragraph(f"{formatted_id}  [{priority}]", req_id_style))
                story.append(Paragraph(html.escape(req_text), req_text_style))
                story.append(Spacer(1, 0.2 * cm))
        else:
            story.append(Paragraph("No functional requirements specified.", body_style))
        story.append(Spacer(1, 0.5 * cm))

        # ---- 3. Non-Functional Requirements ----
        story.append(Paragraph("3. Non-Functional Requirements", heading1_style))
        if nfr_list:
            for i, req in enumerate(nfr_list, start=1):
                req_id = req.get("id") or f"NFR-{i:03d}"
                req_text = req.get("text", "").strip()
                priority = req.get("priority", "MEDIUM").upper()

                formatted_id = _format_req_id(req_id, "NFR", i)

                story.append(Paragraph(f"{formatted_id}  [{priority}]", req_id_style))
                story.append(Paragraph(html.escape(req_text), req_text_style))
                story.append(Spacer(1, 0.2 * cm))
        else:
            story.append(
                Paragraph("No non-functional requirements specified.", body_style)
            )
        story.append(Spacer(1, 0.5 * cm))

        # ---- 4. Constraints ----
        story.append(Paragraph("4. Constraints", heading1_style))
        if constraints_list:
            for i, constraint in enumerate(constraints_list, start=1):
                req_id = f"CON-{i:03d}"
                story.append(Paragraph(req_id, req_id_style))
                story.append(Paragraph(html.escape(str(constraint).strip()), req_text_style))
                story.append(Spacer(1, 0.2 * cm))
        else:
            story.append(Paragraph("No constraints specified.", body_style))
        story.append(Spacer(1, 0.5 * cm))

        # ---- 5. Assumptions ----
        story.append(Paragraph("5. Assumptions", heading1_style))
        if assumptions_list:
            for i, assumption in enumerate(assumptions_list, start=1):
                req_id = f"ASM-{i:03d}"
                story.append(Paragraph(req_id, req_id_style))
                story.append(Paragraph(html.escape(str(assumption).strip()), req_text_style))
                story.append(Spacer(1, 0.2 * cm))
        else:
            story.append(Paragraph("No assumptions specified.", body_style))

        # ------------------------------------------------------------------
        # Build the PDF
        # ------------------------------------------------------------------
        doc.build(story)

        # Count pages by re-opening with pdfplumber (or use doc.page)
        page_count = _count_pdf_pages(output_path)
        logger.info(
            "[srs_generator] PDF built: %s (%d pages)", output_path, page_count
        )
        return page_count

    except PDFGenerationError:
        raise
    except Exception as exc:
        raise PDFGenerationError(f"ReportLab rendering failed: {exc}") from exc


def _format_req_id(raw_id: str, prefix: str, seq: int) -> str:
    """
    Normalise a requirement ID to REQ-NNN format.

    If the raw_id already looks like REQ-NNN / FR-NNN / NFR-NNN, extract the
    numeric part and reformat. Otherwise fall back to prefix + seq.
    """
    import re
    m = re.search(r"(\d+)", raw_id)
    if m:
        num = int(m.group(1))
        return f"REQ-{num:03d}"
    return f"REQ-{seq:03d}"


def _count_pdf_pages(path: Path) -> int:
    """Return the number of pages in a PDF file."""
    try:
        import pdfplumber
        with pdfplumber.open(str(path)) as pdf:
            return len(pdf.pages)
    except Exception:
        # pdfplumber not available or failed; return a best-effort estimate
        return 1


# ---------------------------------------------------------------------------
# Public async entry point
# ---------------------------------------------------------------------------

async def generate_srs_pdf(
    project_title: str,
    project_id: str,
    requirements_content: str,
    output_path: Path,
) -> dict:
    """
    Generate a PDF SRS document from requirements content.

    Calls the Groq LLM API to structure the content, then renders the PDF
    with ReportLab.

    Parameters
    ----------
    project_title : str
        Human-readable project name.
    project_id : str
        Unique project identifier (used in footer and return value).
    requirements_content : str
        Raw requirements text to send to the Groq API.
    output_path : Path
        Destination path for the generated PDF file.

    Returns
    -------
    dict
        {
            "file_path": str,
            "page_count": int,
            "requirements_count": int,
        }

    Raises
    ------
    GroqAPIError
        If the Groq API call fails after all retries.
    PDFGenerationError
        If ReportLab rendering fails.
    """
    logger.info(
        "[srs_generator] Starting SRS generation for project '%s' (%s).",
        project_title,
        project_id,
    )

    # Step 1: Call Groq API
    structured_content = await _call_groq_api(requirements_content)

    # Step 2: Render PDF
    output_path = Path(output_path)
    page_count = build_pdf(project_title, project_id, structured_content, output_path)

    # Step 3: Count requirements
    fr_count = len(structured_content.get("functional_requirements", []))
    nfr_count = len(structured_content.get("non_functional_requirements", []))
    requirements_count = fr_count + nfr_count

    logger.info(
        "[srs_generator] SRS generation complete: %d pages, %d requirements.",
        page_count,
        requirements_count,
    )

    return {
        "file_path": str(output_path),
        "page_count": page_count,
        "requirements_count": requirements_count,
    }


# ---------------------------------------------------------------------------
# Synchronous wrapper (for use from background threads / Flask routes)
# ---------------------------------------------------------------------------

def generate_srs_pdf_sync(
    project_title: str,
    project_id: str,
    requirements_content: str,
    output_path: Path,
) -> dict:
    """
    Synchronous wrapper around the SRS generation pipeline.

    Intended for use from background threads where there is no running event
    loop (e.g. ``threading.Thread`` spawned by a Flask route).

    Returns the same dict as :func:`generate_srs_pdf`.
    Raises :class:`GroqAPIError` or :class:`PDFGenerationError` on failure.
    """
    import asyncio

    # Always create a brand-new event loop for this thread so we never
    # collide with Flask's debug-reloader loop or any other running loop.
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(
            generate_srs_pdf(project_title, project_id, requirements_content, output_path)
        )
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        loop.close()
