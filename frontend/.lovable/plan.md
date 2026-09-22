
# FreelanceTrace: Complete Data Flow, Razorpay, Notifications & GitHub Integration

## Current State Analysis

After reviewing the codebase, I identified that:
- **All pages use hardcoded demo data** instead of fetching from the database
- The database schema is properly set up with all required tables and RLS policies
- No edge functions exist yet for payment processing or GitHub webhooks
- No real-time notification system is implemented

## Implementation Plan

### Phase 1: Data Layer & React Query Hooks

Create a comprehensive data fetching layer using React Query to replace all hardcoded demo data.

**New Files:**
- `src/hooks/useProjects.ts` - Fetch/create/update projects for clients
- `src/hooks/useBids.ts` - Manage bids (create for freelancers, view for clients)
- `src/hooks/useRequirements.ts` - CRUD for project requirements
- `src/hooks/useContracts.ts` - Contract management
- `src/hooks/useMilestones.ts` - Milestone tracking
- `src/hooks/usePayments.ts` - Payment history and status
- `src/hooks/useDisputes.ts` - Dispute management for admin
- `src/hooks/useGitHub.ts` - GitHub repository linking
- `src/hooks/useNotifications.ts` - Real-time notifications

### Phase 2: Update Client Portal Pages

**1. CreateProject.tsx (Complete Rewrite)**
- Replace simulated API call with actual Supabase insert
- Save project to `projects` table
- Save requirements to `requirements` table
- Handle SRS file upload to Supabase Storage
- Navigate to project detail page after creation

**2. Projects.tsx (Client Project List)**
- Fetch real projects from database using `useProjects` hook
- Show actual bid counts from `bids` table
- Display real requirement fulfillment metrics
- Add project detail page route

**3. Dashboard.tsx (Client)**
- Fetch projects, pending milestones, and payment stats from database
- Show real-time updates for new bids

**4. Payments.tsx**
- Fetch actual payment records
- Integrate with Razorpay for payment initiation

### Phase 3: Update Freelancer Portal Pages

**1. Browse.tsx**
- Fetch open/public projects from database
- Show actual client profiles and ratings
- Submit real bids to `bids` table
- Update bid counts in real-time

**2. MyProjects.tsx**
- Fetch projects where freelancer is awarded
- Display real requirements and their status
- Show actual milestone progress
- Display GitHub repository info

**3. Earnings.tsx**
- Fetch payments where user is payee
- Show real payment history and pending payouts

### Phase 4: Update Admin Portal

**1. Dashboard.tsx**
- Aggregate real stats from database
- Show actual revenue and project counts

**2. Users.tsx**
- Fetch real user profiles
- Enable suspension/verification actions

**3. Disputes.tsx**
- Fetch disputes with related project/milestone data
- Enable resolution updates

### Phase 5: Real-Time Notifications System

**Database Changes:**
- Create `notifications` table for storing user notifications

**Implementation:**
- Use Supabase Realtime to subscribe to notifications
- Create `NotificationContext` for app-wide notification state
- Update `AppLayout` header to show real-time notification count
- Create `NotificationPanel` component for viewing notifications

**Notification Types:**
- New bid received (for clients)
- Bid accepted/rejected (for freelancers)
- Milestone submitted/approved (both)
- Payment received (freelancers)
- Dispute opened/resolved (both)
- New project matching skills (freelancers)

### Phase 6: Razorpay Integration

**Edge Function: `razorpay-create-order`**
- Create Razorpay order for milestone payment
- Store order details in payments table

**Edge Function: `razorpay-webhook`**
- Handle payment confirmation webhooks
- Update payment status in database
- Trigger notifications and payout processing

**Frontend Integration:**
- Add Razorpay checkout script
- Create payment flow in milestone approval
- Handle payment success/failure callbacks

**Required Secret:**
- `RAZORPAY_KEY_ID` - Razorpay API Key
- `RAZORPAY_KEY_SECRET` - Razorpay Secret Key

### Phase 7: GitHub Integration

**Edge Function: `github-connect`**
- OAuth flow for GitHub App authorization
- Save installation ID and repository info

**Edge Function: `github-webhook`**
- Receive push/PR events from GitHub
- Store commits in `commits` table
- Placeholder for NLP analysis trigger

**Frontend Components:**
- GitHub connect button in freelancer project view
- Repository status display
- Commit history viewer

### Phase 8: Project Detail Pages

**New Pages:**
- `src/pages/client/ProjectDetail.tsx` - Full project view with bids, requirements, milestones
- `src/pages/freelancer/ProjectDetail.tsx` - Work view with requirements, commits, feedback

**Routes to Add:**
- `/client/projects/:id`
- `/freelancer/projects/:id`

---

## Technical Details

### Database Migration: Notifications Table

```text
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT WITH CHECK (true);
```

### Storage Bucket for SRS Files

- Create `srs-documents` bucket for project SRS uploads
- Set appropriate RLS policies for client access

### File Structure Summary

```text
src/
├── hooks/
│   ├── useProjects.ts
│   ├── useBids.ts
│   ├── useRequirements.ts
│   ├── useContracts.ts
│   ├── useMilestones.ts
│   ├── usePayments.ts
│   ├── useDisputes.ts
│   ├── useGitHub.ts
│   └── useNotifications.ts
├── contexts/
│   ├── AuthContext.tsx (existing)
│   └── NotificationContext.tsx (new)
├── components/
│   ├── notifications/
│   │   ├── NotificationPanel.tsx
│   │   └── NotificationItem.tsx
│   └── github/
│       ├── GitHubConnect.tsx
│       └── CommitList.tsx
├── pages/
│   ├── client/
│   │   ├── Dashboard.tsx (update)
│   │   ├── Projects.tsx (update)
│   │   ├── ProjectDetail.tsx (new)
│   │   ├── CreateProject.tsx (update)
│   │   └── Payments.tsx (update)
│   ├── freelancer/
│   │   ├── Dashboard.tsx (update)
│   │   ├── Browse.tsx (update)
│   │   ├── MyProjects.tsx (update)
│   │   ├── ProjectDetail.tsx (new)
│   │   └── Earnings.tsx (update)
│   └── admin/
│       ├── Dashboard.tsx (update)
│       ├── Users.tsx (update)
│       └── Disputes.tsx (update)
supabase/
└── functions/
    ├── razorpay-create-order/
    │   └── index.ts
    ├── razorpay-webhook/
    │   └── index.ts
    ├── github-connect/
    │   └── index.ts
    └── github-webhook/
        └── index.ts
```

### Data Flow Diagram

```text
CLIENT CREATES PROJECT
    │
    ▼
┌─────────────────────────────────┐
│  CreateProject.tsx              │
│  └─► supabase.from('projects')  │
│      .insert(projectData)       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Database: projects table       │
│  └─► Triggers notification to   │
│      matching freelancers       │
└─────────────────────────────────┘
    │
    ├─────────────────────────────┐
    │                             │
    ▼                             ▼
┌──────────────────┐    ┌──────────────────┐
│ Client Projects  │    │ Freelancer Browse│
│ (Real-time list) │    │ (Shows new proj) │
└──────────────────┘    └──────────────────┘
```

This implementation ensures all data flows properly between portals, with real-time updates for notifications and a complete integration with Razorpay for payments and GitHub for repository tracking.
