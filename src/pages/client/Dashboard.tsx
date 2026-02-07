import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useClientProjects } from '@/hooks/useProjects';
import { usePendingMilestones, useApproveMilestone } from '@/hooks/useMilestones';
import { usePaymentStats } from '@/hooks/usePayments';
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

const ClientDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { data: projects, isLoading: loadingProjects } = useClientProjects();
  const { data: pendingMilestones, isLoading: loadingMilestones } = usePendingMilestones();
  const { data: paymentStats } = usePaymentStats('client');
  const approveMilestone = useApproveMilestone();

  const activeProjects = projects?.filter(p => p.status === 'in_progress') || [];
  const recentProjects = projects?.slice(0, 3) || [];

  if (loadingProjects) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="flex justify-between">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

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
            value={activeProjects.length}
            icon={FolderKanban}
          />
          <StatCard
            title="Total Spent"
            value={`$${paymentStats?.totalAmount?.toLocaleString() || 0}`}
            icon={CreditCard}
            description="All time"
          />
          <StatCard
            title="Pending Approvals"
            value={pendingMilestones?.length || 0}
            icon={Clock}
          />
          <StatCard
            title="This Month"
            value={`$${paymentStats?.thisMonthAmount?.toLocaleString() || 0}`}
            icon={TrendingUp}
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
              {recentProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No projects yet. Create your first project!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentProjects.map((project) => {
                    const requirements = project.requirements || [];
                    const fulfilled = requirements.filter((r: any) => r.status === 'fulfilled').length;
                    const total = requirements.length;
                    const fulfillment = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
                    
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <ProgressRing progress={fulfillment} size={48} strokeWidth={4} showLabel={false} />
                          <div>
                            <h4 className="font-medium">{project.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusBadge status={project.status || 'draft'} />
                              {project.freelancer && (
                                <span className="text-sm text-muted-foreground">
                                  • {project.freelancer.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${project.budget_max?.toLocaleString() || 0}</p>
                          {project.duration_days && (
                            <p className="text-sm text-muted-foreground">{project.duration_days} days</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
              {loadingMilestones ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingMilestones?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingMilestones?.map((milestone) => (
                    <div key={milestone.id} className="p-4 rounded-lg border border-border space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {(milestone as any).contract?.project?.title}
                        </p>
                        <h4 className="font-medium">{milestone.title}</h4>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">${milestone.amount.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">
                          {milestone.current_fulfillment || 0}% complete
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => approveMilestone.mutate(milestone.id)}
                          disabled={approveMilestone.isPending}
                        >
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
              )}
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
