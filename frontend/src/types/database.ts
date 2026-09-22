export type UserRole = 'client' | 'freelancer' | 'admin';
export type ProjectStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'disputed';
export type RequirementStatus = 'not_started' | 'in_progress' | 'fulfilled';
export type DisputeStatus = 'open' | 'under_review' | 'resolved';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  organization_name: string | null;
  skills: string[] | null;
  tech_stack: string[] | null;
  github_username: string | null;
  portfolio_url: string | null;
  hourly_rate: number | null;
  total_earnings: number;
  total_spent: number;
  trust_score: number;
  projects_completed: number;
  dispute_rate: number;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  domain: string | null;
  tech_stack: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  duration_days: number | null;
  status: ProjectStatus;
  visibility: string;
  srs_file_url: string | null;
  srs_parsed_at: string | null;
  awarded_freelancer_id: string | null;
  awarded_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Profile;
  freelancer?: Profile;
  requirements?: Requirement[];
  bids?: Bid[];
}

export interface Requirement {
  id: string;
  project_id: string;
  requirement_text: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: RequirementStatus;
  coverage_percentage: number;
  last_commit_at: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  project_id: string;
  freelancer_id: string;
  amount: number;
  estimated_duration_days: number | null;
  proposal: string | null;
  milestone_breakdown: any;
  status: BidStatus;
  created_at: string;
  updated_at: string;
  freelancer?: Profile;
}

export interface Contract {
  id: string;
  project_id: string;
  bid_id: string;
  client_id: string;
  freelancer_id: string;
  total_amount: number;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  terms: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  project?: Project;
  client?: Profile;
  freelancer?: Profile;
}

export interface Milestone {
  id: string;
  contract_id: string;
  project_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: MilestoneStatus;
  fulfillment_threshold: number;
  current_fulfillment: number;
  drift_score: number;
  submitted_at: string | null;
  approved_at: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  id: string;
  project_id: string;
  repo_url: string;
  repo_name: string;
  owner: string;
  installation_id: string | null;
  is_connected: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface Commit {
  id: string;
  repository_id: string;
  project_id: string;
  commit_hash: string;
  message: string | null;
  author: string | null;
  files_changed: string[] | null;
  additions: number;
  deletions: number;
  committed_at: string | null;
  created_at: string;
}

export interface MetricSnapshot {
  id: string;
  project_id: string;
  milestone_id: string | null;
  fulfillment_score: number;
  drift_score: number;
  delay_risk_score: number;
  trust_score: number;
  compliance_score: number;
  requirements_fulfilled: number;
  total_requirements: number;
  total_commits: number;
  snapshot_at: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  project_id: string;
  requirement_id: string | null;
  author_id: string;
  content: string;
  is_addressed: boolean;
  github_issue_url: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Dispute {
  id: string;
  project_id: string;
  milestone_id: string | null;
  opened_by: string;
  against: string;
  reason: string;
  evidence: any;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  opener?: Profile;
  defendant?: Profile;
  project?: Project;
  milestone?: Milestone;
}

export interface Payment {
  id: string;
  milestone_id: string;
  contract_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  payment_provider: string;
  provider_payment_id: string | null;
  provider_payout_id: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  payout_at: string | null;
  created_at: string;
  updated_at: string;
}
