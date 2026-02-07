import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Users, FolderKanban, AlertTriangle, DollarSign } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useProfiles } from '@/hooks/useProfiles';
import { useProjects } from '@/hooks/useProjects';
import { useDisputes } from '@/hooks/useDisputes';
import { usePayments } from '@/hooks/usePayments';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const chartConfig = { 
  revenue: { label: 'Revenue', color: 'hsl(var(--primary))' }, 
  projects: { label: 'Projects', color: 'hsl(var(--accent))' }
};

const AdminDashboard: React.FC = () => {
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: disputes, isLoading: disputesLoading } = useDisputes();
  const { data: payments, isLoading: paymentsLoading } = usePayments();

  const isLoading = profilesLoading || projectsLoading || disputesLoading || paymentsLoading;

  // Calculate stats
  const totalUsers = profiles?.length || 0;
  const activeProjects = projects?.filter(p => p.status === 'in_progress').length || 0;
  const openDisputes = disputes?.filter(d => d.status === 'open' || d.status === 'under_review').length || 0;
  const totalRevenue = payments?.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.platform_fee || 0), 0) || 0;

  // Generate revenue data for last 6 months
  const revenueData = React.useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthRevenue = payments?.filter(p => {
        if (p.status !== 'completed' || !p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate >= monthStart && paidDate <= monthEnd;
      }).reduce((sum, p) => sum + Number(p.platform_fee || 0), 0) || 0;

      months.push({
        month: format(date, 'MMM'),
        revenue: monthRevenue
      });
    }
    return months;
  }, [payments]);

  // Generate projects data for last 6 months
  const projectsData = React.useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthProjects = projects?.filter(p => {
        if (!p.created_at) return false;
        const createdDate = new Date(p.created_at);
        return createdDate >= monthStart && createdDate <= monthEnd;
      }).length || 0;

      months.push({
        month: format(date, 'MMM'),
        projects: monthProjects
      });
    }
    return months;
  }, [projects]);

  // Recent disputes
  const recentDisputes = disputes?.filter(d => d.status !== 'resolved').slice(0, 5) || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Platform overview and management</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value={totalUsers.toLocaleString()} icon={Users} />
          <StatCard title="Active Projects" value={activeProjects.toString()} icon={FolderKanban} />
          <StatCard title="Open Disputes" value={openDisputes.toString()} icon={AlertTriangle} />
          <StatCard title="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Revenue</CardTitle><CardDescription>Monthly platform revenue</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Projects</CardTitle><CardDescription>Monthly project volume</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectsData}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="projects" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: 'hsl(var(--accent))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Disputes</CardTitle><CardDescription>Disputes requiring attention</CardDescription></CardHeader>
          <CardContent>
            {recentDisputes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No open disputes</p>
            ) : (
              <div className="space-y-4">
                {recentDisputes.map((dispute) => (
                  <div key={dispute.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">{dispute.reason}</p>
                      <p className="text-sm text-muted-foreground">
                        {dispute.opener?.full_name || 'Unknown'} vs {dispute.defendant?.full_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={dispute.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
