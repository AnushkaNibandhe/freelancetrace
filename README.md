
# FreelanceTrace

FreelanceTrace is a full-stack freelance project management platform that bridges the gap between what a client specifies and what a developer actually builds. It combines a traditional project marketplace (post projects, receive bids, hire freelancers) with an AI-powered traceability engine that automatically tracks how well the codebase satisfies the original requirements — in real time, as commits are pushed to GitHub.

---

## Table of Contents

- [What Problem Does It Solve?](#what-problem-does-it-solve)
- [How It Works — Plain English](#how-it-works--plain-english)
- [User Roles](#user-roles)
- [Complete Workflow Walkthroughs](#complete-workflow-walkthroughs)
  - [Client Workflow](#client-workflow)
  - [Freelancer Workflow](#freelancer-workflow)
  - [Admin Workflow](#admin-workflow)
  - [GitHub Integration Workflow](#github-integration-workflow)
  - [NLP Traceability Workflow](#nlp-traceability-workflow)
  - [SRS Document Generation Workflow](#srs-document-generation-workflow)
- [Features In Detail](#features-in-detail)
- [Analytics Dashboard Explained](#analytics-dashboard-explained)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Property-Based Testing](#property-based-testing)

---

## What Problem Does It Solve?

In traditional freelance platforms, a client posts a project, a freelancer builds it, and at the end the client checks whether it matches what they asked for. There is no visibility during development. The client has no way to know if the freelancer is building the right thing until it is too late.

FreelanceTrace solves this by connecting the project's requirements document directly to the GitHub repository. Every time the freelancer pushes code, the platform reads the commit messages, compares them to the requirements using AI, and updates a live dashboard showing exactly which requirements have been addressed and which have not.

---

## How It Works — Plain English

1. A client writes a list of requirements for their project (e.g. "users should be able to log in", "users should be able to create tasks").
2. They upload this as a simple text file. The platform reads it and stores each requirement separately.
3. Freelancers browse the project, submit bids, and the client picks one.
4. The freelancer connects their GitHub repository to the project.
5. As the freelancer pushes commits with descriptive messages, the platform reads each message and compares it to every requirement using a language AI model.
6. When a commit message is semantically close enough to a requirement (e.g. "Allow users to log in with email and password" matches "users should be able to log in"), that requirement is marked as addressed.
7. The client sees a live dashboard showing fulfillment percentage, which requirements are done, which are in progress, and which have not been touched yet.
8. At any point, the client can generate a professional PDF Software Requirements Specification document from their requirements using the Groq AI API.

---

## User Roles

| Role | What They Can Do |
|---|---|
| **Client** | Post projects, upload requirements, review bids, accept/reject freelancers, view analytics, generate SRS PDF, unassign freelancers |
| **Freelancer** | Browse projects, submit bids, connect GitHub repos, push code, view their active projects and earnings |
| **Admin** | View and manage all projects and users across the platform, suspend accounts, oversee platform health |

---

## Complete Walkthroughs

### Client Workflow

#### Step 1 — Create an Account
The client registers with an email and password. After logging in they land on their dashboard showing active projects, pending milestone approvals, and quick stats.

#### Step 2 — Create a Project
The client clicks "Create New Project" and goes through a 4-step wizard:
- **Step 1 — Basic Info**: Project title, description, domain (e.g. E-commerce, Healthcare), and visibility (public or invite-only).
- **Step 2 — Tech & Budget**: Select the required tech stack from a list of options, set a minimum and maximum budget in rupees, and set an expected duration in days.
- **Step 3 — Requirements**: Either upload a requirements document (`.md`, `.pdf`, `.docx`) or add requirements manually one by one. For `.md` files, the platform parses them automatically and extracts each bullet point as a separate requirement.
- **Step 4 — Review**: Confirm all details and submit. The project goes live immediately.

#### Step 3 — Receive and Review Bids
Freelancers browse the project and submit bids. The client sees each bid with:
- The freelancer's name, trust score, and bid amount
- Duration estimate
- Amber warning badges if the bid exceeds the project budget ("Over Budget +₹500, +8%") or timeline ("Over Timeline +17 days")
- The freelancer's proposal text

#### Step 4 — Accept a Bid
The client clicks "Accept Bid". This creates a contract, assigns the freelancer to the project, and changes the project status to "In Progress". All other pending bids are automatically rejected.

#### Step 5 — Monitor Progress
The client watches the Analytics tab as the freelancer pushes code. The dashboard updates automatically showing which requirements are fulfilled.

#### Step 6 — Generate SRS Document
At any point, the client can click "Generate SRS Document". The platform sends all stored requirements to the Groq AI API, which structures them into a formal Software Requirements Specification with an introduction, functional requirements, non-functional requirements, constraints, and assumptions. This is rendered as a downloadable PDF.

#### Step 7 — Unassign if Needed
If the freelancer is not performing, the client can click "Unassign Freelancer". This resets the project to "Open" status, preserves all existing bids, and sends an automatic notification to the freelancer. An audit log entry is created for accountability.

---

### Freelancer Workflow

#### Step 1 — Browse Projects
The freelancer sees all open projects with search and filter options (by domain, budget range). Each project card shows the title, description, tech stack, budget range, duration, and number of existing bids.

#### Step 2 — Submit a Bid
The freelancer clicks "Submit Bid" on any project. A dialog opens where they enter:
- Their bid amount in rupees
- Estimated duration in days
- A proposal describing their approach

If the bid amount exceeds the project's budget or the duration exceeds the project's timeline, a yellow warning appears (but does not block submission). This lets freelancers propose higher-quality solutions that cost more.

#### Step 3 — Get Hired
If the client accepts the bid, the freelancer receives a notification and the project appears in their "Active Projects" dashboard.

#### Step 4 — Connect GitHub
The freelancer connects their GitHub repository to the project. This installs a webhook that sends commit data to FreelanceTrace every time code is pushed.

#### Step 5 — Push Code
As the freelancer works, they push commits with descriptive messages. The more closely the commit message matches the requirement text, the higher the similarity score and the more likely the requirement gets marked as fulfilled.

#### Step 6 — Track Progress
The freelancer's dashboard shows active projects with a requirements widget displaying total requirements, fulfilled count, and a progress bar.

---

### Admin Workflow

Admins log in through a separate admin portal. They can:
- View all projects across the platform with their status, client, freelancer, and bid count
- View all registered users with their role, trust score, and account status
- Suspend or verify user accounts
- Monitor platform-wide activity

Admin accounts are created using a special secret key to prevent unauthorised admin registration.

---

### GitHub Integration Workflow

#### Setting Up
1. The freelancer installs the FreelanceTrace GitHub App on their repository from the GitHub Marketplace.
2. They go to the project detail page and click "Connect Repository".
3. They enter their GitHub repository URL.
4. The platform registers a webhook on the repository.

#### How Commits Flow In
Every time the freelancer runs `git push`:
1. GitHub sends a webhook event to the FreelanceTrace backend.
2. The backend receives the list of commits in the push.
3. Each commit's message, author, timestamp, and changed files are stored.
4. The NLP traceability pipeline runs automatically on the new commits.
5. The analytics dashboard updates.

The commit list on the project detail page shows all commits with their short hash, message, author, time ago, and file change counts. A "Show more" button reveals older commits beyond the initial 10.

---

### NLP Traceability Workflow

This is the core intelligence of FreelanceTrace. Here is what happens step by step, in plain terms:

#### The Core Idea
Every piece of text — whether a requirement or a commit message — can be converted into a list of numbers (a vector) that captures its meaning. Two pieces of text that mean similar things will have vectors that point in similar directions. The similarity between two vectors is measured as a number between 0 and 1, where 1 means identical meaning and 0 means completely unrelated.

#### Step 1 — Encoding Requirements
When requirements are uploaded, each requirement text is fed into a language model (Sentence-BERT, specifically the `all-MiniLM-L6-v2` model). The model converts each requirement into a 384-number vector that captures its semantic meaning. These vectors are stored in the database alongside the requirement text.

#### Step 2 — Encoding Commits
When a commit arrives, its message (and optionally the names of the files it changed) is fed into the same model, producing another 384-number vector.

#### Step 3 — Comparing Them
The platform computes the cosine similarity between the commit vector and every requirement vector. This gives a score between 0 and 1 for each requirement-commit pair.

#### Step 4 — Creating Links
Pairs with a similarity score above 0.40 get a "TraceLink" record created, connecting that commit to that requirement. The confidence level is:
- **High** (score > 0.70) — the commit very likely addresses this requirement
- **Medium** (score > 0.55) — the commit probably addresses this requirement
- **Low** (score > 0.40) — the commit may be related to this requirement

#### Step 5 — Updating Requirement Status
- If a commit scores above **0.80** against a requirement → the requirement is marked **"Fulfilled"**
- If a commit scores above **0.55** against a requirement that was "Not Started" → it is marked **"In Progress"**

#### Step 6 — Re-tracing on Demand
If requirements are updated after commits have already been pushed, the client can click "Re-run Traceability" on the Analytics tab. This re-encodes all requirements and re-processes all existing commits from scratch, rebuilding the entire traceability matrix.

#### Why Commit Messages Matter
The similarity score depends heavily on how descriptive the commit message is. Compare:

| Commit Message | Similarity to "Allow users to mark a task as complete" |
|---|---|
| `fix bug` | ~0.15 (too vague) |
| `implement task completion` | ~0.65 (medium) |
| `Allow users to mark a task as complete` | ~0.92 (high — mirrors the requirement) |

Freelancers who write requirement-aligned commit messages get higher fulfillment scores automatically.

---

### SRS Document Generation Workflow

A Software Requirements Specification (SRS) is a formal document that describes what a software system should do. FreelanceTrace can generate one automatically from the stored requirements.

#### How It Works
1. The client clicks "Generate SRS Document" on the project detail page.
2. The backend collects all stored requirements for the project.
3. It sends them to the Groq AI API (using the `llama-3.3-70b-versatile` model) with a detailed prompt asking it to:
   - Write a formal introduction paragraph
   - Classify each requirement as functional or non-functional
   - Generate additional non-functional requirements (performance, security, usability, etc.)
   - Identify constraints and assumptions
4. The AI response is parsed and fed into a PDF renderer (ReportLab).
5. The PDF is generated with:
   - A title page with the project name and generation date
   - A table of contents
   - Numbered requirements in REQ-001 format with priority labels
   - A footer on every page with the project ID and timestamp
6. The PDF is saved to the server and a download link appears on the page.

The generation typically takes 15–45 seconds depending on the number of requirements. The system retries automatically if the AI service is temporarily busy.

---

## Features In Detail

### Simplified Requirements Document Format
Clients can upload a `.md` (Markdown) file with this structure:

```
## Introduction
Brief description of the project.

## Requirements
- The system shall allow users to register with an email and password.
- The system shall allow users to create tasks with a title and description.
- The system shall send reminder notifications before task due dates.

## Context
Any additional background information.
```

The parser reads only the `## Requirements` section and extracts each bullet point as a separate requirement. The Introduction and Context sections are ignored. Each requirement is automatically classified by type (Functional, Non-Functional, UI, Constraint) and priority (High, Medium, Low) using keyword analysis.

### Flexible Bidding
Freelancers can bid above the client's stated budget or beyond the stated timeline. The platform does not block these bids — it simply shows warning indicators so the client can make an informed decision. This allows freelancers to propose higher-quality solutions that require more time or resources.

### Project Unassignment
If a client needs to remove a freelancer from a project (due to performance issues, scope changes, or any other reason), they can do so with one click. The platform:
- Resets the project status back to "Open" so new bids can be accepted
- Preserves all existing bids (the freelancer's bid is not deleted)
- Sends an in-app notification to the unassigned freelancer
- Creates an audit log entry recording who performed the unassignment, when, and why

### Requirements Widget on Dashboard
Both the client and freelancer dashboards show a requirements summary card for each project. This card displays:
- Total number of requirements
- How many are fulfilled
- A progress bar showing the fulfillment percentage
- How many are high priority
- Clicking the card navigates directly to the requirements tab of that project

### Notification System
The platform has a built-in notification system. Currently, notifications are created when:
- A freelancer is unassigned from a project

Notifications appear in the bell icon in the top navigation bar. They can be marked as read individually. Unread notifications are counted and displayed as a badge.

---

## Analytics Dashboard Explained

The Analytics tab on every project shows five metrics, all computed automatically from the commit and requirement data.

### Fulfillment Confidence
**What it means**: The percentage of requirements that have been addressed by at least one commit with a similarity score above 0.80.

**Example**: If a project has 50 requirements and 35 of them have been matched to commits with high similarity, the fulfillment confidence is 70%.

**Why it matters**: This is the primary indicator of project progress from a requirements perspective. A client can see at a glance whether the freelancer is building what was specified.

### Requirement Drift
**What it means**: How much the recent commits are diverging from the original requirements. It is calculated from the average similarity score across all trace links — lower average similarity means higher drift.

**Example**: If early commits were closely aligned with requirements (high similarity) but recent commits are about unrelated features (low similarity), the drift score increases.

**Why it matters**: Drift indicates that the developer may be building features that were not in the specification, or that the codebase is evolving away from the original design.

### Delay Risk
**What it means**: An estimate of how likely the project is to miss its deadline, based on how much of the work is done versus how much time has elapsed.

**Example**: If 60% of the project timeline has passed but only 20% of requirements are fulfilled, the delay risk is high.

**Why it matters**: Gives the client early warning that the project may not be delivered on time, so they can have a conversation with the freelancer before it is too late.

### Developer Trust Score
**What it means**: A composite score (0–100) that combines fulfillment rate, compliance coverage, and drift level into a single number representing how reliably the developer is delivering against the specification.

**Formula**: 40% fulfillment + 40% compliance + 20% (inverse of drift)

**Why it matters**: Over multiple projects, this score builds into a reputation metric for the freelancer.

### Compliance Readiness
**What it means**: The percentage of requirements that have at least one trace link — meaning at least one commit has been semantically connected to them, even if the similarity was not high enough to mark them as fulfilled.

**Example**: If 45 out of 50 requirements have at least one related commit, compliance readiness is 90%.

**Why it matters**: This shows how much of the specification has been "touched" by the codebase, even if not fully implemented. It is useful for audit purposes.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + TypeScript | User interface |
| Styling | Tailwind CSS + shadcn/ui | Component library and design system |
| Build Tool | Vite | Fast frontend bundling |
| State Management | React Query (TanStack Query) | Server state, caching, background refetching |
| Backend | Python 3.10 + Flask | REST API server |
| ORM | SQLAlchemy | Database abstraction |
| Database | SQLite | Data storage (development) |
| NLP Model | Sentence-BERT (all-MiniLM-L6-v2) | Semantic text embeddings |
| Keyword Extraction | KeyBERT | Requirement keyword analysis |
| NLP Pipeline | spaCy (en_core_web_sm) | Text processing for legacy PDF parsing |
| LLM (SRS) | Groq API — llama-3.3-70b-versatile | SRS document structuring |
| LLM (Requirements) | Google Gemini AI | PDF/DOCX requirement extraction |
| PDF Generation | ReportLab | SRS PDF rendering |
| Authentication | JWT (PyJWT) | Stateless token-based auth |
| HTTP Client | httpx | Async Groq API calls |
| Testing | pytest + Hypothesis | Unit and property-based tests |
| GitHub Integration | GitHub App + Webhooks | Commit ingestion |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + TypeScript)                                 │
│                                                                  │
│  Client Portal    Freelancer Portal    Admin Portal              │
│  ─────────────    ─────────────────    ────────────              │
│  Dashboard        Browse Projects      All Projects              │
│  Create Project   My Projects          All Users                 │
│  Project Detail   Earnings             Platform Stats            │
│  Analytics        Dashboard                                      │
│                                                                  │
│  React Query handles all API calls with automatic caching        │
│  apiFetch() in lib/api.ts injects Bearer token on every request  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP REST API
┌──────────────────────────▼───────────────────────────────────────┐
│  Flask Backend (main.py — ~2500 lines)                           │
│                                                                  │
│  Auth Routes          Project Routes       Bid Routes            │
│  /auth/register       /projects            /projects/<id>/bids   │
│  /auth/login          /projects/<id>       /bids/<id>            │
│  /auth/me             /projects/<id>/...   /bids (list)          │
│                                                                  │
│  Notification Routes  GitHub Routes        Admin Routes          │
│  /notifications       /github/connect      /admin/users          │
│  /notifications/<id>  /github/webhook      /admin/projects       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  NLP Services Layer (loaded on startup)                 │     │
│  │                                                         │     │
│  │  md_parser.py          → parse .md requirements files   │     │
│  │  embedding_service.py  → SBERT encode + cosine sim      │     │
│  │  traceability_engine.py→ ingest commits, create links   │     │
│  │  srs_generator.py      → Groq API + ReportLab PDF       │     │
│  │  srs_parser.py         → spaCy parse for PDF/DOCX       │     │
│  │  keyword_extractor.py  → KeyBERT keyword extraction     │     │
│  │  llm_extractor.py      → Gemini AI extraction           │     │
│  │  webhook_handler.py    → GitHub event processing        │     │
│  │                                                         │     │
│  │  analytics/                                             │     │
│  │    fulfillment.py      → FCS calculation                │     │
│  │    drift_detector.py   → similarity drop detection      │     │
│  │    risk_predictor.py   → velocity-based delay risk      │     │
│  │    reputation.py       → developer trust score          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  SQLite Database                                                 │
│  Users, Projects, Requirements, Bids, Commits,                   │
│  TraceLinks, Notifications, UnassignmentLogs, Metrics            │
└──────────────────────────┬───────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────▼──────────┐   ┌──────────▼──────────┐
    │  Groq API          │   │  GitHub API          │
    │  llama-3.3-70b     │   │  Webhooks + OAuth    │
    │  SRS generation    │   │  Commit data         │
    └────────────────────┘   └─────────────────────┘
```

---

## Project Structure

```
freelancetrace/
├── README.md
├── docker-compose.yml
│
├── backend/
│   ├── main.py                          # All Flask routes and application entry point
│   ├── models.py                        # Database models (User, Project, Requirement, Bid,
│   │                                    #   Commit, TraceLink, Notification, UnassignmentLog,
│   │                                    #   Metrics, Contract, Milestone, GitHubRepository)
│   ├── schemas.py                       # Pydantic request/response validation schemas
│   ├── database.py                      # SQLAlchemy engine and session factory
│   ├── requirements.txt                 # Python dependencies
│   ├── .env                             # Environment variables (not committed)
│   │
│   ├── services/
│   │   ├── nlp/
│   │   │   ├── md_parser.py             # Markdown requirements document parser
│   │   │   ├── srs_generator.py         # Groq LLM call + ReportLab PDF rendering
│   │   │   ├── embedding_service.py     # Sentence-BERT encoding and cosine similarity
│   │   │   ├── keyword_extractor.py     # KeyBERT keyword extraction
│   │   │   ├── llm_extractor.py         # Gemini AI for PDF/DOCX requirement extraction
│   │   │   └── srs_parser.py            # spaCy-based legacy SRS parser
│   │   │
│   │   ├── vcs/
│   │   │   ├── traceability_engine.py   # Core NLP pipeline: embed → match → link
│   │   │   └── webhook_handler.py       # GitHub webhook event processing
│   │   │
│   │   └── analytics/
│   │       ├── fulfillment.py           # Fulfillment Confidence Score
│   │       ├── drift_detector.py        # Requirement drift detection
│   │       ├── risk_predictor.py        # Delay risk estimation
│   │       └── reputation.py            # Developer trust score
│   │
│   ├── tests/
│   │   ├── conftest.py                  # Hypothesis profile configuration
│   │   └── test_properties.py           # 16 property-based tests
│   │
│   └── uploads/                         # Generated PDFs and uploaded files
│
└── frontend/
    ├── src/
    │   ├── App.tsx                       # Root component and routing
    │   │
    │   ├── pages/
    │   │   ├── client/
    │   │   │   ├── Dashboard.tsx         # Client home dashboard
    │   │   │   ├── CreateProject.tsx     # 4-step project creation wizard
    │   │   │   ├── Projects.tsx          # All client projects list
    │   │   │   ├── ProjectDetail.tsx     # Project detail with tabs
    │   │   │   └── Payments.tsx          # Payment history
    │   │   │
    │   │   ├── freelancer/
    │   │   │   ├── Dashboard.tsx         # Freelancer home dashboard
    │   │   │   ├── Browse.tsx            # Browse and bid on projects
    │   │   │   ├── MyProjects.tsx        # Active and past projects
    │   │   │   └── Earnings.tsx          # Earnings and payouts
    │   │   │
    │   │   └── admin/
    │   │       ├── Projects.tsx          # Platform-wide project management
    │   │       └── Users.tsx             # User management
    │   │
    │   ├── components/
    │   │   ├── dashboard/
    │   │   │   ├── ProjectMetricsDashboard.tsx  # Analytics dashboard (5 metrics)
    │   │   │   └── RequirementsWidget.tsx        # Requirements progress card
    │   │   │
    │   │   ├── github/
    │   │   │   ├── CommitList.tsx         # Paginated commit history
    │   │   │   └── GitHubConnect.tsx      # Repository connection UI
    │   │   │
    │   │   ├── project/
    │   │   │   └── UnassignButton.tsx     # Freelancer unassignment with confirmation
    │   │   │
    │   │   ├── notifications/
    │   │   │   └── NotificationPanel.tsx  # In-app notification panel
    │   │   │
    │   │   ├── layout/
    │   │   │   └── AppLayout.tsx          # Sidebar navigation and layout wrapper
    │   │   │
    │   │   └── ui/                        # shadcn/ui component library (50+ components)
    │   │
    │   ├── hooks/                         # React Query hooks for every API endpoint
    │   │   ├── useProjects.ts
    │   │   ├── useBids.ts
    │   │   ├── useRequirements.ts
    │   │   ├── useGitHub.ts
    │   │   ├── useMilestones.ts
    │   │   └── ...
    │   │
    │   ├── contexts/
    │   │   └── AuthContext.tsx            # Global auth state (user, token, login/logout)
    │   │
    │   └── lib/
    │       └── api.ts                     # Centralised fetch with automatic auth token
    │
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.ts
```

---

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Node.js 18+ or Bun
- A Groq API key — free at [console.groq.com](https://console.groq.com)
- A GitHub account (for the GitHub App integration)

### Backend Setup

```bash
cd freelancetrace/backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux

# Install all dependencies
pip install -r requirements.txt

# Download the spaCy English model
python -m spacy download en_core_web_sm

# Copy and fill in environment variables
# (see Environment Variables section below)

# Start the backend server
python main.py
```

The backend starts on **http://localhost:8000** with Flask's debug reloader enabled.

### Frontend Setup

```bash
cd freelancetrace/frontend

# Install dependencies
npm install
# or if using Bun:
bun install

# Start the development server
npm run dev
```
