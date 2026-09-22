import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Calendar, IndianRupee, Users } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { format } from 'date-fns';

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'draft',       label: 'Draft',       color: 'bg-muted text-muted-foreground' },
  { key: 'open',        label: 'Open',         color: 'bg-blue-100 text-blue-700' },
  { key: 'in_progress', label: 'In Progress',  color: 'bg-amber-100 text-amber-700' },
  { key: 'completed',   label: 'Completed',    color: 'bg-green-100 text-green-700' },
  { key: 'cancelled',   label: 'Cancelled',    color: 'bg-red-100 text-red-700' },
];

const ProjectCard: React.FC<{ project: any }> = ({ project }) => (
  <Card className="mb-3 shadow-sm hover:shadow-md transition-shadow cursor-default">
    <CardContent className="p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm leading-tight line-clamp-2">{project.title}</p>
        {project.domain && (
          <Badge variant="outline" className="mt-1 text-xs">{project.domain}</Badge>
        )}
      </div>

      {project.client && (
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">
              {project.client.full_name?.[0] || project.client.email[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {project.client.full_name || project.client.email}
          </span>
        </div>
      )}

      {project.freelancer && (
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">
            {project.freelancer.full_name || project.freelancer.email}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {project.budget_max ? (
          <span className="flex items-center gap-0.5">
            <IndianRupee className="h-3 w-3" />
            {project.budget_max.toLocaleString()}
          </span>
        ) : <span />}
        {project.created_at && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(project.created_at), 'dd MMM')}
          </span>
        )}
      </div>

      {project.requirements?.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {project.requirements.length} requirement{project.requirements.length !== 1 ? 's' : ''}
        </div>
      )}
    </CardContent>
  </Card>
);

const AdminProjects: React.FC = () => {
  const { data: rawProjects, isLoading } = useProjects();
  const projects = rawProjects as any[] | undefined;
  const [search, setSearch] = useState('');

  const filtered = React.useMemo(() => {
    if (!projects) return [];
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p: any) =>
      p.title?.toLowerCase().includes(q) ||
      p.domain?.toLowerCase().includes(q) ||
      p.client?.full_name?.toLowerCase().includes(q) ||
      p.client?.email?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const byStatus = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    COLUMNS.forEach(c => { map[c.key] = []; });
    filtered.forEach((p: any) => {
      const key = p.status || 'draft';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">Kanban view of all platform projects</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {COLUMNS.map(c => (
              <div key={c.key} className="space-y-3">
                <Skeleton className="h-8 w-full" />
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map(col => (
              <div key={col.key} className="flex-shrink-0 w-64">
                <Card className="mb-3">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${col.color}`}>
                        {col.label}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        {byStatus[col.key]?.length || 0}
                      </span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <div className="space-y-0">
                  {byStatus[col.key]?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                      No projects
                    </p>
                  ) : (
                    byStatus[col.key].map((p: any) => (
                      <ProjectCard key={p.id} project={p} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminProjects;
