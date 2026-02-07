import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
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

// Demo earnings data
const earningsData = [
  { month: 'Sep', amount: 4500 },
  { month: 'Oct', amount: 6200 },
  { month: 'Nov', amount: 5800 },
  { month: 'Dec', amount: 8100 },
  { month: 'Jan', amount: 7200 },
  { month: 'Feb', amount: 9500 },
];

const transactions = [
  {
    id: '1',
    project: 'E-commerce Platform Redesign',
    milestone: 'UI/UX Design',
    amount: 3000,
    status: 'completed' as const,
    date: '2024-02-10',
    client: 'TechCorp Inc.',
  },
  {
    id: '2',
    project: 'CRM Integration API',
    milestone: 'API Architecture',
    amount: 2000,
    status: 'completed' as const,
    date: '2024-02-05',
    client: 'SalesForce Pro',
  },
  {
    id: '3',
    project: 'E-commerce Platform Redesign',
    milestone: 'Frontend Implementation',
    amount: 5000,
    status: 'processing' as const,
    date: '2024-03-01',
    client: 'TechCorp Inc.',
  },
  {
    id: '4',
    project: 'CRM Integration API',
    milestone: 'Core Endpoints',
    amount: 3500,
    status: 'pending' as const,
    date: null,
    client: 'SalesForce Pro',
  },
];

const chartConfig = {
  amount: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};

const FreelancerEarnings: React.FC = () => {
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
            value="$32,500"
            icon={DollarSign}
            description="All time"
          />
          <StatCard
            title="This Month"
            value="$9,500"
            icon={TrendingUp}
            trend={{ value: 32, isPositive: true }}
          />
          <StatCard
            title="Pending Payouts"
            value="$8,500"
            icon={Clock}
            description="2 milestones"
          />
          <StatCard
            title="Available Balance"
            value="$5,000"
            icon={Wallet}
          />
        </div>

        {/* Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
            <CardDescription>Your earnings over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
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
                  <p className="text-sm text-muted-foreground">HDFC Bank ****4532</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-success flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Verified
                </span>
                <Button variant="outline" size="sm">Change</Button>
              </div>
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
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="processing">Processing</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          tx.status === 'completed' ? 'bg-success/10' :
                          tx.status === 'processing' ? 'bg-info/10' : 'bg-muted'
                        }`}>
                          {tx.status === 'completed' ? (
                            <ArrowUpRight className="h-5 w-5 text-success" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{tx.project}</p>
                          <p className="text-sm text-muted-foreground">
                            {tx.milestone} • {tx.client}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-success">+${tx.amount.toLocaleString()}</p>
                          {tx.date && (
                            <p className="text-xs text-muted-foreground">{tx.date}</p>
                          )}
                        </div>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-6">
                <div className="space-y-4">
                  {transactions
                    .filter((tx) => tx.status === 'completed')
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                            <ArrowUpRight className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.project}</p>
                            <p className="text-sm text-muted-foreground">{tx.milestone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">+${tx.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{tx.date}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="pending" className="mt-6">
                <div className="space-y-4">
                  {transactions
                    .filter((tx) => tx.status === 'pending')
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.project}</p>
                            <p className="text-sm text-muted-foreground">{tx.milestone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold">${tx.amount.toLocaleString()}</p>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="processing" className="mt-6">
                <div className="space-y-4">
                  {transactions
                    .filter((tx) => tx.status === 'processing')
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-info" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.project}</p>
                            <p className="text-sm text-muted-foreground">{tx.milestone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold">${tx.amount.toLocaleString()}</p>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default FreelancerEarnings;
