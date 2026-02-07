import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useClientProjects, useDeleteProject } from '@/hooks/useProjects';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ClientProjects: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: projects, isLoading } = useClientProjects();
  const deleteProject = useDeleteProject();

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || project.status === activeTab;
    return matchesSearch && matchesTab;
  }) || [];

  const getStatusCounts = () => ({
    all: projects?.length || 0,
    draft: projects?.filter((p) => p.status === 'draft').length || 0,
    open: projects?.filter((p) => p.status === 'open').length || 0,
    in_progress: projects?.filter((p) => p.status === 'in_progress').length || 0,
    completed: projects?.filter((p) => p.status === 'completed').length || 0,
  });

  const counts = getStatusCounts();

  const getProjectMetrics = (project: any) => {
    const requirements = project.requirements || [];
    const fulfilled = requirements.filter((r: any) => r.status === 'fulfilled').length;
    const total = requirements.length;
    const fulfillment = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
    
    const avgCoverage = requirements.length > 0
      ? Math.round(requirements.reduce((sum: number, r: any) => sum + (r.coverage_percentage || 0), 0) / requirements.length)
      : 0;
    
    return { fulfillment, fulfilled, total, avgCoverage };
  };

  const handleDelete = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject.mutate(projectId);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
            <h1 className="text-3xl font-bold">My Projects</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your projects</p>
          </div>
          <Button asChild>
            <Link to="/client/create-project">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
            <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({counts.in_progress})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="grid gap-6">
              {filteredProjects.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No projects found</p>
                    <Button asChild>
                      <Link to="/client/create-project">Create your first project</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredProjects.map((project) => {
                  const metrics = getProjectMetrics(project);
                  const bidsCount = (project.bids as any)?.[0]?.count || 0;
                  
                  return (
                    <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                          {/* Progress Ring */}
                          <div className="flex-shrink-0">
                            <ProgressRing
                              progress={metrics.fulfillment}
                              size={100}
                              strokeWidth={6}
                              label="Fulfillment"
                            />
                          </div>

                          {/* Project Info */}
                          <div className="flex-1 min-w-0 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-semibold">{project.title}</h3>
                                  <StatusBadge status={project.status || 'draft'} />
                                </div>
                                <p className="text-muted-foreground mt-1 line-clamp-2">
                                  {project.description}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link to={`/client/projects/${project.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Project
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDelete(project.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Tech Stack */}
                            <div className="flex flex-wrap gap-2">
                              {project.tech_stack?.map((tech) => (
                                <span
                                  key={tech}
                                  className="px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {metrics.fulfilled}/{metrics.total}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Requirements</p>
                                </div>
                              </div>
                              {metrics.avgCoverage > 0 && metrics.avgCoverage < 50 && (
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-warning" />
                                  <div>
                                    <p className="text-sm font-medium">{metrics.avgCoverage}%</p>
                                    <p className="text-xs text-muted-foreground">Avg Coverage</p>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{bidsCount}</p>
                                  <p className="text-xs text-muted-foreground">Bids</p>
                                </div>
                              </div>
                              {project.duration_days && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{project.duration_days} days</p>
                                    <p className="text-xs text-muted-foreground">Duration</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-border">
                              <div>
                                <p className="text-lg font-bold">
                                  ${project.budget_min?.toLocaleString() || 0} - ${project.budget_max?.toLocaleString() || 0}
                                </p>
                                {project.freelancer && (
                                  <p className="text-sm text-muted-foreground">
                                    Assigned to {project.freelancer.full_name} (★ {project.freelancer.trust_score})
                                  </p>
                                )}
                              </div>
                              <Button variant="outline" asChild>
                                <Link to={`/client/projects/${project.id}`}>View Project</Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClientProjects;
