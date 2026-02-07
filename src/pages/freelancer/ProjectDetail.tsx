import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Calendar, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useProjectMilestones, useSubmitMilestone } from '@/hooks/useMilestones';
import { useProjectRequirements } from '@/hooks/useRequirements';
import { useProjectContract } from '@/hooks/useContracts';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CommitList } from '@/components/github/CommitList';
import { GitHubConnect } from '@/components/github/GitHubConnect';

const FreelancerProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: milestones } = useProjectMilestones(id!);
  const { data: requirements } = useProjectRequirements(id!);
  const { data: contract } = useProjectContract(id!);
  
  const submitMilestone = useSubmitMilestone();

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="link" onClick={() => navigate('/freelancer/my-projects')}>
            Back to My Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const completedMilestones = milestones?.filter(m => m.status === 'approved').length || 0;
  const totalMilestones = milestones?.length || 0;
  const progressPercent = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const fulfilledRequirements = requirements?.filter(r => r.status === 'fulfilled').length || 0;
  const totalRequirements = requirements?.length || 0;

  const handleSubmitMilestone = async (milestoneId: string) => {
    try {
      await submitMilestone.mutateAsync(milestoneId);
      toast({
        title: 'Milestone submitted',
        description: 'The milestone has been submitted for review.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit milestone',
        variant: 'destructive'
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/freelancer/my-projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status || 'draft'} />
            </div>
            <p className="text-muted-foreground mt-1">{project.description}</p>
          </div>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Project Progress</CardTitle>
            <CardDescription>Overall completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Milestones</span>
                  <span>{completedMilestones} / {totalMilestones} completed</span>
                </div>
                <Progress value={progressPercent} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Requirements</span>
                  <span>{fulfilledRequirements} / {totalRequirements} fulfilled</span>
                </div>
                <Progress value={totalRequirements > 0 ? (fulfilledRequirements / totalRequirements) * 100 : 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Contract Value</p>
                <p className="font-semibold">${contract?.total_amount?.toLocaleString() || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-semibold">
                  {contract?.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Expected End</p>
                <p className="font-semibold">
                  {contract?.expected_end_date ? format(new Date(contract.expected_end_date), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GitHub Connect */}
        <GitHubConnect projectId={id!} />

        <Tabs defaultValue="milestones">
          <TabsList>
            <TabsTrigger value="milestones">Milestones ({milestones?.length || 0})</TabsTrigger>
            <TabsTrigger value="requirements">Requirements ({requirements?.length || 0})</TabsTrigger>
            <TabsTrigger value="commits">Commits</TabsTrigger>
          </TabsList>

          <TabsContent value="milestones" className="mt-6 space-y-4">
            {!milestones || milestones.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No milestones defined yet</p>
                </CardContent>
              </Card>
            ) : (
              milestones.map((milestone, index) => (
                <Card key={milestone.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                          milestone.status === 'approved' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {milestone.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{milestone.title}</p>
                          <p className="text-sm text-muted-foreground">{milestone.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">${milestone.amount.toLocaleString()}</p>
                          {milestone.due_date && (
                            <p className="text-sm text-muted-foreground">
                              Due: {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={milestone.status || 'pending'} />
                      </div>
                    </div>
                    
                    {/* Fulfillment Progress */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Fulfillment</span>
                        <span>{milestone.current_fulfillment || 0}% / {milestone.fulfillment_threshold || 80}%</span>
                      </div>
                      <Progress value={milestone.current_fulfillment || 0} />
                    </div>

                    {/* Actions */}
                    {milestone.status === 'in_progress' && (
                      <div className="mt-4">
                        <Button 
                          onClick={() => handleSubmitMilestone(milestone.id)}
                          disabled={submitMilestone.isPending}
                        >
                          Submit for Review
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="requirements" className="mt-6 space-y-4">
            {!requirements || requirements.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No requirements defined</p>
                </CardContent>
              </Card>
            ) : (
              requirements.map((req, index) => (
                <Card key={req.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      req.status === 'fulfilled' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-muted'
                    }`}>
                      {req.status === 'fulfilled' ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <p>{req.requirement_text}</p>
                      {req.coverage_percentage !== null && req.coverage_percentage !== undefined && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Coverage</span>
                            <span>{req.coverage_percentage}%</span>
                          </div>
                          <Progress value={req.coverage_percentage} className="h-1" />
                        </div>
                      )}
                    </div>
                    <StatusBadge status={req.status || 'not_started'} />
                    <Badge variant="outline">{req.priority || 'medium'}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="commits" className="mt-6">
            <CommitList projectId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FreelancerProjectDetail;
