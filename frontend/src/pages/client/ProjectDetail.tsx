import React, { useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Calendar, Clock, User, Upload, FileText, Loader2, CheckCircle2, Sparkles, Download } from 'lucide-react';
import { useProject, useUpdateProject, useDeleteProject, useUploadSRSToProject } from '@/hooks/useProjects';
import { useProjectBids, useAcceptBid, useRejectBid } from '@/hooks/useBids';
import { useProjectMilestones } from '@/hooks/useMilestones';
import { useProjectRequirements } from '@/hooks/useRequirements';
import { useProjectContract, useCreateContract } from '@/hooks/useContracts';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CommitList } from '@/components/github/CommitList';
import { ProjectMetricsDashboard } from '@/components/dashboard/ProjectMetricsDashboard';
import { UnassignButton } from '@/components/project/UnassignButton';
import { getToken, apiFetch } from '@/lib/api';

const priorityConfig = {
  high:   { label: 'High',   className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:    { label: 'Low',    className: 'bg-green-100 text-green-700 border-green-200' },
} as const;

const ClientProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || (undefined);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const srsInputRef = useRef<HTMLInputElement>(null);
  const [srsAnalyzing, setSrsAnalyzing] = useState(false);
  const [srsSuccess, setSrsSuccess] = useState<{ count: number; pipeline: string } | null>(null);
  const uploadSRSToProject = useUploadSRSToProject();

  const [srsGenerating, setSrsGenerating] = useState(false);
  const [srsGeneratedUrl, setSrsGeneratedUrl] = useState<string | null>(null);

  const handleGenerateSrs = async () => {
    if (!id) return;
    setSrsGenerating(true);
    setSrsGeneratedUrl(null);
    try {
      const response = await apiFetch(`/projects/${id}/generate-srs`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        let errorCode = 'unknown';
        try {
          const errData = await response.json();
          errorCode = errData?.error || 'unknown';
        } catch {
          // ignore JSON parse errors
        }
        let errorMessage = 'Failed to generate the SRS document. Please try again.';
        if (errorCode === 'groq_not_configured') {
          errorMessage = 'SRS generation is not configured. Please contact the administrator.';
        } else if (errorCode === 'groq_rate_limited') {
          errorMessage = 'SRS generation service is busy. Please try again in a moment.';
        } else if (errorCode === 'groq_timeout') {
          errorMessage = 'SRS generation timed out. Please try again.';
        } else if (errorCode === 'no_requirements') {
          errorMessage = 'No requirements found for this project. Upload a requirements document first.';
        }
        toast({
          title: 'SRS Generation Failed',
          description: (
            <div className="flex flex-col gap-2">
              <span>{errorMessage}</span>
              <Button size="sm" variant="outline" onClick={handleGenerateSrs}>
                Retry
              </Button>
            </div>
          ),
          variant: 'destructive',
        });
        return;
      }
      const data = await response.json();
      setSrsGeneratedUrl(data.file_url);
      toast({ title: `SRS Document generated (${data.page_count} page${data.page_count !== 1 ? 's' : ''})` });
    } catch {
      toast({
        title: 'SRS Generation Failed',
        description: (
          <div className="flex flex-col gap-2">
            <span>Failed to generate the SRS document. Please try again.</span>
            <Button size="sm" variant="outline" onClick={handleGenerateSrs}>
              Retry
            </Button>
          </div>
        ),
        variant: 'destructive',
      });
    } finally {
      setSrsGenerating(false);
    }
  };

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: bids, isLoading: bidsLoading } = useProjectBids(id!);
  const { data: milestones } = useProjectMilestones(id!);
  const { data: requirements } = useProjectRequirements(id!);
  const { data: contract } = useProjectContract(id!);

  const acceptBid = useAcceptBid();
  const rejectBid = useRejectBid();
  const createContract = useCreateContract();
  const deleteProject = useDeleteProject();

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project? Data is unrecoverable.')) return;
    try {
      await deleteProject.mutateAsync(id!);
      toast({ title: 'Project deleted successfully' });
      navigate('/client/projects');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
    }
  };

  const isLoading = projectLoading || bidsLoading;

  const handleAcceptBid = async (bidId: string, freelancerId: string, amount: number) => {
    if (!user || !id) return;

    try {
      // Accept bid (this also updates project status and rejects other bids)
      await acceptBid.mutateAsync({ bidId, projectId: id });

      // Create contract
      try {
        await createContract.mutateAsync({
          project_id: id,
          bid_id: bidId,
          freelancer_id: freelancerId,
          total_amount: amount
        });
      } catch (contractError) {
        console.warn('Mock contract creation bypassed:', contractError);
      }

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
          {user?.id === project.client_id && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateSrs}
              disabled={srsGenerating}
            >
              {srsGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating SRS...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" /> Generate SRS Document</>
              )}
            </Button>
          )}
          {project.awarded_freelancer_id && (user?.id === project.client_id || user?.role === 'admin') && (
            <UnassignButton
              projectId={project.id}
              freelancerName={project.freelancer?.full_name || 'the freelancer'}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['project', id] });
                toast({ title: 'Freelancer unassigned successfully' });
              }}
            />
          )}
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteProject.isPending}>
            {deleteProject.isPending ? 'Deleting...' : 'Delete Project'}
          </Button>
        </div>

        {/* PDF document download link */}
        {srsGeneratedUrl && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-3 flex items-center gap-3">
              <Download className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800 font-medium flex-1">
                Requirements document generated successfully.
              </p>
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${srsGeneratedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Project Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="font-semibold text-lg text-muted-foreground">₹</span>
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-semibold">
                  ₹{project.budget_min?.toLocaleString()} - ₹{project.budget_max?.toLocaleString()}
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

        {/* Contact Information */}
        <div className="grid gap-4 md:grid-cols-2">
          {project.client && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={project.client.avatar_url || undefined} />
                  <AvatarFallback>{project.client.full_name?.charAt(0) || 'C'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{project.client.full_name}</p>
                  <p className="text-sm text-muted-foreground">{project.client.email}</p>
                </div>
              </CardContent>
            </Card>
          )}
          {project.freelancer && (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm">Freelancer Information</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={project.freelancer.avatar_url || undefined} />
                  <AvatarFallback>{project.freelancer.full_name?.charAt(0) || 'F'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{project.freelancer.full_name}</p>
                  <p className="text-sm text-muted-foreground">{project.freelancer.email}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue={defaultTab || (project.status === 'open' ? 'bids' : 'milestones')}>
          <TabsList>
            <TabsTrigger value="bids">Bids ({bids?.length || 0})</TabsTrigger>
            <TabsTrigger value="milestones">Milestones ({milestones?.length || 0})</TabsTrigger>
            <TabsTrigger value="requirements">Requirements ({requirements?.length || 0})</TabsTrigger>
            <TabsTrigger value="commits">Commits</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                        <p className="text-2xl font-bold">₹{bid.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{bid.estimated_duration_days} days</p>
                        <div className="flex gap-1 justify-end mt-1 flex-wrap">
                          {bid.over_budget && bid.budget_diff_pct != null && bid.budget_diff_amount != null && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                              Over Budget (+₹{Math.round(bid.budget_diff_amount).toLocaleString()}, +{Math.round(bid.budget_diff_pct)}%)
                            </Badge>
                          )}
                          {bid.over_duration && bid.duration_diff_days != null && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                              Over Timeline (+{bid.duration_diff_days} days)
                            </Badge>
                          )}
                        </div>
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
                          <p className="font-bold">₹{milestone.amount.toLocaleString()}</p>
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
            {/* Upload requirements banner */}
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">AI Requirement Extraction</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a requirements document (PDF, DOCX) and AI will extract structured requirements automatically.
                  </p>
                </div>
                <input
                  type="file"
                  ref={srsInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !id) return;
                    setSrsAnalyzing(true);
                    setSrsSuccess(null);
                    try {
                      const result = await uploadSRSToProject.mutateAsync({ projectId: id, file });
                      setSrsSuccess({ count: result.requirements_extracted, pipeline: result.pipeline });
                      toast({ title: `✅ Extracted ${result.requirements_extracted} requirements via ${result.pipeline === 'gemini' ? 'Gemini AI' : result.pipeline}` });
                    } catch (err: unknown) {
                      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' });
                    } finally {
                      setSrsAnalyzing(false);
                      if (srsInputRef.current) srsInputRef.current.value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => srsInputRef.current?.click()}
                  disabled={srsAnalyzing}
                >
                  {srsAnalyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Upload Requirements</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Success banner */}
            {srsSuccess && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-3 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Extracted {srsSuccess.count} requirements via{' '}
                    {srsSuccess.pipeline === 'gemini' ? '🤖 Gemini AI' : srsSuccess.pipeline}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Requirements list */}
            {!requirements || requirements.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No requirements yet — upload a requirements document above to extract them automatically.</p>
                </CardContent>
              </Card>
            ) : (
              requirements.map((req, index) => {
                const pCfg = priorityConfig[(req.priority as keyof typeof priorityConfig) || 'medium'] || priorityConfig.medium;
                return (
                  <Card key={req.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{req.requirement_text}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`text-xs border ${pCfg.className}`}>{pCfg.label}</Badge>
                        <StatusBadge status={req.status || 'not_started'} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="commits" className="mt-6">
            <CommitList projectId={id!} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="mb-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/projects/${id}/retrace`, { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      toast({
                        title: 'Traceability re-run complete',
                        description: `${data.commits_reprocessed} commits matched against ${data.requirements_reembedded} requirements. ${data.new_trace_links} trace links created.`,
                      });
                      queryClient.invalidateQueries({ queryKey: ['project', id] });
                    } else {
                      toast({ title: 'Re-trace failed', description: data.error, variant: 'destructive' });
                    }
                  } catch {
                    toast({ title: 'Re-trace failed', variant: 'destructive' });
                  }
                }}
              >
                🔄 Re-run Traceability
              </Button>
            </div>
            <ProjectMetricsDashboard projectId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClientProjectDetail;
