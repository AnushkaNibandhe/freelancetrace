import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Clock, FileText, MessageSquare } from 'lucide-react';
import { useDisputes, useUpdateDispute } from '@/hooks/useDisputes';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

const AdminDisputes: React.FC = () => {
  const { data: disputes, isLoading } = useDisputes();
  const updateDispute = useUpdateDispute();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const filteredDisputes = React.useMemo(() => {
    if (activeTab === 'all') return disputes || [];
    return disputes?.filter(d => d.status === activeTab) || [];
  }, [disputes, activeTab]);

  const openDisputes = disputes?.filter(d => d.status === 'open').length || 0;
  const underReviewDisputes = disputes?.filter(d => d.status === 'under_review').length || 0;
  const resolvedThisMonth = disputes?.filter(d => {
    if (d.status !== 'resolved' || !d.resolved_at) return false;
    const resolvedDate = new Date(d.resolved_at);
    const now = new Date();
    return resolvedDate.getMonth() === now.getMonth() && resolvedDate.getFullYear() === now.getFullYear();
  }).length || 0;

  const handleResolve = async () => {
    if (!selectedDispute || !resolution || !user) return;

    try {
      await updateDispute.mutateAsync({
        id: selectedDispute,
        status: 'resolved',
        resolution,
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      });
      toast({
        title: 'Dispute resolved',
        description: 'The dispute has been resolved successfully.'
      });
      setResolveDialogOpen(false);
      setSelectedDispute(null);
      setResolution('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve dispute',
        variant: 'destructive'
      });
    }
  };

  const handleMarkUnderReview = async (disputeId: string) => {
    try {
      await updateDispute.mutateAsync({
        id: disputeId,
        status: 'under_review'
      });
      toast({
        title: 'Status updated',
        description: 'The dispute is now under review.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update dispute status',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div><h1 className="text-3xl font-bold">Disputes</h1><p className="text-muted-foreground mt-1">Review and resolve platform disputes</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Disputes</h1><p className="text-muted-foreground mt-1">Review and resolve platform disputes</p></div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openDisputes}</p>
                <p className="text-sm text-muted-foreground">Open Disputes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{underReviewDisputes}</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedThisMonth}</p>
                <p className="text-sm text-muted-foreground">Resolved This Month</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="under_review">Under Review</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-6 space-y-4">
            {filteredDisputes.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-muted-foreground text-center">No disputes found</p>
                </CardContent>
              </Card>
            ) : (
              filteredDisputes.map((dispute) => (
                <Card key={dispute.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{dispute.project?.title || 'Unknown Project'}</CardTitle>
                        <CardDescription>{dispute.milestone?.title || 'General Dispute'}</CardDescription>
                      </div>
                      <StatusBadge status={dispute.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Opened by</p>
                        <p className="font-medium">{dispute.opener?.full_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Against</p>
                        <p className="font-medium">{dispute.defendant?.full_name || 'Unknown'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Reason</p>
                        <p className="font-medium">{dispute.reason}</p>
                      </div>
                      {dispute.resolution && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">Resolution</p>
                          <p className="font-medium">{dispute.resolution}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" />View Evidence</Button>
                      <Button variant="outline" size="sm"><MessageSquare className="mr-2 h-4 w-4" />Messages</Button>
                      {dispute.status === 'open' && (
                        <Button size="sm" onClick={() => handleMarkUnderReview(dispute.id)}>
                          Mark Under Review
                        </Button>
                      )}
                      {dispute.status !== 'resolved' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => {
                            setSelectedDispute(dispute.id);
                            setResolveDialogOpen(true);
                          }}
                        >
                          Resolve Dispute
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Provide a resolution for this dispute. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter resolution details..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={!resolution || updateDispute.isPending}>
              {updateDispute.isPending ? 'Resolving...' : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDisputes;
