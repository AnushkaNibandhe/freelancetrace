import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFreelancerPayments, usePaymentStats } from '@/hooks/usePayments';
import {
  CreditCard,
  Download,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const chartConfig = {
  amount: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};

const FreelancerEarnings: React.FC = () => {
  const { data: payments, isLoading } = useFreelancerPayments();
  const { data: stats } = usePaymentStats('freelancer');

  // Generate chart data from payments
  const chartData = React.useMemo(() => {
    if (!payments) return [];
    
    const monthlyData: Record<string, number> = {};
    const completedPayments = payments.filter(p => p.status === 'completed' && p.paid_at);
    
    completedPayments.forEach(payment => {
      const date = new Date(payment.paid_at!);
      const month = date.toLocaleString('default', { month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + payment.net_amount;
    });
    
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [payments]);

  const filteredPayments = (status?: string) => {
    if (!status || status === 'all') return payments || [];
    return payments?.filter(p => p.status === status) || [];
  };

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
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Earnings</h1>
            <p className="text-muted-foreground mt-1">Track your income and manage payouts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
            <Button>
              <Wallet className="mr-2 h-4 w-4" />
              Withdraw Funds
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Earnings"
            value={`$${stats?.totalAmount?.toLocaleString() || 0}`}
            icon={DollarSign}
            description="All time"
          />
          <StatCard
            title="This Month"
            value={`$${stats?.thisMonthAmount?.toLocaleString() || 0}`}
            icon={TrendingUp}
          />
          <StatCard
            title="Pending Payouts"
            value={`$${stats?.pendingAmount?.toLocaleString() || 0}`}
            icon={Clock}
            description={`${stats?.pendingCount || 0} milestones`}
          />
          <StatCard
            title="Available Balance"
            value={`$${(stats?.totalAmount || 0) - (stats?.pendingAmount || 0)}`}
            icon={Wallet}
          />
        </div>

        {/* Earnings Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Earnings Overview</CardTitle>
              <CardDescription>Your earnings over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorAmount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Payout Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Settings</CardTitle>
            <CardDescription>Manage your payment method and payout preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Bank Account</p>
                  <p className="text-sm text-muted-foreground">Configure your bank details</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All your earnings transactions</CardDescription>
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
                        <p>No {tab === 'all' ? '' : tab} transactions</p>
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
                                <ArrowUpRight className="h-5 w-5 text-success" />
                              ) : (
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {(payment as any).milestone?.project?.title || 'Project'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {(payment as any).milestone?.title || 'Milestone'} • {(payment as any).milestone?.project?.client?.full_name || 'Client'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-success">+${payment.net_amount.toLocaleString()}</p>
                              {payment.paid_at && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(payment.paid_at).toLocaleDateString()}
                                </p>
                              )}
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

export default FreelancerEarnings;
