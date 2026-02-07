import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
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

// Demo payment data
const demoPayments = [
  {
    id: '1',
    project: 'E-commerce Platform Redesign',
    milestone: 'Frontend Implementation',
    freelancer: 'Alex Chen',
    amount: 5000,
    platformFee: 250,
    status: 'completed' as const,
    date: '2024-02-15',
    type: 'payout',
  },
  {
    id: '2',
    project: 'CRM Integration API',
    milestone: 'API Development',
    freelancer: 'Sarah Johnson',
    amount: 8500,
    platformFee: 425,
    status: 'completed' as const,
    date: '2024-02-28',
    type: 'payout',
  },
  {
    id: '3',
    project: 'E-commerce Platform Redesign',
    milestone: 'Backend Development',
    freelancer: 'Alex Chen',
    amount: 6000,
    platformFee: 300,
    status: 'processing' as const,
    date: '2024-03-05',
    type: 'payout',
  },
  {
    id: '4',
    project: 'Mobile Banking App',
    milestone: 'UI/UX Design',
    freelancer: 'Pending Assignment',
    amount: 3000,
    platformFee: 150,
    status: 'pending' as const,
    date: null,
    type: 'escrow',
  },
];

const ClientPayments: React.FC = () => {
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
            value="$48,500"
            icon={CreditCard}
            description="All time"
          />
          <StatCard
            title="This Month"
            value="$14,500"
            icon={ArrowUpRight}
            trend={{ value: 12, isPositive: false }}
          />
          <StatCard
            title="In Escrow"
            value="$3,000"
            icon={Clock}
            description="Pending release"
          />
          <StatCard
            title="Platform Fees"
            value="$2,425"
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
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="processing">Processing</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {demoPayments.map((payment) => (
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
                          <p className="font-medium">{payment.project}</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.milestone} • {payment.freelancer}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">${payment.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            +${payment.platformFee} fee
                          </p>
                        </div>
                        <StatusBadge status={payment.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-6">
                <div className="space-y-4">
                  {demoPayments
                    .filter((p) => p.status === 'completed')
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.project}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.milestone} • {payment.date}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold">${payment.amount.toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="pending" className="mt-6">
                <div className="space-y-4">
                  {demoPayments
                    .filter((p) => p.status === 'pending')
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.project}</p>
                            <p className="text-sm text-muted-foreground">{payment.milestone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold">${payment.amount.toLocaleString()}</p>
                          <StatusBadge status={payment.status} />
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="processing" className="mt-6">
                <div className="space-y-4">
                  {demoPayments
                    .filter((p) => p.status === 'processing')
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-info" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.project}</p>
                            <p className="text-sm text-muted-foreground">{payment.milestone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold">${payment.amount.toLocaleString()}</p>
                          <StatusBadge status={payment.status} />
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

export default ClientPayments;
