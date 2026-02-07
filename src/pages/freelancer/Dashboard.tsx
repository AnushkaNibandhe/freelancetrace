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
import { useFreelancerProjects } from '@/hooks/useProjects';
import { usePaymentStats } from '@/hooks/usePayments';
import { useProjectCommits } from '@/hooks/useGitHub';
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

const FreelancerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { data: projects, isLoading } = useFreelancerProjects();
  const { data: paymentStats } = usePaymentStats('freelancer');

  const activeProjects = projects?.filter(p => p.status === 'in_progress') || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="flex justify-between">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-36" />
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
            value={activeProjects.length}
            icon={Briefcase}
          />
          <StatCard
            title="Total Earnings"
            value={`$${paymentStats?.totalAmount?.toLocaleString() || 0}`}
            icon={CreditCard}
          />
          <StatCard
            title="Trust Score"
            value={profile?.trust_score || 0}
            icon={Star}
            description={`Based on ${profile?.projects_completed || 0} projects`}
          />
          <StatCard
            title="Pending Payouts"
            value={`$${paymentStats?.pendingAmount?.toLocaleString() || 0}`}
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
              {activeProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active projects. Browse and bid on projects!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeProjects.slice(0, 3).map((project) => {
                    const requirements = project.requirements || [];
                    const fulfilled = requirements.filter((r: any) => r.status === 'fulfilled').length;
                    const total = requirements.length;
                    const fulfillment = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
                    
                    return (
                      <div key={project.id} className="p-4 rounded-lg border border-border">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold">{project.title}</h4>
                              <StatusBadge status={project.status || 'in_progress'} />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              {project.client?.organization_name || project.client?.full_name}
                            </p>
                            
                            {/* Progress */}
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Progress</span>
                                <span className="text-sm text-muted-foreground">{fulfillment}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${fulfillment}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <ProgressRing progress={fulfillment} size={80} strokeWidth={6} label="Overall" />
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {project.duration_days && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {project.duration_days} days
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-4 w-4" />
                              ${project.budget_max?.toLocaleString() || 0}
                            </span>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/freelancer/projects/${project.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* GitHub Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Repository Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active projects</p>
                ) : (
                  <div className="space-y-3">
                    {activeProjects.slice(0, 2).map((project) => {
                      const repo = project.github_repositories?.[0];
                      return (
                        <div key={project.id} className="p-3 rounded-lg border border-border">
                          <p className="text-sm font-medium truncate">{project.title}</p>
                          {repo ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-success" />
                              {repo.owner}/{repo.repo_name}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-warning" />
                              No repository linked
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Projects Completed</span>
                  <span className="font-medium">{profile?.projects_completed || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dispute Rate</span>
                  <span className="font-medium">{profile?.dispute_rate || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Earnings</span>
                  <span className="font-medium">${profile?.total_earnings || 0}</span>
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
                  <span>Settings</span>
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
