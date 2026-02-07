import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Users, FolderKanban, AlertTriangle, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from 'recharts';

const revenueData = [
  { month: 'Sep', revenue: 12500 },
  { month: 'Oct', revenue: 18200 },
  { month: 'Nov', revenue: 15800 },
  { month: 'Dec', revenue: 22100 },
  { month: 'Jan', revenue: 19200 },
  { month: 'Feb', revenue: 25500 },
];

const projectsData = [
  { month: 'Sep', projects: 8 },
  { month: 'Oct', projects: 12 },
  { month: 'Nov', projects: 10 },
  { month: 'Dec', projects: 15 },
  { month: 'Jan', projects: 14 },
  { month: 'Feb', projects: 18 },
];

const recentDisputes = [
  { id: '1', project: 'E-commerce Platform', parties: 'TechCorp vs Alex Chen', status: 'open' as const, amount: 5000 },
  { id: '2', project: 'Mobile App', parties: 'StartupXYZ vs John Doe', status: 'under_review' as const, amount: 3000 },
];

const chartConfig = { revenue: { label: 'Revenue', color: 'hsl(var(--primary))' }, projects: { label: 'Projects', color: 'hsl(var(--accent))' }};

const AdminDashboard: React.FC = () => {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value="1,234" icon={Users} trend={{ value: 12, isPositive: true }} />
          <StatCard title="Active Projects" value="89" icon={FolderKanban} />
          <StatCard title="Open Disputes" value="3" icon={AlertTriangle} />
          <StatCard title="Platform Revenue" value="$125,400" icon={DollarSign} trend={{ value: 18, isPositive: true }} />
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
            <div className="space-y-4">
              {recentDisputes.map((dispute) => (
                <div key={dispute.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium">{dispute.project}</p>
                    <p className="text-sm text-muted-foreground">{dispute.parties}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">${dispute.amount.toLocaleString()}</span>
                    <StatusBadge status={dispute.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
