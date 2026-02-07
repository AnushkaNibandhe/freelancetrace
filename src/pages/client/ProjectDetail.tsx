import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Calendar, DollarSign, Clock, User } from 'lucide-react';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useProjectBids, useAcceptBid, useRejectBid } from '@/hooks/useBids';
import { useProjectMilestones } from '@/hooks/useMilestones';
import { useProjectRequirements } from '@/hooks/useRequirements';
import { useProjectContract, useCreateContract } from '@/hooks/useContracts';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CommitList } from '@/components/github/CommitList';

const ClientProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: bids, isLoading: bidsLoading } = useProjectBids(id!);
  const { data: milestones } = useProjectMilestones(id!);
  const { data: requirements } = useProjectRequirements(id!);
  const { data: contract } = useProjectContract(id!);
  
  const acceptBid = useAcceptBid();
  const rejectBid = useRejectBid();
  const createContract = useCreateContract();

  const isLoading = projectLoading || bidsLoading;

  const handleAcceptBid = async (bidId: string, freelancerId: string, amount: number) => {
    if (!user || !id) return;

    try {
      // Accept bid (this also updates project status and rejects other bids)
      await acceptBid.mutateAsync({ bidId, projectId: id });

      // Create contract
      await createContract.mutateAsync({
        project_id: id,
        bid_id: bidId,
        freelancer_id: freelancerId,
        total_amount: amount
      });

      toast({
        title: 'Bid accepted',
        description: 'Contract has been created. The freelancer can now start working.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept bid',
        variant: 'destructive'
      });
    }
  };

  const handleRejectBid = async (bidId: string) => {
    try {
      await rejectBid.mutateAsync(bidId);
      toast({
        title: 'Bid rejected',
        description: 'The bid has been rejected.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject bid',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
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
          <Button variant="link" onClick={() => navigate('/client/projects')}>
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const pendingBids = bids?.filter(b => b.status === 'pending') || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/client/projects')}>
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

        {/* Project Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-semibold">
                  ${project.budget_min?.toLocaleString()} - ${project.budget_max?.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">{project.duration_days || 0} days</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-semibold">{project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Bids</p>
                <p className="font-semibold">{bids?.length || 0} received</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {project.tech_stack.map((tech) => (
              <Badge key={tech} variant="secondary">{tech}</Badge>
            ))}
          </div>
        )}

        <Tabs defaultValue={project.status === 'open' ? 'bids' : 'milestones'}>
          <TabsList>
            <TabsTrigger value="bids">Bids ({bids?.length || 0})</TabsTrigger>
            <TabsTrigger value="milestones">Milestones ({milestones?.length || 0})</TabsTrigger>
            <TabsTrigger value="requirements">Requirements ({requirements?.length || 0})</TabsTrigger>
            <TabsTrigger value="commits">Commits</TabsTrigger>
          </TabsList>

          <TabsContent value="bids" className="mt-6 space-y-4">
            {pendingBids.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No pending bids yet</p>
                </CardContent>
              </Card>
            ) : (
              pendingBids.map((bid) => (
                <Card key={bid.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={bid.freelancer?.avatar_url || undefined} />
                          <AvatarFallback>{bid.freelancer?.full_name?.charAt(0) || 'F'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{bid.freelancer?.full_name || 'Unknown Freelancer'}</p>
                          <p className="text-sm text-muted-foreground">★ {bid.freelancer?.trust_score?.toFixed(1) || '0.0'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${bid.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{bid.estimated_duration_days} days</p>
                      </div>
                    </div>
                    {bid.proposal && (
                      <p className="mt-4 text-muted-foreground">{bid.proposal}</p>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => handleAcceptBid(bid.id, bid.freelancer_id, bid.amount)}>
                        Accept Bid
                      </Button>
                      <Button variant="outline" onClick={() => handleRejectBid(bid.id)}>
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="milestones" className="mt-6 space-y-4">
            {!milestones || milestones.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No milestones yet</p>
                </CardContent>
              </Card>
            ) : (
              milestones.map((milestone, index) => (
                <Card key={milestone.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {index + 1}
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
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p>{req.requirement_text}</p>
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

export default ClientProjectDetail;
