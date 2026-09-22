# Design Document: FreelanceTrace Enhancements

## Overview

This document describes the technical design for four enhancements to the FreelanceTrace platform:

1. **Simplified Requirements Document Format** — a new markdown-based document format with a dedicated parser and dashboard display
2. **SRS PDF Generation via Groq LLM** — AI-assisted generation of professional PDF SRS documents
3. **Project Unassignment** — ability for Clients and Admins to remove a freelancer from an assigned project
4. **Flexible Bidding Beyond Budget** — allow bids that exceed the project's stated budget and timeline, with warnings

The platform is a Python/FastAPI + React/TypeScript application. The backend uses Flask (despite the FastAPI mention in requirements — the actual `main.py` uses Flask), SQLAlchemy ORM, and SQLite. The frontend uses React 18, TypeScript, Tailwind CSS, and shadcn/ui.

---

## Architecture

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React 18 + TypeScript)                               │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Client Dashboard│  │Freelancer Browse │  │ Project      │  │
│  │  (req widget)    │  │  (bid warnings)  │  │ Detail Page  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  CreateProject   │  │  Admin/Client    │                     │
│  │  (md upload)     │  │  Project View    │                     │
│  └──────────────────┘  │  (unassign btn)  │                     │
│                        └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP (REST)
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Flask + SQLAlchemy)                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  main.py  (Flask routes)                                 │   │
│  │  POST /projects/<id>/parse-requirements  (new)           │   │
│  │  POST /projects/<id>/generate-srs        (new)           │   │
│  │  POST /projects/<id>/unassign            (new)           │   │
│  │  POST /projects/<id>/bids                (modified)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  md_parser.py    │  │  srs_generator.py│                     │
│  │  (new service)   │  │  (new service)   │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SQLite DB (models.py)                                   │   │
│  │  Project, Requirement, Bid, Notification (new)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │  Groq LLM API   │
                    │  (external)     │
                    └─────────────────┘
```

### Design Decisions

- **Markdown parser as a new service** (`services/nlp/md_parser.py`) rather than modifying the existing `srs_parser.py`. The existing parser handles PDF/DOCX with spaCy heuristics; the new parser handles a well-defined markdown format. Keeping them separate avoids breaking existing projects.
- **Groq API called server-side** to keep the API key out of the browser and to allow server-side retry/timeout logic.
- **PDF generation with ReportLab** — already available in the Python ecosystem, no new infrastructure needed. WeasyPrint is an alternative but requires system-level HTML rendering dependencies.
- **Unassignment as a dedicated endpoint** (`POST /projects/<id>/unassign`) rather than a generic PATCH, to make the audit trail explicit and allow notification side-effects to be co-located.
- **Bid validation relaxed at the API layer** — the existing `POST /projects/<id>/bids` endpoint will stop rejecting bids above `budget_max`. Warning metadata is computed and returned in the response for the frontend to display.

---

## Components and Interfaces

### 1. Markdown Requirements Parser (`services/nlp/md_parser.py`)

**Responsibility**: Parse a simplified markdown document and extract requirement items.

**Input format**:
```markdown
## Introduction
...free text...

## Requirements
- The system shall allow users to register.
- The system shall support OAuth login.
- ...

## Context
...free text...
```

**Public API**:
```python
def parse_requirements_document(content: str, project_id: str) -> list[dict]:
    """
    Parse a simplified markdown requirements document.

    Returns a list of requirement dicts:
        {
            "req_id": str,          # UUID
            "seq": int,             # 1-based sequence
            "project_id": str,
            "text": str,            # exact requirement text
            "section": str,         # always "Requirements"
            "type": str,            # FR | NFR | UI | CONSTRAINT | ASSUMPTION
            "priority": str,        # HIGH | MEDIUM | LOW
            "order_index": int,
        }
    """

def extract_section(content: str, heading: str) -> str:
    """
    Extract the text content of a specific ## heading section.
    Returns empty string if section not found.
    """
```

**Parsing algorithm**:
1. Split document by `##` headings.
2. Locate the `## Requirements` section.
3. Extract list items (lines starting with `-`, `*`, or `\d+.`).
4. For each item, strip the bullet/number prefix and trim whitespace.
5. Classify type and priority using the existing `_classify()` logic from `srs_parser.py`.
6. Assign sequential `order_index` values starting at 0.

### 2. SRS Generator (`services/nlp/srs_generator.py`)

**Responsibility**: Call the Groq LLM API with requirements content and render the response as a PDF.

**Public API**:
```python
async def generate_srs_pdf(
    project_title: str,
    project_id: str,
    requirements_content: str,
    output_path: Path,
) -> dict:
    """
    Generate a PDF SRS document.

    Returns:
        {
            "file_path": str,
            "page_count": int,
            "requirements_count": int,
        }

    Raises:
        GroqAPIError: if the Groq API call fails after retries
        PDFGenerationError: if ReportLab rendering fails
    """

def build_pdf(
    project_title: str,
    project_id: str,
    structured_content: dict,
    output_path: Path,
) -> int:
    """
    Render structured SRS content to a PDF file using ReportLab.
    Returns page count.
    """
```

**Groq prompt structure**:
```
You are a technical writer. Given the following requirements document, 
produce a structured JSON response with these keys:
  - introduction: string
  - functional_requirements: list of {id, text, priority}
  - non_functional_requirements: list of {id, text, priority}
  - constraints: list of string
  - assumptions: list of string

Requirements document:
{content}
```

**Retry logic**: Exponential backoff with jitter — delays of 1s, 2s, 4s for up to 3 attempts. Total timeout cap of 25 seconds.

### 3. Backend API Endpoints (additions to `main.py`)

#### `POST /projects/<id>/parse-requirements`
- Accepts: `multipart/form-data` with a `file` field (`.md` or `.txt`)
- Auth: Bearer token, must be project owner or admin
- Calls `md_parser.parse_requirements_document()`
- Deletes existing requirements for the project, inserts new ones
- Returns: `{ "requirements_extracted": int, "requirements": [...] }`

#### `POST /projects/<id>/generate-srs`
- Accepts: JSON `{ "requirements_content": string }` or reads from stored requirements
- Auth: Bearer token, must be project owner
- Calls `srs_generator.generate_srs_pdf()` in a background thread
- Stores the PDF in `uploads/` and updates `project.srs_file_url`
- Returns: `{ "file_url": string, "page_count": int }`

#### `POST /projects/<id>/unassign`
- Accepts: JSON `{ "reason": string (optional) }`
- Auth: Bearer token, must be project client or admin
- Validates project has an assigned freelancer
- Resets `awarded_freelancer_id`, `awarded_at` to null; sets `status` to `"open"`
- Creates a `Notification` record for the unassigned freelancer
- Logs the action to an audit table
- Returns: `{ "project": {...}, "notification_id": int }`

#### `POST /projects/<id>/bids` (modified)
- Removes the upper-bound validation on `amount` vs `budget_max`
- Removes the upper-bound validation on `estimated_duration_days` vs `duration_days`
- Adds `over_budget` and `over_duration` boolean flags to the response
- Adds `budget_diff_pct` and `duration_diff_pct` float fields to the response

### 4. Frontend Components

#### `RequirementsWidget` (`components/dashboard/RequirementsWidget.tsx`)
- Props: `project: Project`
- Displays: total count, fulfilled count, progress bar, high-priority count
- Clickable — navigates to `/client/projects/<id>?tab=requirements`
- Used in both `ClientDashboard.tsx` and `FreelancerDashboard.tsx`

#### `UnassignButton` (`components/project/UnassignButton.tsx`)
- Props: `projectId: number, freelancerName: string, onSuccess: () => void`
- Renders an "Unassign Freelancer" button
- On click: shows `AlertDialog` confirmation
- On confirm: calls `POST /projects/<id>/unassign`
- Shown only when `project.awarded_freelancer_id` is set and user is client or admin

#### Bid form updates (`pages/freelancer/Browse.tsx`)
- After bid amount is entered, compute `over_budget` and `over_duration` client-side
- Show a yellow `Alert` component when either condition is true
- Display percentage difference (e.g., "23% above budget")

#### Bid list updates (client project detail page)
- For each bid, show a `Badge` with "Over Budget" or "Over Timeline" when applicable
- Show percentage difference next to the badge

#### `CreateProject.tsx` updates
- Change the SRS upload `accept` attribute to include `.md` in addition to `.pdf,.doc,.docx`
- After upload, call `POST /projects/<id>/parse-requirements` for `.md` files
- Add a "Generate SRS PDF" button that calls `POST /projects/<id>/generate-srs`

---

## Data Models

### New: `Notification` model

```python
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)          # "unassignment", "bid_accepted", etc.
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)   # 90 days from creation

    user = relationship("User")
    project = relationship("Project")
```

### New: `UnassignmentLog` model (audit)

```python
class UnassignmentLog(Base):
    __tablename__ = "unassignment_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    unassigned_freelancer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    performed_at = Column(DateTime, default=utcnow)
```

### Modified: `Bid` model

Add computed fields to the serializer (no schema change needed):
- `over_budget: bool` — `amount > project.budget_max`
- `over_duration: bool` — `estimated_duration_days > project.duration_days`
- `budget_diff_pct: float | None` — `((amount - budget_max) / budget_max) * 100` when `budget_max > 0`
- `duration_diff_pct: float | None` — `((estimated_duration_days - duration_days) / duration_days) * 100` when `duration_days > 0`

These are computed at serialization time in `_serialize_bid()` and require the project context to be passed in.

### Modified: `Project` serializer

The `_serialize_project()` function will pass project budget/duration context to `_serialize_bid()` so bid comparison fields can be computed.

### Schema additions (`schemas.py`)

```python
class BidCreate(BaseModel):
    project_id: int
    amount: float
    estimated_duration_days: Optional[int] = None
    proposal: Optional[str] = None
    milestone_breakdown: Optional[dict] = None

class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    project_id: Optional[int]
    is_read: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Requirements extraction round-trip

*For any* list of requirement strings embedded in a valid markdown document under the `## Requirements` heading, parsing the document should return a list containing every one of those strings (with exact text preserved).

**Validates: Requirements 1.2, 1.3, 6.2, 6.3**

### Property 2: Non-Requirements sections are excluded

*For any* markdown document where arbitrary text appears in the `## Introduction` or `## Context` sections, none of that text should appear in the extracted requirements list.

**Validates: Requirements 1.3, 6.1**

### Property 3: Sequential order_index assignment

*For any* document with N extracted requirements, the resulting records should have `order_index` values that form a contiguous sequence starting at 0 (i.e., 0, 1, 2, ..., N-1).

**Validates: Requirements 6.4**

### Property 4: Type and priority are always valid enum values

*For any* requirement text string, the parser's type classifier should return a value in `{FR, NFR, UI, CONSTRAINT, ASSUMPTION}` and the priority classifier should return a value in `{HIGH, MEDIUM, LOW}`.

**Validates: Requirements 6.5, 6.6**

### Property 5: Unassignment resets project state completely

*For any* project that has an assigned freelancer (i.e., `awarded_freelancer_id` is set and `status` is `"in_progress"`), after the unassign action is executed, the project should have `awarded_freelancer_id = null`, `awarded_at = null`, and `status = "open"`.

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 6: Unassignment preserves bids

*For any* project with N bids, after the unassign action is executed, the project should still have exactly N bids with identical content.

**Validates: Requirements 4.6**

### Property 7: Bids are accepted regardless of budget or duration

*For any* bid amount ≥ 0 and any estimated duration ≥ 1, the bid submission endpoint should accept the bid (return HTTP 200/201) regardless of the project's `budget_max` or `duration_days`.

**Validates: Requirements 5.1, 5.2, 5.8**

### Property 8: Budget and duration percentage differences are computed correctly

*For any* bid amount B and project `budget_max` M where M > 0, `budget_diff_pct = ((B - M) / M) * 100`. Similarly, for any bid duration D and project `duration_days` P where P > 0, `duration_diff_pct = ((D - P) / P) * 100`. Both values should be present in the bid serialization when the project context is available.

**Validates: Requirements 5.9, 5.10**

### Property 9: Over-budget and over-duration flags are consistent with percentage differences

*For any* bid, `over_budget` should be `true` if and only if `budget_diff_pct > 0`, and `over_duration` should be `true` if and only if `duration_diff_pct > 0`.

**Validates: Requirements 5.3, 5.4, 5.6, 5.7**

### Property 10: Dashboard requirement count matches stored records

*For any* project with N requirement records in the database, the requirements widget rendered for that project should display N as the total count, and the fulfilled count should equal the number of records with `status = "fulfilled"`.

**Validates: Requirements 2.3, 8.2, 8.3**

### Property 11: New notifications are unread by default

*For any* notification created by the unassignment action, `is_read` should be `false` immediately after creation.

**Validates: Requirements 10.7**

### Property 12: SRS PDF contains all required section headings

*For any* requirements document passed to the SRS generator, the resulting PDF text content should contain all four required section headings: "Introduction", "Functional Requirements", "Non-Functional Requirements", and "Constraints".

**Validates: Requirements 3.4, 7.2**

---

## Error Handling

### Markdown Parser
- If the `## Requirements` section is missing: return an empty list and log a warning. Do not raise an exception — the caller (API endpoint) will return a 200 with `requirements_extracted: 0` and a `warning` field.
- If a list item is empty after stripping: skip it silently.
- If the document is not valid UTF-8: return HTTP 400 with `"error": "invalid_encoding"`.

### SRS Generator
- **Groq API timeout** (>25s): raise `GroqAPIError("timeout")`. The endpoint returns HTTP 504 with a retry-able error message.
- **Groq API rate limit** (HTTP 429): retry with exponential backoff (1s, 2s, 4s). If all retries exhausted, return HTTP 503 with `"error": "groq_rate_limited"` and `"retry_after"` hint.
- **Groq API auth failure** (HTTP 401): log the error, disable the generate-SRS feature flag for the session, return HTTP 500 with `"error": "groq_auth_failed"`.
- **PDF rendering failure**: return HTTP 500 with `"error": "pdf_render_failed"`. The requirements are already stored; only the PDF step failed.
- **Invalid Groq response** (JSON parse error): fall back to treating the entire response as the "Introduction" section and generating a minimal PDF.

### Unassignment
- **Project not found**: HTTP 404.
- **Project has no assigned freelancer**: HTTP 409 with `"error": "not_assigned"`.
- **Caller is not client or admin**: HTTP 403.
- **Notification creation failure**: log the error but do not roll back the unassignment. The unassignment is the primary operation; notification is a best-effort side effect.

### Flexible Bidding
- **Negative bid amount**: HTTP 400 with `"error": "invalid_amount"`.
- **Zero or negative duration**: HTTP 400 with `"error": "invalid_duration"`.
- **Project not open**: HTTP 409 with `"error": "project_not_open"`.
- **Freelancer already has a bid on this project**: HTTP 409 with `"error": "duplicate_bid"` (existing behavior preserved).

---

## Testing Strategy

### Unit Tests

**`tests/test_md_parser.py`**
- Test `extract_section()` with documents that have all three sections, missing sections, and extra sections.
- Test `parse_requirements_document()` with bullet lists, numbered lists, and mixed formats.
- Test that Introduction/Context content does not appear in output.
- Test type and priority classification with representative requirement texts.

**`tests/test_srs_generator.py`**
- Test `build_pdf()` with a mock structured content dict — verify output is non-empty bytes.
- Test the Groq prompt construction function with various requirement counts.
- Test retry logic with a mock that fails N times then succeeds.
- Test timeout handling with a mock that sleeps longer than the timeout.

**`tests/test_bid_validation.py`**
- Test that bids above `budget_max` are accepted.
- Test that bids above `duration_days` are accepted.
- Test `budget_diff_pct` and `duration_diff_pct` calculations.
- Test `over_budget` / `over_duration` flag consistency.

**`tests/test_unassignment.py`**
- Test that unassignment resets all three fields (`awarded_freelancer_id`, `awarded_at`, `status`).
- Test that bids are preserved after unassignment.
- Test that a notification record is created.
- Test that non-client/non-admin users receive 403.
- Test that unassigning an already-open project returns 409.

### Property-Based Tests

Using **Hypothesis** (Python property-based testing library). Each property test runs a minimum of 100 iterations.

**`tests/test_properties.py`**

```python
# Feature: freelancetrace-enhancements, Property 1: Requirements extraction round-trip
@given(st.lists(st.text(min_size=10, max_size=200), min_size=1, max_size=50))
def test_requirements_round_trip(requirement_texts):
    ...

# Feature: freelancetrace-enhancements, Property 2: Non-Requirements sections excluded
@given(st.text(min_size=1), st.text(min_size=1))
def test_non_requirements_sections_excluded(intro_text, context_text):
    ...

# Feature: freelancetrace-enhancements, Property 3: Sequential order_index
@given(st.lists(st.text(min_size=10), min_size=1, max_size=100))
def test_sequential_order_index(requirement_texts):
    ...

# Feature: freelancetrace-enhancements, Property 4: Valid type and priority enums
@given(st.text(min_size=5, max_size=300))
def test_type_priority_valid_enums(requirement_text):
    ...

# Feature: freelancetrace-enhancements, Property 5: Unassignment resets project state
@given(st.integers(min_value=1), st.integers(min_value=1))
def test_unassignment_resets_state(project_id, freelancer_id):
    ...

# Feature: freelancetrace-enhancements, Property 6: Unassignment preserves bids
@given(st.lists(st.fixed_dictionaries({...}), min_size=0, max_size=20))
def test_unassignment_preserves_bids(bids):
    ...

# Feature: freelancetrace-enhancements, Property 7: Bids accepted regardless of budget
@given(st.floats(min_value=0, max_value=1e9), st.integers(min_value=1, max_value=3650))
def test_bids_accepted_beyond_budget(amount, duration):
    ...

# Feature: freelancetrace-enhancements, Property 8: Percentage difference calculation
@given(
    st.floats(min_value=0, max_value=1e9),
    st.floats(min_value=1, max_value=1e9),
)
def test_budget_diff_pct_correct(bid_amount, budget_max):
    ...

# Feature: freelancetrace-enhancements, Property 9: Flag consistency with percentage
@given(
    st.floats(min_value=0, max_value=1e9),
    st.floats(min_value=1, max_value=1e9),
)
def test_over_budget_flag_consistent(bid_amount, budget_max):
    ...

# Feature: freelancetrace-enhancements, Property 10: Dashboard count matches DB
@given(st.lists(st.sampled_from(["not_started", "in_progress", "fulfilled"]), min_size=0, max_size=50))
def test_dashboard_count_matches_db(statuses):
    ...

# Feature: freelancetrace-enhancements, Property 11: New notifications unread
@given(st.integers(min_value=1), st.integers(min_value=1))
def test_new_notifications_unread(project_id, user_id):
    ...

# Feature: freelancetrace-enhancements, Property 12: SRS PDF contains required sections
@given(st.lists(st.text(min_size=10, max_size=200), min_size=1, max_size=30))
def test_srs_pdf_contains_required_sections(requirements):
    ...
```

### Integration Tests

- End-to-end test: upload a markdown requirements document → verify requirements are stored in DB.
- End-to-end test: trigger SRS generation with a mocked Groq API → verify PDF file is created and URL is returned.
- End-to-end test: unassign a freelancer → verify project state, notification, and audit log.
- End-to-end test: submit a bid above budget → verify it is accepted and warning flags are present in response.

### Frontend Tests (Vitest + React Testing Library)

- `RequirementsWidget`: renders correct counts for a given project fixture.
- `UnassignButton`: shows confirmation dialog before calling API; calls API on confirm.
- Bid form: shows warning when bid amount exceeds `budget_max`; shows warning when duration exceeds `duration_days`.
- Bid list: renders "Over Budget" badge for bids with `over_budget: true`.
