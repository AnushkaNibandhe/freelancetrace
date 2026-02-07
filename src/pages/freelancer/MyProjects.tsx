import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFreelancerProjects } from '@/hooks/useProjects';
import { useProjectMilestones, useSubmitMilestone } from '@/hooks/useMilestones';
import { useProjectContract } from '@/hooks/useContracts';
import { GitHubConnect } from '@/components/github/GitHubConnect';
import { CommitList } from '@/components/github/CommitList';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

const FreelancerMyProjects: React.FC = () => {
  const { data: projects, isLoading } = useFreelancerProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  
  const selectedProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];
  const { data: contract } = useProjectContract(selectedProject?.id || '');
  const { data: milestones } = useProjectMilestones(selectedProject?.id || '');
  const submitMilestone = useSubmitMilestone();

  const getProjectMetrics = (project: any) => {
    const requirements = project?.requirements || [];
    const fulfilled = requirements.filter((r: any) => r.status === 'fulfilled').length;
    const total = requirements.length;
    const fulfillment = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
    
    const avgCoverage = requirements.length > 0
      ? Math.round(requirements.reduce((sum: number, r: any) => sum + (r.coverage_percentage || 0), 0) / requirements.length)
      : 0;
    
    return { fulfillment, fulfilled, total, avgCoverage };
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">My Projects</h1>
            <p className="text-muted-foreground mt-1">Track progress and manage your active projects</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No active projects yet</p>
              <Button asChild>
                <a href="/freelancer/browse">Browse Projects</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const metrics = getProjectMetrics(selectedProject);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground mt-1">Track progress and manage your active projects</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Project List */}
          <div className="space-y-4">
            {projects.map((project) => {
              const projectMetrics = getProjectMetrics(project);
              return (
                <Card
                  key={project.id}
                  className={`cursor-pointer transition-all ${
                    selectedProject?.id === project.id ? 'ring-2 ring-primary' : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{project.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {project.client?.organization_name || project.client?.full_name}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge status={project.status || 'in_progress'} />
                        </div>
                      </div>
                      <ProgressRing progress={projectMetrics.fulfillment} size={50} strokeWidth={4} showLabel={false} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Project Details */}
          {selectedProject && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedProject.title}</CardTitle>
                    <CardDescription>
                      {selectedProject.client?.organization_name || selectedProject.client?.full_name}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">${selectedProject.budget_max?.toLocaleString() || 0}</p>
                    <StatusBadge status={selectedProject.status || 'in_progress'} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="requirements">Requirements</TabsTrigger>
                    <TabsTrigger value="milestones">Milestones</TabsTrigger>
                    <TabsTrigger value="github">GitHub</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-6 space-y-6">
                    {/* Progress Overview */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <ProgressRing progress={metrics.fulfillment} size={80} strokeWidth={6} />
                        <p className="text-sm text-muted-foreground mt-2">Overall Progress</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{metrics.avgCoverage}%</div>
                        <p className="text-sm text-muted-foreground">Avg Coverage</p>
                        <p className={`text-xs mt-1 ${metrics.avgCoverage < 50 ? 'text-destructive' : 'text-success'}`}>
                          {metrics.avgCoverage < 50 ? 'Needs attention' : 'On track'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{metrics.fulfilled}/{metrics.total}</div>
                        <p className="text-sm text-muted-foreground">Requirements</p>
                        <p className="text-xs mt-1 text-muted-foreground">Fulfilled</p>
                      </div>
                    </div>

                    {/* GitHub Info */}
                    <GitHubConnect projectId={selectedProject.id} />
                  </TabsContent>

                  <TabsContent value="requirements" className="mt-6">
                    <div className="space-y-3">
                      {selectedProject.requirements?.map((req: any) => (
                        <div key={req.id} className="p-4 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{req.requirement_text}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={req.coverage_percentage || 0} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-12">{req.coverage_percentage || 0}%</span>
                          </div>
                        </div>
                      ))}
                      {(!selectedProject.requirements || selectedProject.requirements.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No requirements defined</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="milestones" className="mt-6">
                    <div className="space-y-4">
                      {milestones?.map((milestone, index) => (
                        <div key={milestone.id} className="flex items-center gap-4">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            milestone.status === 'approved' ? 'bg-success text-success-foreground' :
                            milestone.status === 'in_progress' ? 'bg-primary text-primary-foreground' :
                            milestone.status === 'submitted' ? 'bg-info text-info-foreground' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {milestone.status === 'approved' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span className="text-sm font-medium">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{milestone.title}</span>
                              <span className="font-bold">${milestone.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={milestone.current_fulfillment || 0} className="flex-1 h-2" />
                              <StatusBadge status={milestone.status || 'pending'} />
                            </div>
                            {milestone.status === 'in_progress' && (
                              <Button 
                                size="sm" 
                                className="mt-2"
                                onClick={() => submitMilestone.mutate(milestone.id)}
                                disabled={submitMilestone.isPending}
                              >
                                Submit for Review
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!milestones || milestones.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No milestones defined yet</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="github" className="mt-6 space-y-6">
                    <GitHubConnect projectId={selectedProject.id} />
                    <CommitList projectId={selectedProject.id} limit={10} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default FreelancerMyProjects;
