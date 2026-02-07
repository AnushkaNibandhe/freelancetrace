import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CreditCard,
  TrendingUp,
  Star,
  ArrowRight,
  Clock,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// Demo data
const demoActiveProjects = [
  {
    id: '1',
    title: 'E-commerce Platform Redesign',
    client: 'TechCorp Inc.',
    status: 'in_progress' as const,
    fulfillment: 72,
    currentMilestone: 'Frontend Implementation',
    milestoneProgress: 85,
    dueDate: '2024-03-15',
    amount: 15000,
  },
  {
    id: '2',
    title: 'CRM Integration API',
    client: 'SalesForce Pro',
    status: 'in_progress' as const,
    fulfillment: 45,
    currentMilestone: 'API Development',
    milestoneProgress: 60,
    dueDate: '2024-03-20',
    amount: 8500,
  },
];

const pendingFeedback = [
  { id: '1', project: 'E-commerce Platform', requirement: 'API response time', type: 'Issue' },
  { id: '2', project: 'CRM Integration', requirement: 'Authentication flow', type: 'Feedback' },
];

const recentCommits = [
  { hash: 'a1b2c3d', message: 'Implement product listing API', time: '2 hours ago', coverage: 3 },
  { hash: 'e4f5g6h', message: 'Add user authentication middleware', time: '5 hours ago', coverage: 2 },
  { hash: 'i7j8k9l', message: 'Fix cart calculation bug', time: '1 day ago', coverage: 1 },
];

const FreelancerDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] || 'Developer'}!</h1>
            <p className="text-muted-foreground mt-1">Here's your freelancing overview</p>
          </div>
          <Button asChild>
            <Link to="/freelancer/browse">
              <Briefcase className="mr-2 h-4 w-4" />
              Browse Projects
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Projects"
            value={2}
            icon={Briefcase}
          />
          <StatCard
            title="Total Earnings"
            value="$32,500"
            icon={CreditCard}
            trend={{ value: 18, isPositive: true }}
          />
          <StatCard
            title="Trust Score"
            value="4.8"
            icon={Star}
            description="Based on 12 projects"
          />
          <StatCard
            title="Pending Payouts"
            value="$5,000"
            icon={TrendingUp}
          />
        </div>

        {/* Active Projects and Activity Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Projects */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Projects</CardTitle>
                <CardDescription>Your current project assignments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/freelancer/my-projects">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {demoActiveProjects.map((project) => (
                  <div key={project.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{project.title}</h4>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{project.client}</p>
                        
                        {/* Current Milestone */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{project.currentMilestone}</span>
                            <span className="text-sm text-muted-foreground">{project.milestoneProgress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${project.milestoneProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <ProgressRing progress={project.fulfillment} size={80} strokeWidth={6} label="Overall" />
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Due {project.dueDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          ${project.amount.toLocaleString()}
                        </span>
                      </div>
                      <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Pending Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Action Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingFeedback.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg border border-border">
                      <p className="text-sm font-medium">{item.requirement}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.project} • {item.type}
                      </p>
                      <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                        Address Now →
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Commits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Recent Commits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentCommits.map((commit) => (
                    <div key={commit.hash} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-mono text-primary">
                        {commit.hash.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{commit.message}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{commit.time}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {commit.coverage} requirements
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/freelancer/browse">
                  <Briefcase className="h-6 w-6" />
                  <span>Find Projects</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/freelancer/my-projects">
                  <TrendingUp className="h-6 w-6" />
                  <span>View Progress</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/freelancer/earnings">
                  <CreditCard className="h-6 w-6" />
                  <span>Earnings</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/settings">
                  <GitBranch className="h-6 w-6" />
                  <span>Link GitHub</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default FreelancerDashboard;
