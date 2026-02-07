import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Link } from 'react-router-dom';
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

// Demo projects data
const demoProjects = [
  {
    id: '1',
    title: 'E-commerce Platform Redesign',
    description: 'Complete overhaul of the existing e-commerce platform with modern UI/UX',
    status: 'in_progress' as const,
    fulfillment: 72,
    drift: 5,
    budget: { min: 12000, max: 15000 },
    bidsCount: 8,
    freelancer: { name: 'Alex Chen', avatar: null, trustScore: 4.8 },
    dueDate: '2024-03-15',
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    requirements: { total: 24, fulfilled: 17 },
    created: '2024-01-10',
  },
  {
    id: '2',
    title: 'Mobile Banking App',
    description: 'Native mobile application for iOS and Android with banking features',
    status: 'open' as const,
    fulfillment: 0,
    drift: 0,
    budget: { min: 20000, max: 25000 },
    bidsCount: 12,
    freelancer: null,
    dueDate: '2024-04-01',
    techStack: ['React Native', 'Firebase', 'TypeScript'],
    requirements: { total: 32, fulfilled: 0 },
    created: '2024-02-01',
  },
  {
    id: '3',
    title: 'CRM Integration API',
    description: 'RESTful API for integrating with major CRM platforms',
    status: 'completed' as const,
    fulfillment: 100,
    drift: 0,
    budget: { min: 8000, max: 8500 },
    bidsCount: 5,
    freelancer: { name: 'Sarah Johnson', avatar: null, trustScore: 4.9 },
    dueDate: '2024-02-28',
    techStack: ['Python', 'FastAPI', 'Redis'],
    requirements: { total: 18, fulfilled: 18 },
    created: '2024-01-05',
  },
  {
    id: '4',
    title: 'AI Chatbot Development',
    description: 'Intelligent customer support chatbot with NLP capabilities',
    status: 'draft' as const,
    fulfillment: 0,
    drift: 0,
    budget: { min: 10000, max: 12000 },
    bidsCount: 0,
    freelancer: null,
    dueDate: null,
    techStack: ['Python', 'TensorFlow', 'Docker'],
    requirements: { total: 15, fulfilled: 0 },
    created: '2024-02-15',
  },
];

const ClientProjects: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredProjects = demoProjects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || project.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const getStatusCounts = () => ({
    all: demoProjects.length,
    draft: demoProjects.filter((p) => p.status === 'draft').length,
    open: demoProjects.filter((p) => p.status === 'open').length,
    in_progress: demoProjects.filter((p) => p.status === 'in_progress').length,
    completed: demoProjects.filter((p) => p.status === 'completed').length,
  });

  const counts = getStatusCounts();

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
                filteredProjects.map((project) => (
                  <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                        {/* Progress Ring */}
                        <div className="flex-shrink-0">
                          <ProgressRing
                            progress={project.fulfillment}
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
                                <StatusBadge status={project.status} />
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
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Project
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Tech Stack */}
                          <div className="flex flex-wrap gap-2">
                            {project.techStack.map((tech) => (
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
                                  {project.requirements.fulfilled}/{project.requirements.total}
                                </p>
                                <p className="text-xs text-muted-foreground">Requirements</p>
                              </div>
                            </div>
                            {project.drift > 0 && (
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-warning" />
                                <div>
                                  <p className="text-sm font-medium">{project.drift}%</p>
                                  <p className="text-xs text-muted-foreground">Drift Score</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{project.bidsCount}</p>
                                <p className="text-xs text-muted-foreground">Bids</p>
                              </div>
                            </div>
                            {project.dueDate && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{project.dueDate}</p>
                                  <p className="text-xs text-muted-foreground">Due Date</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-4 border-t border-border">
                            <div>
                              <p className="text-lg font-bold">
                                ${project.budget.min.toLocaleString()} - ${project.budget.max.toLocaleString()}
                              </p>
                              {project.freelancer && (
                                <p className="text-sm text-muted-foreground">
                                  Assigned to {project.freelancer.name} (★ {project.freelancer.trustScore})
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
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClientProjects;
