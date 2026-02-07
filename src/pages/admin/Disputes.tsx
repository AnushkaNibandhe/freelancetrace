import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Clock, FileText, MessageSquare } from 'lucide-react';

const disputes = [
  { id: '1', project: 'E-commerce Platform Redesign', milestone: 'Frontend Implementation', openedBy: 'TechCorp Inc.', against: 'Alex Chen', reason: 'Incomplete deliverables', amount: 5000, status: 'open' as const, created: '2024-02-28' },
  { id: '2', project: 'Mobile Banking App', milestone: 'UI/UX Design', openedBy: 'FinanceApp Ltd.', against: 'John Doe', reason: 'Quality not meeting standards', amount: 3000, status: 'under_review' as const, created: '2024-02-25' },
  { id: '3', project: 'CRM Integration', milestone: 'API Development', openedBy: 'Sarah Johnson', against: 'SalesForce Pro', reason: 'Payment delay', amount: 4500, status: 'resolved' as const, created: '2024-02-15' },
];

const AdminDisputes: React.FC = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Disputes</h1><p className="text-muted-foreground mt-1">Review and resolve platform disputes</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-4 flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-destructive" /></div><div><p className="text-2xl font-bold">2</p><p className="text-sm text-muted-foreground">Open Disputes</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center"><Clock className="h-6 w-6 text-warning" /></div><div><p className="text-2xl font-bold">1</p><p className="text-sm text-muted-foreground">Under Review</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-success" /></div><div><p className="text-2xl font-bold">15</p><p className="text-sm text-muted-foreground">Resolved This Month</p></div></CardContent></Card>
        </div>
        <Tabs defaultValue="all">
          <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="open">Open</TabsTrigger><TabsTrigger value="under_review">Under Review</TabsTrigger><TabsTrigger value="resolved">Resolved</TabsTrigger></TabsList>
          <TabsContent value="all" className="mt-6 space-y-4">
            {disputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div><CardTitle className="text-lg">{dispute.project}</CardTitle><CardDescription>{dispute.milestone}</CardDescription></div>
                    <StatusBadge status={dispute.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 mb-4">
                    <div><p className="text-sm text-muted-foreground">Opened by</p><p className="font-medium">{dispute.openedBy}</p></div>
                    <div><p className="text-sm text-muted-foreground">Against</p><p className="font-medium">{dispute.against}</p></div>
                    <div><p className="text-sm text-muted-foreground">Reason</p><p className="font-medium">{dispute.reason}</p></div>
                    <div><p className="text-sm text-muted-foreground">Disputed Amount</p><p className="font-bold text-lg">${dispute.amount.toLocaleString()}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" />View Evidence</Button>
                    <Button variant="outline" size="sm"><MessageSquare className="mr-2 h-4 w-4" />Messages</Button>
                    {dispute.status !== 'resolved' && <Button size="sm">Resolve Dispute</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminDisputes;
