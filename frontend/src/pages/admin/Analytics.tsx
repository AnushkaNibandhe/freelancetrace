import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, Legend,
} from 'recharts';
import { Users, FolderKanban, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAdminStats } from '@/hooks/useProfiles';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
];

const chartConfig = {
  projects: { label: 'Projects', color: 'hsl(var(--primary))' },
  users: { label: 'Users', color: 'hsl(var(--accent))' },
};

const AdminAnalytics: React.FC = () => {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">Platform-wide insights and trends</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Derived data
  const statusData = Object.entries(stats?.projects?.by_status || {}).map(([k, v]) => ({
    name: k.replace('_', ' '),
    value: v as number,
  }));

  const domainData = Object.entries(stats?.projects?.by_domain || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 8)
    .map(([k, v]) => ({ name: k, count: v as number }));

  const userBreakdown = [
    { name: 'Clients', value: stats?.users?.clients || 0 },
    { name: 'Freelancers', value: stats?.users?.freelancers || 0 },
  ];

  const radarData = [
    { subject: 'Clients', value: stats?.users?.clients || 0 },
    { subject: 'Freelancers', value: stats?.users?.freelancers || 0 },
    { subject: 'Verified', value: stats?.users?.verified || 0 },
    { subject: 'Active Projects', value: stats?.projects?.by_status?.in_progress || 0 },
    { subject: 'Completed', value: stats?.projects?.by_status?.completed || 0 },
    { subject: 'Bids', value: Math.min(stats?.bids?.total || 0, stats?.users?.total || 0) },
  ];

  const completionRate = stats?.projects?.total
    ? Math.round(((stats.projects.by_status?.completed || 0) / stats.projects.total) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Platform-wide insights and trends</p>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={(stats?.users?.total || 0).toLocaleString()}
            icon={Users}
            description={`${stats?.users?.verified || 0} verified`}
          />
          <StatCard
            title="Total Projects"
            value={(stats?.projects?.total || 0).toLocaleString()}
            icon={FolderKanban}
            description={`${stats?.projects?.by_status?.in_progress || 0} active`}
          />
          <StatCard
            title="Total Bids"
            value={(stats?.bids?.total || 0).toLocaleString()}
            icon={TrendingUp}
            description={`${stats?.bids?.avg_per_project || 0} avg per project`}
          />
          <StatCard
            title="Completion Rate"
            value={`${completionRate}%`}
            icon={CheckCircle2}
            description={`${stats?.projects?.by_status?.completed || 0} completed`}
          />
        </div>

        {/* Monthly Trends */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Project Creation</CardTitle>
              <CardDescription>New projects over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthly || []}>
                    <defs>
                      <linearGradient id="projectGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="projects" stroke="hsl(var(--primary))" fill="url(#projectGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly User Registrations</CardTitle>
              <CardDescription>New users over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthly || []}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="users" stroke="hsl(var(--accent))" fill="url(#userGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Project Status Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Project Status</CardTitle>
              <CardDescription>Distribution by status</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Breakdown Pie */}
          <Card>
            <CardHeader>
              <CardTitle>User Breakdown</CardTitle>
              <CardDescription>Clients vs Freelancers</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={userBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {userBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 w-full mt-2 text-center">
                <div>
                  <p className="text-2xl font-bold">{stats?.users?.clients || 0}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.users?.freelancers || 0}</p>
                  <p className="text-xs text-muted-foreground">Freelancers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Radar */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Health</CardTitle>
              <CardDescription>Key metrics overview</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Domain Bar Chart */}
        {domainData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Projects by Domain</CardTitle>
              <CardDescription>Top project categories on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={domainData} layout="vertical" margin={{ left: 16 }}>
                    <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* User Status Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold text-green-600">{stats?.users?.verified || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Verified Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold text-red-500">{stats?.users?.suspended || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Suspended Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-4xl font-bold text-primary">{stats?.bids?.accepted || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Accepted Bids</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminAnalytics;
