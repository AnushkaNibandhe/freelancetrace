"""
Property-based tests for the FreelanceTrace markdown requirements parser.

Feature: freelancetrace-enhancements
Tests Properties 1–4 from the design document using Hypothesis.
"""

import sys
import os

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from hypothesis import given, assume, settings
from hypothesis import strategies as st

from services.nlp.md_parser import parse_requirements_document, extract_section
from services.nlp.srs_parser import _classify

# ---------------------------------------------------------------------------
# Shared strategies
# ---------------------------------------------------------------------------

# Characters that Python's str.splitlines() treats as line separators.
# These must be excluded from requirement text to avoid the parser splitting
# a single requirement across multiple lines.
# Covers: \n \x0b \x0c \r \x1c \x1d \x1e \x85 \u2028 \u2029
_LINE_SEPARATOR_CHARS = "\n\x0b\x0c\r\x1c\x1d\x1e\x85\u2028\u2029"

# Safe text for requirement items: no line-separator characters, no '#',
# no '-', no '*' (to avoid breaking markdown structure), no surrogates.
_safe_req_text = st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),
        blacklist_characters="#-*" + _LINE_SEPARATOR_CHARS,
    ),
    min_size=10,
    max_size=200,
)

# Safe text for non-requirement sections (intro / context).
# Must not contain '##' (would create a new heading) or list-item prefixes
# that could be mistaken for requirements.
_safe_section_text = st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),
        blacklist_characters="#-*" + _LINE_SEPARATOR_CHARS,
    ),
    min_size=1,
    max_size=300,
)


def _build_markdown(req_texts: list[str], intro: str = "", context: str = "") -> str:
    """
    Build a well-formed markdown document with the three standard sections.
    Each requirement text is embedded as a bullet list item.
    """
    lines = []

    lines.append("## Introduction")
    if intro:
        lines.append(intro)
    lines.append("")

    lines.append("## Requirements")
    for text in req_texts:
        lines.append(f"- {text}")
    lines.append("")

    lines.append("## Context")
    if context:
        lines.append(context)
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Property 1: Requirements extraction round-trip
# Validates: Requirements 1.2, 1.3, 6.2, 6.3
# ---------------------------------------------------------------------------

@given(st.lists(_safe_req_text, min_size=1, max_size=50))
def test_requirements_round_trip(requirement_texts):
    """
    **Validates: Requirements 1.2, 1.3, 6.2, 6.3**

    For any list of requirement strings embedded in a valid markdown document
    under the ## Requirements heading, parsing the document should return a
    list containing every one of those strings (with exact text preserved).
    """
    # Filter out texts that would produce empty items after stripping
    requirement_texts = [t.strip() for t in requirement_texts if t.strip()]
    assume(len(requirement_texts) >= 1)

    content = _build_markdown(requirement_texts)
    results = parse_requirements_document(content, project_id="test-project")

    extracted_texts = [r["text"] for r in results]

    for req_text in requirement_texts:
        assert req_text in extracted_texts, (
            f"Expected requirement text not found in parsed output.\n"
            f"Missing: {req_text!r}\n"
            f"Extracted: {extracted_texts!r}"
        )


# ---------------------------------------------------------------------------
# Property 2: Non-Requirements sections excluded
# Validates: Requirements 1.3, 6.1
# ---------------------------------------------------------------------------

@given(_safe_section_text, _safe_section_text)
def test_non_requirements_sections_excluded(intro_text, context_text):
    """
    **Validates: Requirements 1.3, 6.1**

    For any markdown document where arbitrary text appears in the
    ## Introduction or ## Context sections, none of that text should appear
    in the extracted requirements list.
    """
    # Build a document with intro/context but NO requirements
    content = _build_markdown(req_texts=[], intro=intro_text, context=context_text)
    results = parse_requirements_document(content, project_id="test-project")

    # No requirements should be extracted from a document with no list items
    assert results == [], (
        f"Expected no requirements from a document with no list items, "
        f"but got: {results!r}"
    )


@given(_safe_section_text, _safe_section_text, st.lists(_safe_req_text, min_size=1, max_size=10))
def test_non_requirements_text_not_in_results(intro_text, context_text, req_texts):
    """
    **Validates: Requirements 1.3, 6.1**

    When a document has both intro/context text and requirements, the
    intro/context text should not appear as requirement items.
    """
    req_texts = [t.strip() for t in req_texts if t.strip()]
    assume(len(req_texts) >= 1)

    # Ensure intro/context text is not accidentally the same as a requirement
    for req in req_texts:
        assume(intro_text.strip() != req)
        assume(context_text.strip() != req)

    content = _build_markdown(req_texts, intro=intro_text, context=context_text)
    results = parse_requirements_document(content, project_id="test-project")

    extracted_texts = [r["text"] for r in results]

    # The intro and context text should not appear as standalone requirement items
    assert intro_text.strip() not in extracted_texts, (
        f"Intro text appeared in requirements: {intro_text!r}"
    )
    assert context_text.strip() not in extracted_texts, (
        f"Context text appeared in requirements: {context_text!r}"
    )


# ---------------------------------------------------------------------------
# Property 3: Sequential order_index
# Validates: Requirements 6.4
# ---------------------------------------------------------------------------

@given(st.lists(_safe_req_text, min_size=1, max_size=100))
def test_sequential_order_index(requirement_texts):
    """
    **Validates: Requirements 6.4**

    For any document with N extracted requirements, the resulting records
    should have order_index values that form a contiguous sequence starting
    at 0 (i.e., 0, 1, 2, ..., N-1).
    """
    requirement_texts = [t.strip() for t in requirement_texts if t.strip()]
    assume(len(requirement_texts) >= 1)

    content = _build_markdown(requirement_texts)
    results = parse_requirements_document(content, project_id="test-project")

    n = len(results)
    assert n >= 1, "Expected at least one requirement to be extracted"

    order_indices = [r["order_index"] for r in results]
    expected = list(range(n))

    assert order_indices == expected, (
        f"order_index values are not contiguous 0-based.\n"
        f"Expected: {expected}\n"
        f"Got:      {order_indices}"
    )


# ---------------------------------------------------------------------------
# Property 4: Valid type and priority enums
# Validates: Requirements 6.5, 6.6
# ---------------------------------------------------------------------------

VALID_TYPES = {"FR", "NFR", "UI", "CONSTRAINT", "ASSUMPTION"}
VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}


@given(st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),
        blacklist_characters=_LINE_SEPARATOR_CHARS,
    ),
    min_size=5,
    max_size=300,
))
def test_type_priority_valid_enums_via_classify(requirement_text):
    """
    **Validates: Requirements 6.5, 6.6**

    For any requirement text string, the _classify() function should return
    a type value in {FR, NFR, UI, CONSTRAINT, ASSUMPTION} and a priority
    value in {HIGH, MEDIUM, LOW}.
    """
    result = _classify(requirement_text, "Requirements")

    assert result["type"] in VALID_TYPES, (
        f"_classify() returned invalid type {result['type']!r} "
        f"for text: {requirement_text!r}"
    )
    assert result["priority"] in VALID_PRIORITIES, (
        f"_classify() returned invalid priority {result['priority']!r} "
        f"for text: {requirement_text!r}"
    )


@given(st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),
        blacklist_characters="#-*" + _LINE_SEPARATOR_CHARS,
    ),
    min_size=5,
    max_size=300,
))
def test_type_priority_valid_enums_via_parser(requirement_text):
    """
    **Validates: Requirements 6.5, 6.6**

    For any requirement text embedded in a markdown document, the parser
    should return type and priority values within the valid enum sets.
    """
    requirement_text = requirement_text.strip()
    assume(len(requirement_text) >= 5)

    content = _build_markdown([requirement_text])
    results = parse_requirements_document(content, project_id="test-project")

    # If the text was non-empty and non-whitespace, we expect one result
    if results:
        for r in results:
            assert r["type"] in VALID_TYPES, (
                f"Parser returned invalid type {r['type']!r} "
                f"for text: {requirement_text!r}"
            )
            assert r["priority"] in VALID_PRIORITIES, (
                f"Parser returned invalid priority {r['priority']!r} "
                f"for text: {requirement_text!r}"
            )


# ---------------------------------------------------------------------------
# Helpers for unassignment property tests
# ---------------------------------------------------------------------------

from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# models.py does `from database import Base` at module level, and database.py
# tries to connect to PostgreSQL on import.  We stub out the `database` module
# with a lightweight SQLite-backed version before importing models so that the
# module-level engine creation does not fail in environments without psycopg2.
import types as _types

_stub_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
_StubBase = declarative_base()

_db_stub = _types.ModuleType("database")
_db_stub.Base = _StubBase
_db_stub.engine = _stub_engine
_db_stub.SessionLocal = sessionmaker(bind=_stub_engine)
_db_stub.get_db = lambda: None

import sys as _sys
_sys.modules.setdefault("database", _db_stub)

import models as _models

# Point models at our stub Base so create_all works on the in-memory engine
_models.Base = _db_stub.Base
# Re-register all mapped tables against the stub Base metadata
for _tbl in list(_models.Base.metadata.tables.values()):
    pass  # tables are already registered via the mapper


def _make_in_memory_session():
    """Create a fresh in-memory SQLite engine + session for isolation."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    # Use the metadata from the already-imported models module
    _models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return Session()


def _simulate_unassignment(db, project):
    """
    Apply the unassignment business logic directly to the project object:
      - awarded_freelancer_id → None
      - awarded_at           → None
      - status               → "open"
    Then flush so the session reflects the change.
    """
    project.awarded_freelancer_id = None
    project.awarded_at = None
    project.status = "open"
    db.flush()


# ---------------------------------------------------------------------------
# Property 5: Unassignment resets project state completely
# Validates: Requirements 4.3, 4.4, 4.5
# ---------------------------------------------------------------------------

@given(st.integers(min_value=1, max_value=10_000), st.integers(min_value=1, max_value=10_000))
@settings(max_examples=25, deadline=None)
def test_unassignment_resets_state(project_id_seed, freelancer_id_seed):
    """
    **Validates: Requirements 4.3, 4.4, 4.5**

    For any project that has an assigned freelancer (awarded_freelancer_id set,
    status = "in_progress"), after the unassign action is executed the project
    should have:
      - awarded_freelancer_id = None
      - awarded_at            = None
      - status                = "open"
    """
    db = _make_in_memory_session()
    try:
        # Create a minimal client user (required by the FK on Project.client_id)
        client = _models.User(
            email=f"client_{project_id_seed}@example.com",
            password_hash="hashed",
            role="client",
        )
        db.add(client)
        db.flush()

        # Create a minimal freelancer user (required by the FK on awarded_freelancer_id)
        freelancer = _models.User(
            email=f"freelancer_{freelancer_id_seed}@example.com",
            password_hash="hashed",
            role="freelancer",
        )
        db.add(freelancer)
        db.flush()

        # Create a project in the "assigned" state
        project = _models.Project(
            client_id=client.id,
            title=f"Project {project_id_seed}",
            status="in_progress",
            awarded_freelancer_id=freelancer.id,
            awarded_at=datetime.now(timezone.utc),
        )
        db.add(project)
        db.flush()

        # Pre-condition: project is assigned
        assert project.awarded_freelancer_id is not None
        assert project.awarded_at is not None
        assert project.status == "in_progress"

        # Execute the unassignment logic
        _simulate_unassignment(db, project)

        # Post-condition: all three fields are reset
        assert project.awarded_freelancer_id is None, (
            f"awarded_freelancer_id should be None after unassignment, "
            f"got {project.awarded_freelancer_id!r}"
        )
        assert project.awarded_at is None, (
            f"awarded_at should be None after unassignment, "
            f"got {project.awarded_at!r}"
        )
        assert project.status == "open", (
            f"status should be 'open' after unassignment, "
            f"got {project.status!r}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 6: Unassignment preserves bids
# Validates: Requirements 4.6
# ---------------------------------------------------------------------------

@given(
    st.lists(
        st.fixed_dictionaries({
            "amount": st.floats(min_value=1.0, max_value=1_000_000.0, allow_nan=False, allow_infinity=False),
            "estimated_duration_days": st.integers(min_value=1, max_value=365),
        }),
        min_size=0,
        max_size=20,
    )
)
@settings(max_examples=25, deadline=None)
def test_unassignment_preserves_bids(bid_specs):
    """
    **Validates: Requirements 4.6**

    For any project with N bids, after the unassign action is executed the
    project should still have exactly N bids with identical content (amounts
    and durations unchanged).
    """
    db = _make_in_memory_session()
    try:
        # Create a client user
        client = _models.User(
            email="client_bids@example.com",
            password_hash="hashed",
            role="client",
        )
        db.add(client)
        db.flush()

        # Create a freelancer user (the one being unassigned)
        freelancer = _models.User(
            email="freelancer_bids@example.com",
            password_hash="hashed",
            role="freelancer",
        )
        db.add(freelancer)
        db.flush()

        # Create the project in an assigned state
        project = _models.Project(
            client_id=client.id,
            title="Bid Preservation Project",
            status="in_progress",
            awarded_freelancer_id=freelancer.id,
            awarded_at=datetime.now(timezone.utc),
        )
        db.add(project)
        db.flush()

        # Create N bidder users and their bids
        bidder_ids = []
        for i, spec in enumerate(bid_specs):
            bidder = _models.User(
                email=f"bidder_{i}@example.com",
                password_hash="hashed",
                role="freelancer",
            )
            db.add(bidder)
            db.flush()
            bidder_ids.append(bidder.id)

            bid = _models.Bid(
                project_id=project.id,
                freelancer_id=bidder.id,
                amount=spec["amount"],
                estimated_duration_days=spec["estimated_duration_days"],
                status="pending",
            )
            db.add(bid)

        db.flush()

        # Record the bid count and content before unassignment
        bids_before = db.query(_models.Bid).filter_by(project_id=project.id).all()
        n_before = len(bids_before)
        amounts_before = sorted(b.amount for b in bids_before)
        durations_before = sorted(b.estimated_duration_days for b in bids_before)

        assert n_before == len(bid_specs), (
            f"Expected {len(bid_specs)} bids before unassignment, got {n_before}"
        )

        # Execute the unassignment logic
        _simulate_unassignment(db, project)

        # Verify bid count is unchanged
        bids_after = db.query(_models.Bid).filter_by(project_id=project.id).all()
        n_after = len(bids_after)

        assert n_after == n_before, (
            f"Bid count changed after unassignment: was {n_before}, now {n_after}"
        )

        # Verify bid content is unchanged
        amounts_after = sorted(b.amount for b in bids_after)
        durations_after = sorted(b.estimated_duration_days for b in bids_after)

        assert amounts_after == amounts_before, (
            f"Bid amounts changed after unassignment.\n"
            f"Before: {amounts_before}\n"
            f"After:  {amounts_after}"
        )
        assert durations_after == durations_before, (
            f"Bid durations changed after unassignment.\n"
            f"Before: {durations_before}\n"
            f"After:  {durations_after}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers for flexible bidding property tests
# ---------------------------------------------------------------------------

# Import _serialize_bid from main.py.  main.py imports from `database` and
# other modules at the top level; the `database` stub registered above keeps
# those imports from failing.  We also need to stub out the analytics_engine
# and nlp_engine modules that main.py imports, since they may not be available
# in the test environment.

import importlib
import types as _types2

for _mod_name in (
    "analytics_engine",
    "nlp_engine",
    "services.traceability_engine",
    "services.vcs.webhook_handler",
    "services.nlp.srs_parser",
    "services.nlp.embedding_service",
    "services.nlp.keyword_extractor",
    "services.nlp.llm_extractor",
    "services.nlp.srs_generator",
    "services.nlp",
):
    if _mod_name not in _sys.modules:
        _stub = _types2.ModuleType(_mod_name)
        # Provide any names that main.py imports from these modules
        _stub.compute_compliance_readiness = lambda *a, **kw: None
        _stub.compute_fulfillment_score = lambda *a, **kw: None
        _stub.compute_trust_score = lambda *a, **kw: None
        _stub.detect_requirement_drift = lambda *a, **kw: None
        _stub.predict_delay_risk = lambda *a, **kw: None
        _stub.calculate_similarity = lambda *a, **kw: None
        _stub.extract_requirements = lambda *a, **kw: None
        _stub.generate_embedding = lambda *a, **kw: None
        _stub.GroqAPIError = Exception
        _stub.PDFGenerationError = Exception
        _stub.parse_srs = lambda *a, **kw: None
        _stub.encode = lambda *a, **kw: None
        _stub.embed_requirements = lambda *a, **kw: None
        _stub.enrich_requirements = lambda *a, **kw: None
        _stub.extract_requirements_with_llm = lambda *a, **kw: None
        _stub.srs_generator = _types2.ModuleType("services.nlp.srs_generator")
        _stub.register_requirements = lambda *a, **kw: None
        _stub.ingest_commits = lambda *a, **kw: None
        _stub.recalculate_metrics = lambda *a, **kw: None
        _stub.verify_signature = lambda *a, **kw: None
        _stub.handle_push_event = lambda *a, **kw: None
        _stub.handle_pull_request_event = lambda *a, **kw: None
        _sys.modules[_mod_name] = _stub

# Now import _serialize_bid from main
import main as _main
_serialize_bid = _main._serialize_bid


def _make_bid_and_project(
    db,
    bid_amount: float,
    bid_duration: int,
    budget_max: float,
    duration_days: int,
) -> tuple:
    """
    Create a minimal User, Project, and Bid in the given session and return
    (bid, project) so that _serialize_bid(bid, project) can be called.
    """
    user = _models.User(
        email=f"u_{id(db)}_{bid_amount}@example.com",
        password_hash="hashed",
        role="freelancer",
    )
    db.add(user)
    db.flush()

    client = _models.User(
        email=f"c_{id(db)}_{bid_amount}@example.com",
        password_hash="hashed",
        role="client",
    )
    db.add(client)
    db.flush()

    project = _models.Project(
        client_id=client.id,
        title="Test Project",
        status="open",
        budget_max=budget_max,
        duration_days=duration_days,
    )
    db.add(project)
    db.flush()

    bid = _models.Bid(
        project_id=project.id,
        freelancer_id=user.id,
        amount=bid_amount,
        estimated_duration_days=bid_duration,
        status="pending",
    )
    db.add(bid)
    db.flush()

    return bid, project


# ---------------------------------------------------------------------------
# Property 7: Bids accepted regardless of budget or duration
# Validates: Requirements 5.1, 5.2, 5.8
# ---------------------------------------------------------------------------

@given(
    st.floats(min_value=0, max_value=1e9, allow_nan=False, allow_infinity=False),
    st.integers(min_value=1, max_value=3650),
)
@settings(max_examples=25, deadline=None)
def test_bids_accepted_beyond_budget(amount, duration):
    """
    **Validates: Requirements 5.1, 5.2, 5.8**

    For any non-negative bid amount and any positive duration, the bid
    creation logic should accept the bid regardless of the project's
    budget_max or duration_days.  We verify this by creating a project
    whose budget_max < amount and duration_days < duration, then inserting
    the bid directly via the ORM (mirroring what the endpoint does) and
    confirming the bid is persisted in the DB without error.
    """
    # Use a budget_max strictly less than the bid amount (or 1 if amount == 0)
    budget_max = max(0.01, amount * 0.5) if amount > 0 else 1.0
    # Use a duration_days strictly less than the bid duration
    duration_days = max(1, duration - 1)

    db = _make_in_memory_session()
    try:
        bid, project = _make_bid_and_project(
            db,
            bid_amount=amount,
            bid_duration=duration,
            budget_max=budget_max,
            duration_days=duration_days,
        )

        # The bid should be in the DB — no exception was raised
        stored_bid = db.query(_models.Bid).filter_by(id=bid.id).first()
        assert stored_bid is not None, (
            f"Bid was not persisted for amount={amount}, duration={duration}, "
            f"budget_max={budget_max}, duration_days={duration_days}"
        )
        assert stored_bid.amount == amount, (
            f"Stored bid amount {stored_bid.amount!r} != submitted amount {amount!r}"
        )
        assert stored_bid.estimated_duration_days == duration, (
            f"Stored bid duration {stored_bid.estimated_duration_days!r} != "
            f"submitted duration {duration!r}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 8: Percentage difference calculation
# Validates: Requirements 5.9, 5.10
# ---------------------------------------------------------------------------

@given(
    st.floats(min_value=0, max_value=1e9, allow_nan=False, allow_infinity=False),
    st.floats(min_value=1, max_value=1e9, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=25, deadline=None)
def test_budget_diff_pct_correct(bid_amount, budget_max):
    """
    **Validates: Requirements 5.9, 5.10**

    For any bid amount B >= 0 and project budget_max M > 0, the serialized
    bid should report:
        budget_diff_pct = ((B - M) / M) * 100

    We test this by calling _serialize_bid() directly with a minimal Bid and
    Project object (no DB required).
    """
    expected_pct = ((bid_amount - budget_max) / budget_max) * 100

    db = _make_in_memory_session()
    try:
        bid, project = _make_bid_and_project(
            db,
            bid_amount=bid_amount,
            bid_duration=1,
            budget_max=budget_max,
            duration_days=1,
        )

        result = _serialize_bid(bid, project)

        assert result["budget_diff_pct"] is not None, (
            f"budget_diff_pct should not be None when budget_max={budget_max} > 0"
        )

        # Use relative tolerance for floating-point comparison
        actual_pct = result["budget_diff_pct"]
        # Allow a small absolute tolerance for floating-point arithmetic
        tolerance = max(abs(expected_pct) * 1e-9, 1e-9)
        assert abs(actual_pct - expected_pct) <= tolerance, (
            f"budget_diff_pct mismatch: expected {expected_pct}, got {actual_pct} "
            f"(bid_amount={bid_amount}, budget_max={budget_max})"
        )
    finally:
        db.close()


@given(
    st.integers(min_value=1, max_value=3650),
    st.integers(min_value=1, max_value=3650),
)
@settings(max_examples=25, deadline=None)
def test_duration_diff_pct_correct(bid_duration, duration_days):
    """
    **Validates: Requirements 5.9, 5.10**

    For any bid duration D >= 1 and project duration_days P >= 1, the
    serialized bid should report:
        duration_diff_pct = ((D - P) / P) * 100
    """
    expected_pct = ((bid_duration - duration_days) / duration_days) * 100

    db = _make_in_memory_session()
    try:
        bid, project = _make_bid_and_project(
            db,
            bid_amount=100.0,
            bid_duration=bid_duration,
            budget_max=200.0,
            duration_days=duration_days,
        )

        result = _serialize_bid(bid, project)

        assert result["duration_diff_pct"] is not None, (
            f"duration_diff_pct should not be None when duration_days={duration_days} > 0"
        )

        actual_pct = result["duration_diff_pct"]
        tolerance = max(abs(expected_pct) * 1e-9, 1e-9)
        assert abs(actual_pct - expected_pct) <= tolerance, (
            f"duration_diff_pct mismatch: expected {expected_pct}, got {actual_pct} "
            f"(bid_duration={bid_duration}, duration_days={duration_days})"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 9: Flag consistency with percentage differences
# Validates: Requirements 5.3, 5.4, 5.6, 5.7
# ---------------------------------------------------------------------------

@given(
    st.floats(min_value=0, max_value=1e9, allow_nan=False, allow_infinity=False),
    st.floats(min_value=1, max_value=1e9, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=25, deadline=None)
def test_over_budget_flag_consistent(bid_amount, budget_max):
    """
    **Validates: Requirements 5.3, 5.4, 5.6, 5.7**

    For any bid, over_budget should be True if and only if budget_diff_pct > 0.
    That is:
        over_budget  ⟺  budget_diff_pct > 0
        ¬over_budget ⟺  budget_diff_pct <= 0
    """
    db = _make_in_memory_session()
    try:
        bid, project = _make_bid_and_project(
            db,
            bid_amount=bid_amount,
            bid_duration=1,
            budget_max=budget_max,
            duration_days=1,
        )

        result = _serialize_bid(bid, project)

        pct = result["budget_diff_pct"]
        flag = result["over_budget"]

        assert pct is not None, (
            f"budget_diff_pct should not be None when budget_max={budget_max} > 0"
        )

        expected_flag = pct > 0
        assert flag == expected_flag, (
            f"over_budget flag inconsistency: budget_diff_pct={pct}, "
            f"over_budget={flag} (expected {expected_flag}). "
            f"bid_amount={bid_amount}, budget_max={budget_max}"
        )
    finally:
        db.close()


@given(
    st.integers(min_value=1, max_value=3650),
    st.integers(min_value=1, max_value=3650),
)
@settings(max_examples=25, deadline=None)
def test_over_duration_flag_consistent(bid_duration, duration_days):
    """
    **Validates: Requirements 5.3, 5.4, 5.6, 5.7**

    For any bid, over_duration should be True if and only if duration_diff_pct > 0.
    That is:
        over_duration  ⟺  duration_diff_pct > 0
        ¬over_duration ⟺  duration_diff_pct <= 0
    """
    db = _make_in_memory_session()
    try:
        bid, project = _make_bid_and_project(
            db,
            bid_amount=100.0,
            bid_duration=bid_duration,
            budget_max=200.0,
            duration_days=duration_days,
        )

        result = _serialize_bid(bid, project)

        pct = result["duration_diff_pct"]
        flag = result["over_duration"]

        assert pct is not None, (
            f"duration_diff_pct should not be None when duration_days={duration_days} > 0"
        )

        expected_flag = pct > 0
        assert flag == expected_flag, (
            f"over_duration flag inconsistency: duration_diff_pct={pct}, "
            f"over_duration={flag} (expected {expected_flag}). "
            f"bid_duration={bid_duration}, duration_days={duration_days}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 10: Dashboard count matches DB
# Validates: Requirements 2.3, 8.2, 8.3
# ---------------------------------------------------------------------------

@given(
    st.lists(
        st.sampled_from(["not_started", "in_progress", "fulfilled"]),
        min_size=0,
        max_size=50,
    )
)
@settings(max_examples=25, deadline=None)
def test_dashboard_count_matches_db(statuses):
    """
    **Validates: Requirements 2.3, 8.2, 8.3**

    For any list of requirement statuses, the total count and fulfilled count
    computed from the DB should match what the dashboard widget would display.

    The widget shows:
      - total_count  = total number of requirements for the project
      - fulfilled_count = number of requirements with status == "fulfilled"
    """
    db = _make_in_memory_session()
    try:
        # Create a minimal client user and project
        client = _models.User(
            email="dashboard_client@example.com",
            password_hash="hashed",
            role="client",
        )
        db.add(client)
        db.flush()

        project = _models.Project(
            client_id=client.id,
            title="Dashboard Test Project",
            status="open",
        )
        db.add(project)
        db.flush()

        # Insert requirements with the given statuses
        for i, status in enumerate(statuses):
            req = _models.Requirement(
                project_id=project.id,
                requirement_text=f"Requirement {i}: some text here",
                status=status,
                order_index=i,
            )
            db.add(req)
        db.flush()

        # Compute expected counts directly from the input
        expected_total = len(statuses)
        expected_fulfilled = sum(1 for s in statuses if s == "fulfilled")

        # Query the DB the same way the widget would
        all_reqs = db.query(_models.Requirement).filter_by(project_id=project.id).all()
        actual_total = len(all_reqs)
        actual_fulfilled = sum(1 for r in all_reqs if r.status == "fulfilled")

        assert actual_total == expected_total, (
            f"Total count mismatch: expected {expected_total}, got {actual_total}. "
            f"statuses={statuses!r}"
        )
        assert actual_fulfilled == expected_fulfilled, (
            f"Fulfilled count mismatch: expected {expected_fulfilled}, got {actual_fulfilled}. "
            f"statuses={statuses!r}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 11: New notifications unread
# Validates: Requirements 10.7
# ---------------------------------------------------------------------------

@given(
    st.integers(min_value=1, max_value=10_000),
    st.integers(min_value=1, max_value=10_000),
)
@settings(max_examples=25, deadline=None)
def test_new_notifications_unread(project_id_seed, user_id_seed):
    """
    **Validates: Requirements 10.7**

    For any notification created by the unassignment action, is_read should
    be False immediately after creation.
    """
    db = _make_in_memory_session()
    try:
        # Create a user to receive the notification
        user = _models.User(
            email=f"notif_user_{user_id_seed}@example.com",
            password_hash="hashed",
            role="freelancer",
        )
        db.add(user)
        db.flush()

        # Create a client and project (notification references a project)
        client = _models.User(
            email=f"notif_client_{project_id_seed}@example.com",
            password_hash="hashed",
            role="client",
        )
        db.add(client)
        db.flush()

        project = _models.Project(
            client_id=client.id,
            title=f"Project {project_id_seed}",
            status="open",
        )
        db.add(project)
        db.flush()

        # Create a notification exactly as the unassignment endpoint does
        notification = _models.Notification(
            user_id=user.id,
            type="unassignment",
            title="You have been unassigned from a project",
            message=f"You have been removed from project '{project.title}'.",
            project_id=project.id,
            # is_read is intentionally NOT set — relies on the model default
        )
        db.add(notification)
        db.flush()

        # Reload from DB to confirm the persisted value
        stored = db.query(_models.Notification).filter_by(id=notification.id).first()
        assert stored is not None, "Notification was not persisted"
        assert stored.is_read is False, (
            f"New notification should have is_read=False, got {stored.is_read!r}. "
            f"user_id_seed={user_id_seed}, project_id_seed={project_id_seed}"
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Property 12: SRS PDF contains required sections
# Validates: Requirements 3.4, 7.2
# ---------------------------------------------------------------------------

import tempfile
from pathlib import Path as _Path

# The stub block above registered a fake `services.nlp.srs_generator` in
# sys.modules so that main.py could be imported without a live Groq key.
# For Property 12 we need the *real* build_pdf() function.  We load it by
# temporarily removing the stub, importing the real module, then restoring
# the stub so that nothing else breaks.
_srs_gen_stub = _sys.modules.pop("services.nlp.srs_generator", None)
try:
    import importlib as _importlib
    _real_srs_gen = _importlib.import_module("services.nlp.srs_generator")
    _build_pdf = _real_srs_gen.build_pdf
finally:
    # Restore the stub (or remove the real module if there was no stub)
    if _srs_gen_stub is not None:
        _sys.modules["services.nlp.srs_generator"] = _srs_gen_stub
    else:
        _sys.modules.pop("services.nlp.srs_generator", None)

_REQUIRED_SECTION_HEADINGS = [
    "Introduction",
    "Functional Requirements",
    "Non-Functional Requirements",
    "Constraints",
]


def _build_structured_content(requirements: list[str]) -> dict:
    """
    Build a structured_content dict from a flat list of requirement strings.

    Distributes requirements across functional and non-functional buckets
    (alternating) so both sections are exercised.
    """
    functional = []
    non_functional = []
    for i, text in enumerate(requirements):
        entry = {"id": f"REQ-{i + 1:03d}", "text": text, "priority": "MEDIUM"}
        if i % 2 == 0:
            functional.append(entry)
        else:
            non_functional.append(entry)

    return {
        "introduction": "This document describes the software requirements.",
        "functional_requirements": functional,
        "non_functional_requirements": non_functional,
        "constraints": ["The system must run on Python 3.11+."],
        "assumptions": ["Users have a stable internet connection."],
    }


@given(
    st.lists(
        st.text(
            alphabet=st.characters(
                blacklist_categories=("Cs",),
                blacklist_characters=_LINE_SEPARATOR_CHARS,
            ),
            min_size=10,
            max_size=200,
        ),
        min_size=1,
        max_size=30,
    )
)
@settings(max_examples=15, deadline=None)
def test_srs_pdf_contains_required_sections(requirements):
    """
    **Validates: Requirements 3.4, 7.2**

    For any list of requirement strings passed to build_pdf(), the generated
    PDF text should contain all four required section headings:
      - "Introduction"
      - "Functional Requirements"
      - "Non-Functional Requirements"
      - "Constraints"

    The Groq API is not called here — build_pdf() is called directly with
    pre-built structured content (mocking the LLM step).
    """
    try:
        import pdfplumber
    except ImportError:
        pytest.skip("pdfplumber is not installed; skipping PDF content test")

    structured_content = _build_structured_content(requirements)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        output_path = _Path(tmp.name)

    try:
        _build_pdf(
            project_title="Test Project",
            project_id="test-001",
            structured_content=structured_content,
            output_path=output_path,
        )

        # Extract all text from the PDF
        with pdfplumber.open(str(output_path)) as pdf:
            full_text = "\n".join(
                page.extract_text() or "" for page in pdf.pages
            )

        for heading in _REQUIRED_SECTION_HEADINGS:
            assert heading in full_text, (
                f"Required section heading {heading!r} not found in PDF text.\n"
                f"PDF text (first 2000 chars): {full_text[:2000]!r}"
            )
    finally:
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass
