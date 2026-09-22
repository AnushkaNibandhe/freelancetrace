# Tasks

## Feature 1: Simplified Requirements Document Format & Parser

- [x] 1.1 Create `services/nlp/md_parser.py` with `extract_section()` and `parse_requirements_document()` functions
  - Parse markdown documents split by `##` headings
  - Extract list items (bullet `-`, `*`, or numbered `1.`) from the `## Requirements` section only
  - Reuse `_classify()` from `srs_parser.py` for type/priority detection
  - Assign sequential `order_index` starting at 0
  - Return list of requirement dicts with `req_id`, `seq`, `project_id`, `text`, `section`, `type`, `priority`, `order_index`

- [x] 1.2 Add `POST /projects/<id>/parse-requirements` endpoint to `main.py`
  - Accept `multipart/form-data` with a `file` field (`.md` or `.txt`)
  - Require Bearer token auth; restrict to project owner or admin
  - Call `md_parser.parse_requirements_document()`
  - Delete existing requirements for the project, then insert new ones
  - Return `{ "requirements_extracted": int, "requirements": [...], "warning": str | null }`

- [x] 1.3 Update `CreateProject.tsx` to accept `.md` files
  - Add `.md` to the `accept` attribute of the SRS file input
  - After project creation, call `POST /projects/<id>/parse-requirements` for `.md` files (instead of the existing SRS upload path)
  - Show extracted requirement count in the success state

## Feature 2: SRS PDF Generation via Groq LLM

- [x] 2.1 Create `services/nlp/srs_generator.py` with `generate_srs_pdf()` and `build_pdf()` functions
  - Implement Groq API call with the structured JSON prompt
  - Implement exponential backoff retry (1s, 2s, 4s; max 3 attempts; 25s total timeout)
  - Implement `build_pdf()` using ReportLab to render title page, TOC, numbered requirements (REQ-001 format), and footer
  - Add `GroqAPIError` and `PDFGenerationError` custom exceptions

- [x] 2.2 Add `POST /projects/<id>/generate-srs` endpoint to `main.py`
  - Accept JSON `{ "requirements_content": string }` or read from stored project requirements
  - Require Bearer token auth; restrict to project owner
  - Call `srs_generator.generate_srs_pdf()` in a background thread (use `threading.Thread`)
  - Store the PDF in `uploads/` and update `project.srs_file_url`
  - Return `{ "file_url": string, "page_count": int }` on success
  - Return appropriate HTTP error codes for timeout (504), rate limit (503), auth failure (500)

- [x] 2.3 Add Groq API key configuration
  - Read `GROQ_API_KEY` from environment variables in `srs_generator.py`
  - Log an error and set a module-level `_GROQ_AVAILABLE = False` flag if the key is missing or empty
  - The generate-SRS endpoint should return HTTP 503 with `"error": "groq_not_configured"` when `_GROQ_AVAILABLE` is False

- [x] 2.4 Add "Generate SRS PDF" button to the client project detail page
  - Show the button only when the user is the project owner
  - On click, call `POST /projects/<id>/generate-srs` and show a loading spinner
  - On success, show a download link for the generated PDF
  - On error, show an error toast with a retry option

## Feature 3: Project Unassignment

- [x] 3.1 Add `Notification` and `UnassignmentLog` models to `models.py`
  - `Notification`: `id`, `user_id`, `type`, `title`, `message`, `project_id`, `is_read` (default False), `created_at`, `expires_at`
  - `UnassignmentLog`: `id`, `project_id`, `unassigned_freelancer_id`, `performed_by_id`, `reason`, `performed_at`
  - Run `models.Base.metadata.create_all()` to create the new tables (handled automatically on startup)

- [x] 3.2 Add `POST /projects/<id>/unassign` endpoint to `main.py`
  - Accept JSON `{ "reason": string (optional) }`
  - Require Bearer token auth; restrict to project client or admin (HTTP 403 otherwise)
  - Return HTTP 404 if project not found
  - Return HTTP 409 with `"error": "not_assigned"` if project has no assigned freelancer
  - Reset `awarded_freelancer_id` and `awarded_at` to null; set `status` to `"open"`
  - Create a `Notification` record for the unassigned freelancer (best-effort; log failure but don't roll back)
  - Create an `UnassignmentLog` record
  - Return `{ "project": {...}, "notification_id": int | null }`

- [x] 3.3 Add `GET /notifications` endpoint to `main.py`
  - Return notifications for the authenticated user, ordered by `created_at` desc
  - Support `?unread_only=true` query parameter
  - Return `{ "notifications": [...], "unread_count": int }`

- [x] 3.4 Add `PATCH /notifications/<id>/read` endpoint to `main.py`
  - Mark a notification as read (`is_read = true`)
  - Restrict to the notification's owner

- [x] 3.5 Create `UnassignButton` component (`frontend/src/components/project/UnassignButton.tsx`)
  - Props: `projectId: number`, `freelancerName: string`, `onSuccess: () => void`
  - Render an "Unassign Freelancer" button (destructive variant)
  - On click, show an `AlertDialog` confirmation with the freelancer's name
  - On confirm, call `POST /projects/<id>/unassign` and invoke `onSuccess` on completion
  - Show loading state during the API call

- [x] 3.6 Integrate `UnassignButton` into the client project detail page
  - Show the button only when `project.awarded_freelancer_id` is set and the current user is the client or admin
  - On success, invalidate the project query cache and show a success toast

## Feature 4: Flexible Bidding Beyond Budget

- [x] 4.1 Remove upper-bound bid validation from `main.py`
  - In the `POST /projects/<id>/bids` endpoint, remove any check that rejects `amount > budget_max`
  - Remove any check that rejects `estimated_duration_days > duration_days`
  - Keep validation for negative amounts and zero/negative durations (HTTP 400)

- [x] 4.2 Add bid comparison fields to `_serialize_bid()` in `main.py`
  - Update `_serialize_bid()` to accept an optional `project` parameter
  - Compute `over_budget: bool`, `over_duration: bool`, `budget_diff_pct: float | None`, `duration_diff_pct: float | None`
  - Update `_serialize_project()` to pass the project to `_serialize_bid()`

- [x] 4.3 Add bid warning UI to `Browse.tsx` (freelancer bid submission form)
  - After the bid amount input, compute `over_budget` client-side (`bidAmount > project.budget_max`)
  - After the duration input, compute `over_duration` client-side (`bidDuration > project.duration_days`)
  - Show a yellow `Alert` component with the percentage difference when either condition is true
  - The warning should not block submission

- [x] 4.4 Add bid highlight indicators to the client bid list view
  - For each bid with `over_budget: true`, show an amber `Badge` labeled "Over Budget (+X%)"
  - For each bid with `over_duration: true`, show an amber `Badge` labeled "Over Timeline (+X days)"
  - Ensure bids with these flags are still displayed and selectable by the client

## Feature 5: Dashboard Requirements Widget

- [x] 5.1 Create `RequirementsWidget` component (`frontend/src/components/dashboard/RequirementsWidget.tsx`)
  - Props: `project: Project`
  - Display: total requirement count, fulfilled count, progress bar (fulfilled/total × 100%), high-priority count
  - Show "No requirements defined" when `project.requirements` is empty
  - Make the entire card clickable; navigate to `/client/projects/<id>?tab=requirements` (or `/freelancer/projects/<id>?tab=requirements`)

- [x] 5.2 Integrate `RequirementsWidget` into `ClientDashboard.tsx`
  - Add the widget below or alongside each project card in the "Recent Projects" section
  - Use the existing `useClientProjects` hook data (requirements are already included in the project serialization)

- [x] 5.3 Integrate `RequirementsWidget` into `FreelancerDashboard.tsx`
  - Add the widget to each active project card in the "Active Projects" section
  - Use the existing `useFreelancerProjects` hook data

## Feature 6: Property-Based Tests

- [x] 6.1 Set up Hypothesis in the backend test environment
  - Add `hypothesis` to `requirements.txt`
  - Create `tests/` directory with `__init__.py` and `conftest.py`

- [x] 6.2 Write property tests for the markdown parser (`tests/test_properties.py`)
  - Property 1: Requirements extraction round-trip — generate random requirement lists, embed in markdown, parse, verify all texts are present
  - Property 2: Non-Requirements sections excluded — generate random intro/context text, verify none appears in extracted requirements
  - Property 3: Sequential order_index — verify extracted requirements have contiguous 0-based order_index values
  - Property 4: Valid type and priority enums — for any text, classifier returns values in the valid enum sets

- [x] 6.3 Write property tests for unassignment (`tests/test_properties.py`)
  - Property 5: Unassignment resets project state — for any assigned project, after unassign, state fields are null/open
  - Property 6: Unassignment preserves bids — for any project with N bids, after unassign, bid count is still N

- [x] 6.4 Write property tests for flexible bidding (`tests/test_properties.py`)
  - Property 7: Bids accepted regardless of budget — for any non-negative amount and positive duration, bid is accepted
  - Property 8: Percentage difference calculation — verify `((B - M) / M) * 100` formula for any B, M > 0
  - Property 9: Flag consistency — `over_budget` iff `budget_diff_pct > 0`; `over_duration` iff `duration_diff_pct > 0`

- [x] 6.5 Write property tests for dashboard and notifications (`tests/test_properties.py`)
  - Property 10: Dashboard count matches DB — for any list of requirement statuses, widget counts match DB counts
  - Property 11: New notifications unread — for any notification created by unassignment, `is_read` is False
  - Property 12: SRS PDF contains required sections — for any requirements input, generated PDF text contains all four section headings (use mocked Groq API)
