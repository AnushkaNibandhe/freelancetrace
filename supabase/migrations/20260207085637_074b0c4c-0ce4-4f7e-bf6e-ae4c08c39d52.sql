-- Create enum types
CREATE TYPE user_role AS ENUM ('client', 'freelancer', 'admin');
CREATE TYPE project_status AS ENUM ('draft', 'open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'submitted', 'approved', 'disputed');
CREATE TYPE requirement_status AS ENUM ('not_started', 'in_progress', 'fulfilled');
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'freelancer',
  avatar_url TEXT,
  bio TEXT,
  organization_name TEXT,
  skills TEXT[],
  tech_stack TEXT[],
  github_username TEXT,
  portfolio_url TEXT,
  hourly_rate DECIMAL(10,2),
  total_earnings DECIMAL(12,2) DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  trust_score DECIMAL(3,2) DEFAULT 0.00 CHECK (trust_score >= 0 AND trust_score <= 5),
  projects_completed INTEGER DEFAULT 0,
  dispute_rate DECIMAL(5,4) DEFAULT 0,
  avg_approval_time INTERVAL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  tech_stack TEXT[],
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  duration_days INTEGER,
  status project_status DEFAULT 'draft',
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
  srs_file_url TEXT,
  srs_parsed_at TIMESTAMPTZ,
  awarded_freelancer_id UUID REFERENCES public.profiles(id),
  awarded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requirements extracted from SRS
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requirement_text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status requirement_status DEFAULT 'not_started',
  coverage_percentage DECIMAL(5,2) DEFAULT 0,
  last_commit_at TIMESTAMPTZ,
  embedding_vector JSONB,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bids from freelancers
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  estimated_duration_days INTEGER,
  proposal TEXT,
  milestone_breakdown JSONB,
  status bid_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, freelancer_id)
);

-- Contracts (accepted bids)
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id),
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id),
  total_amount DECIMAL(10,2) NOT NULL,
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  terms TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestones
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  status milestone_status DEFAULT 'pending',
  fulfillment_threshold DECIMAL(5,2) DEFAULT 80,
  current_fulfillment DECIMAL(5,2) DEFAULT 0,
  drift_score DECIMAL(5,2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GitHub repositories linked to projects
CREATE TABLE public.github_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  installation_id TEXT,
  is_connected BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Commits tracked from GitHub
CREATE TABLE public.commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  commit_hash TEXT NOT NULL,
  message TEXT,
  author TEXT,
  files_changed TEXT[],
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, commit_hash)
);

-- Requirement-Commit links (traceability)
CREATE TABLE public.requirement_commit_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  commit_id UUID NOT NULL REFERENCES public.commits(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requirement_id, commit_id)
);

-- Metric snapshots over time
CREATE TABLE public.metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  fulfillment_score DECIMAL(5,2) DEFAULT 0,
  drift_score DECIMAL(5,2) DEFAULT 0,
  delay_risk_score DECIMAL(5,2) DEFAULT 0,
  trust_score DECIMAL(5,2) DEFAULT 0,
  compliance_score DECIMAL(5,2) DEFAULT 0,
  requirements_fulfilled INTEGER DEFAULT 0,
  total_requirements INTEGER DEFAULT 0,
  total_commits INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback from clients
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_addressed BOOLEAN DEFAULT FALSE,
  github_issue_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  opened_by UUID NOT NULL REFERENCES public.profiles(id),
  against UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  evidence JSONB,
  status dispute_status DEFAULT 'open',
  resolution TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.profiles(id),
  payee_id UUID NOT NULL REFERENCES public.profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  payment_provider TEXT DEFAULT 'razorpay',
  provider_payment_id TEXT,
  provider_payout_id TEXT,
  status payment_status DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_commit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Public projects are viewable by everyone" ON public.projects FOR SELECT USING (visibility = 'public' OR client_id = auth.uid() OR awarded_freelancer_id = auth.uid());
CREATE POLICY "Clients can create projects" ON public.projects FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Clients can update own projects" ON public.projects FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY "Clients can delete own projects" ON public.projects FOR DELETE USING (client_id = auth.uid());

-- Requirements policies
CREATE POLICY "Requirements viewable by project participants" ON public.requirements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.visibility = 'public' OR p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);
CREATE POLICY "Clients can manage requirements" ON public.requirements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = auth.uid())
);

-- Bids policies
CREATE POLICY "Bids viewable by project client or bid owner" ON public.bids FOR SELECT USING (
  freelancer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = auth.uid())
);
CREATE POLICY "Freelancers can create bids" ON public.bids FOR INSERT WITH CHECK (freelancer_id = auth.uid());
CREATE POLICY "Freelancers can update own bids" ON public.bids FOR UPDATE USING (freelancer_id = auth.uid());
CREATE POLICY "Freelancers can delete own bids" ON public.bids FOR DELETE USING (freelancer_id = auth.uid() AND status = 'pending');

-- Contracts policies
CREATE POLICY "Contracts viewable by participants" ON public.contracts FOR SELECT USING (client_id = auth.uid() OR freelancer_id = auth.uid());
CREATE POLICY "Clients can create contracts" ON public.contracts FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Participants can update contracts" ON public.contracts FOR UPDATE USING (client_id = auth.uid() OR freelancer_id = auth.uid());

-- Milestones policies
CREATE POLICY "Milestones viewable by contract participants" ON public.milestones FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid()))
);
CREATE POLICY "Clients can manage milestones" ON public.milestones FOR ALL USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.client_id = auth.uid())
);

-- GitHub repositories policies
CREATE POLICY "Repos viewable by project participants" ON public.github_repositories FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);
CREATE POLICY "Freelancers can link repos" ON public.github_repositories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.awarded_freelancer_id = auth.uid())
);

-- Commits policies
CREATE POLICY "Commits viewable by project participants" ON public.commits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);

-- Requirement-Commit links policies
CREATE POLICY "Links viewable by project participants" ON public.requirement_commit_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.requirements r JOIN public.projects p ON r.project_id = p.id WHERE r.id = requirement_id AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);

-- Metric snapshots policies
CREATE POLICY "Metrics viewable by project participants" ON public.metric_snapshots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);

-- Feedback policies
CREATE POLICY "Feedback viewable by project participants" ON public.feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid()))
);
CREATE POLICY "Users can create feedback" ON public.feedback FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own feedback" ON public.feedback FOR UPDATE USING (author_id = auth.uid());

-- Disputes policies
CREATE POLICY "Disputes viewable by participants and admins" ON public.disputes FOR SELECT USING (
  opened_by = auth.uid() OR against = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can create disputes" ON public.disputes FOR INSERT WITH CHECK (opened_by = auth.uid());

-- Payments policies
CREATE POLICY "Payments viewable by participants" ON public.payments FOR SELECT USING (payer_id = auth.uid() OR payee_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON public.requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON public.bids FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'freelancer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();