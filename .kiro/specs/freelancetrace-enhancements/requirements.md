# Requirements Document

## Introduction

This document specifies the requirements for four enhancements to the FreelanceTrace platform. These enhancements improve the requirements management workflow, add PDF generation capabilities, enable project unassignment, and provide flexibility in the bidding process.

FreelanceTrace is a full-stack freelance project management platform built with Python/FastAPI backend and React/TypeScript frontend. The platform manages projects, requirements, bids, contracts, and GitHub integration for requirement traceability.

## Glossary

- **System**: The FreelanceTrace platform (backend and frontend combined)
- **Requirements_Document**: A markdown document containing Introduction, Requirements sections, and Context sections
- **Requirements_Parser**: The backend service that extracts individual requirements from the Requirements_Document
- **SRS_Generator**: The backend service that generates PDF Software Requirements Specification documents
- **Groq_LLM_API**: The Groq API service used for generating formatted SRS documents
- **Client**: A user with the "client" role who posts projects
- **Freelancer**: A user with the "freelancer" role who bids on and works on projects
- **Admin**: A user with the "admin" role who manages the platform
- **Project**: A work assignment posted by a Client
- **Bid**: A proposal submitted by a Freelancer to work on a Project
- **Dashboard**: The main view for Clients and Freelancers showing project summaries and requirements
- **Unassign_Action**: The operation that removes a Freelancer from an assigned Project

## Requirements

### Requirement 1: Simplified Requirements Document Format

**User Story:** As a Client, I want to use a simplified requirements document format with only Introduction, Requirements, and Context sections, so that I can focus on essential project information without unnecessary complexity.

#### Acceptance Criteria

1. THE Requirements_Document SHALL contain exactly three sections: Introduction, Requirements, and Context
2. WHEN a Requirements_Document is uploaded, THE Requirements_Parser SHALL extract individual requirement items from the Requirements section
3. THE Requirements_Parser SHALL ignore the Introduction and Context sections during requirement extraction
4. WHEN parsing is complete, THE System SHALL store each extracted requirement as a separate database record
5. THE System SHALL preserve the original Requirements_Document format without modification

### Requirement 2: Requirements Display on Dashboards

**User Story:** As a Client or Freelancer, I want to see extracted requirements displayed on my dashboard, so that I can quickly review project requirements without navigating to project detail pages.

#### Acceptance Criteria

1. WHEN a Client views their dashboard, THE System SHALL display a summary of requirements for each active project
2. WHEN a Freelancer views their dashboard, THE System SHALL display a summary of requirements for each assigned project
3. THE System SHALL display the requirement count for each project on the dashboard
4. WHEN a user clicks on a requirement summary, THE System SHALL navigate to the project detail page with the requirements tab selected
5. THE System SHALL display requirement status indicators (not_started, in_progress, fulfilled) on the dashboard
6. THE System SHALL update dashboard requirement displays within 2 seconds when requirements are modified

### Requirement 3: SRS PDF Generation with Groq LLM

**User Story:** As a Client, I want to generate a professional PDF SRS document from my requirements document using AI, so that I can share formatted specifications with stakeholders.

#### Acceptance Criteria

1. WHEN a Client uploads a Requirements_Document, THE System SHALL provide an option to generate an SRS PDF
2. WHEN the generate SRS option is selected, THE SRS_Generator SHALL send the Requirements_Document content to the Groq_LLM_API
3. THE SRS_Generator SHALL format the Groq_LLM_API response into a professional PDF document
4. THE System SHALL include standard SRS sections: Introduction, Functional Requirements, Non-Functional Requirements, and Constraints
5. WHEN PDF generation is complete, THE System SHALL store the PDF file and provide a download link
6. THE System SHALL display generation progress to the user during PDF creation
7. IF the Groq_LLM_API request fails, THEN THE System SHALL display an error message and allow retry
8. THE SRS_Generator SHALL complete PDF generation within 30 seconds for documents under 50 requirements

### Requirement 4: Project Unassignment Capability

**User Story:** As a Client or Admin, I want to unassign a freelancer from a project, so that I can reassign the project to a different freelancer when needed.

#### Acceptance Criteria

1. WHEN a Project has an assigned Freelancer, THE System SHALL display an "Unassign Freelancer" button to the Client
2. WHEN a Project has an assigned Freelancer, THE System SHALL display an "Unassign Freelancer" button to Admins
3. WHEN the Unassign_Action is triggered, THE System SHALL remove the awarded_freelancer_id from the Project
4. WHEN the Unassign_Action is triggered, THE System SHALL change the Project status from "in_progress" to "open"
5. WHEN the Unassign_Action is triggered, THE System SHALL set the awarded_at timestamp to null
6. WHEN the Unassign_Action is triggered, THE System SHALL preserve all existing bids on the Project
7. WHEN the Unassign_Action is triggered, THE System SHALL send a notification to the unassigned Freelancer
8. THE System SHALL require confirmation before executing the Unassign_Action
9. WHEN the Unassign_Action is complete, THE System SHALL redirect the user to the project detail page
10. THE System SHALL log all Unassign_Action operations for audit purposes

### Requirement 5: Flexible Bidding Beyond Budget

**User Story:** As a Freelancer, I want to submit bids that exceed the client's stated budget and timeline, so that I can propose higher-quality solutions that require additional resources.

#### Acceptance Criteria

1. WHEN a Freelancer submits a bid, THE System SHALL allow bid amounts greater than the Project budget_max
2. WHEN a Freelancer submits a bid, THE System SHALL allow estimated_duration_days greater than the Project duration_days
3. WHEN a bid exceeds the budget_max, THE System SHALL display a warning indicator to the Freelancer
4. WHEN a bid exceeds the duration_days, THE System SHALL display a warning indicator to the Freelancer
5. THE System SHALL display all bids to the Client regardless of whether they exceed budget or timeline
6. WHEN displaying bids that exceed budget, THE System SHALL highlight them with a visual indicator
7. WHEN displaying bids that exceed timeline, THE System SHALL highlight them with a visual indicator
8. THE System SHALL allow Clients to accept bids that exceed the original budget and timeline
9. THE System SHALL calculate the percentage difference between bid amount and budget_max for display
10. THE System SHALL calculate the percentage difference between bid duration and duration_days for display

### Requirement 6: Requirements Document Parser

**User Story:** As a developer, I want a robust parser that extracts requirements from the simplified document format, so that requirements are accurately captured in the database.

#### Acceptance Criteria

1. THE Requirements_Parser SHALL identify the Requirements section by the markdown heading "## Requirements"
2. THE Requirements_Parser SHALL extract each requirement item from the Requirements section
3. THE Requirements_Parser SHALL preserve requirement text exactly as written in the source document
4. THE Requirements_Parser SHALL assign sequential order_index values to extracted requirements
5. THE Requirements_Parser SHALL detect requirement type (FR, NFR, UI, CONSTRAINT) based on content analysis
6. THE Requirements_Parser SHALL detect requirement priority (HIGH, MEDIUM, LOW) based on content analysis
7. WHEN parsing encounters malformed markdown, THE Requirements_Parser SHALL log a warning and continue processing
8. THE Requirements_Parser SHALL handle documents with up to 200 requirements without performance degradation
9. THE Requirements_Parser SHALL complete parsing within 5 seconds for documents under 50 requirements

### Requirement 7: SRS PDF Formatting

**User Story:** As a Client, I want the generated SRS PDF to follow professional formatting standards, so that it is suitable for formal documentation.

#### Acceptance Criteria

1. THE SRS_Generator SHALL format the PDF with a title page including project name and generation date
2. THE SRS_Generator SHALL include a table of contents with section links
3. THE SRS_Generator SHALL format requirements with numbered identifiers (REQ-001, REQ-002, etc.)
4. THE SRS_Generator SHALL apply consistent typography with headers, body text, and code formatting
5. THE SRS_Generator SHALL include page numbers on all pages except the title page
6. THE SRS_Generator SHALL format the PDF in A4 page size with standard margins
7. THE SRS_Generator SHALL embed the FreelanceTrace logo on the title page
8. THE SRS_Generator SHALL include a footer with project ID and generation timestamp

### Requirement 8: Dashboard Requirements Widget

**User Story:** As a user, I want a dedicated requirements widget on my dashboard, so that I can see requirement status at a glance.

#### Acceptance Criteria

1. THE System SHALL display a requirements summary card for each project on the dashboard
2. THE requirements summary card SHALL show the total count of requirements
3. THE requirements summary card SHALL show the count of fulfilled requirements
4. THE requirements summary card SHALL display a progress bar indicating fulfillment percentage
5. THE requirements summary card SHALL show the count of high-priority requirements
6. WHEN a project has no requirements, THE System SHALL display "No requirements defined" in the widget
7. THE requirements summary card SHALL be clickable and navigate to the project requirements tab
8. THE System SHALL update the requirements widget in real-time when requirements change

### Requirement 9: Groq API Integration

**User Story:** As a developer, I want secure integration with the Groq LLM API, so that SRS generation is reliable and maintainable.

#### Acceptance Criteria

1. THE System SHALL store the Groq API key in environment variables
2. THE System SHALL validate the Groq API key on application startup
3. WHEN the Groq API key is invalid, THE System SHALL log an error and disable SRS generation features
4. THE System SHALL implement retry logic with exponential backoff for Groq API requests
5. THE System SHALL timeout Groq API requests after 25 seconds
6. THE System SHALL log all Groq API requests and responses for debugging
7. THE System SHALL handle Groq API rate limiting gracefully with appropriate user feedback
8. THE System SHALL sanitize Requirements_Document content before sending to Groq API

### Requirement 10: Unassignment Notifications

**User Story:** As a Freelancer, I want to receive a notification when I am unassigned from a project, so that I am aware of the change immediately.

#### Acceptance Criteria

1. WHEN the Unassign_Action is executed, THE System SHALL create a notification record for the unassigned Freelancer
2. THE notification SHALL include the project title and unassignment timestamp
3. THE notification SHALL include the reason for unassignment if provided by the Client
4. THE System SHALL display the notification in the Freelancer's notification panel
5. THE System SHALL send an email notification to the Freelancer's registered email address
6. THE email notification SHALL include a link to the project detail page
7. THE System SHALL mark the notification as unread by default
8. THE System SHALL retain unassignment notifications for 90 days

## Context

### Technical Architecture

- **Backend**: Python 3.x with FastAPI framework, SQLAlchemy ORM, SQLite database
- **Frontend**: React 18 with TypeScript, Tailwind CSS, shadcn/ui components
- **Key Backend Files**: 
  - `backend/main.py` - Main API routes
  - `backend/models.py` - Database models
  - `backend/schemas.py` - Pydantic schemas
  - `backend/services/nlp/srs_parser.py` - Current SRS parsing logic
- **Key Frontend Files**:
  - `frontend/src/pages/client/Dashboard.tsx` - Client dashboard
  - `frontend/src/pages/freelancer/Dashboard.tsx` - Freelancer dashboard
  - `frontend/src/pages/client/CreateProject.tsx` - Project creation flow
  - `frontend/src/pages/freelancer/Browse.tsx` - Project browsing and bidding

### Current System Behavior

1. **Requirements Parsing**: Currently uses spaCy-based parsing with complex heuristics for PDF/DOCX documents. The new format will simplify this to markdown parsing.

2. **Bidding**: Currently validates that bids are within budget range. This will be relaxed to allow higher bids with warnings.

3. **Project Assignment**: Currently no unassignment capability exists. Once a freelancer is assigned, the project remains assigned until completion.

4. **Dashboard Display**: Currently shows project cards with basic info (title, status, budget, duration) but does not display requirements summaries.

### External Dependencies

- **Groq API**: Cloud-based LLM service requiring API key authentication
- **PDF Generation Library**: Will use ReportLab or WeasyPrint for Python PDF generation
- **Markdown Parser**: Will use Python `markdown` library for parsing simplified requirements documents

### Constraints

1. The simplified requirements document format must remain backward compatible with existing projects that have already uploaded SRS documents
2. PDF generation must not block the main application thread
3. Unassignment must preserve all project history and audit trails
4. Bid validation changes must not affect existing accepted bids
5. Dashboard performance must not degrade with the addition of requirements widgets (target: <2s page load)

### Assumptions

1. Clients will provide requirements documents in valid markdown format
2. The Groq API will remain available and maintain current pricing
3. Freelancers understand that bidding above budget may reduce acceptance likelihood
4. Clients have legitimate reasons for unassigning freelancers (performance issues, scope changes, etc.)
5. Users have modern browsers that support the current frontend stack
