import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientPayments, usePaymentStats, useInitiatePayment } from '@/hooks/usePayments';
import {
  CreditCard,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ClientPayments: React.FC = () => {
  const { data: payments, isLoading } = useClientPayments();
  const { data: stats } = usePaymentStats('client');
  const initiatePayment = useInitiatePayment();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const filteredPayments = (status?: string) => {
    if (!status || status === 'all') return payments || [];
    return payments?.filter(p => p.status === status) || [];
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Payments</h1>
            <p className="text-muted-foreground mt-1">Manage your payment history and pending transactions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Spent"
            value={`$${stats?.totalAmount?.toLocaleString() || 0}`}
            icon={CreditCard}
            description="All time"
          />
          <StatCard
            title="This Month"
            value={`$${stats?.thisMonthAmount?.toLocaleString() || 0}`}
            icon={ArrowUpRight}
          />
          <StatCard
            title="Pending"
            value={`$${stats?.pendingAmount?.toLocaleString() || 0}`}
            icon={Clock}
            description={`${stats?.pendingCount || 0} payments`}
          />
          <StatCard
            title="Platform Fees"
            value={`$${stats?.platformFees?.toLocaleString() || 0}`}
            icon={ArrowDownRight}
            description="5% of payouts"
          />
        </div>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your payment methods for milestone payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Razorpay</p>
                  <p className="text-sm text-muted-foreground">Connected • Auto-pay enabled</p>
                </div>
              </div>
              <Button variant="outline">Manage</Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All your payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({payments?.length || 0})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({filteredPayments('completed').length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({filteredPayments('pending').length})</TabsTrigger>
                <TabsTrigger value="processing">Processing ({filteredPayments('processing').length})</TabsTrigger>
              </TabsList>

              {['all', 'completed', 'pending', 'processing'].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-6">
                  <div className="space-y-4">
                    {filteredPayments(tab === 'all' ? undefined : tab).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No {tab === 'all' ? '' : tab} payments</p>
                      </div>
                    ) : (
                      filteredPayments(tab === 'all' ? undefined : tab).map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              payment.status === 'completed' ? 'bg-success/10' : 
                              payment.status === 'processing' ? 'bg-info/10' : 'bg-muted'
                            }`}>
                              {payment.status === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              ) : (
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{(payment as any).milestone?.project?.title || 'Project'}</p>
                              <p className="text-sm text-muted-foreground">
                                {(payment as any).milestone?.title || 'Milestone'} • {(payment as any).payee?.full_name || 'Freelancer'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold">${payment.amount.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                +${payment.platform_fee?.toLocaleString() || 0} fee
                              </p>
                            </div>
                            <StatusBadge status={payment.status || 'pending'} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ClientPayments;
