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
  FolderKanban,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

// Demo data
const demoProjects = [
  {
    id: '1',
    title: 'E-commerce Platform Redesign',
    status: 'in_progress' as const,
    fulfillment: 72,
    budget: 15000,
    freelancer: 'Alex Chen',
    dueDate: '2024-03-15',
    drift: 'low',
  },
  {
    id: '2',
    title: 'Mobile Banking App',
    status: 'open' as const,
    fulfillment: 0,
    budget: 25000,
    freelancer: null,
    dueDate: '2024-04-01',
    drift: 'none',
  },
  {
    id: '3',
    title: 'CRM Integration API',
    status: 'completed' as const,
    fulfillment: 100,
    budget: 8500,
    freelancer: 'Sarah Johnson',
    dueDate: '2024-02-28',
    drift: 'none',
  },
];

const pendingMilestones = [
  { id: '1', project: 'E-commerce Platform', title: 'Frontend Implementation', amount: 5000, fulfillment: 85 },
  { id: '2', project: 'Mobile Banking App', title: 'UI/UX Design', amount: 3000, fulfillment: 0 },
];

const ClientDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening with your projects</p>
          </div>
          <Button asChild>
            <Link to="/client/create-project">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Projects"
            value={3}
            icon={FolderKanban}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Spent"
            value="$48,500"
            icon={CreditCard}
            description="This year"
          />
          <StatCard
            title="Pending Approvals"
            value={2}
            icon={Clock}
          />
          <StatCard
            title="Avg. Trust Score"
            value="4.8"
            icon={TrendingUp}
            description="Your freelancers"
          />
        </div>

        {/* Projects and Milestones Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Projects */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your latest project activity</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/client/projects">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <ProgressRing progress={project.fulfillment} size={48} strokeWidth={4} showLabel={false} />
                      <div>
                        <h4 className="font-medium">{project.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={project.status} />
                          {project.freelancer && (
                            <span className="text-sm text-muted-foreground">
                              • {project.freelancer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${project.budget.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Due {project.dueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Pending Approvals
              </CardTitle>
              <CardDescription>Milestones awaiting your review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingMilestones.map((milestone) => (
                  <div key={milestone.id} className="p-4 rounded-lg border border-border space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{milestone.project}</p>
                      <h4 className="font-medium">{milestone.title}</h4>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">${milestone.amount.toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{milestone.fulfillment}% complete</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/client/create-project">
                  <Plus className="h-6 w-6" />
                  <span>Post New Project</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/client/projects">
                  <FolderKanban className="h-6 w-6" />
                  <span>View All Projects</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/client/payments">
                  <CreditCard className="h-6 w-6" />
                  <span>Payment History</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to="/settings">
                  <TrendingUp className="h-6 w-6" />
                  <span>View Analytics</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
