import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

// Demo data for active projects
const activeProjects = [
  {
    id: '1',
    title: 'E-commerce Platform Redesign',
    client: 'TechCorp Inc.',
    status: 'in_progress' as const,
    fulfillment: 72,
    driftScore: 5,
    delayRisk: 'low',
    amount: 15000,
    milestones: [
      { id: 'm1', title: 'UI/UX Design', amount: 3000, status: 'approved' as const, fulfillment: 100 },
      { id: 'm2', title: 'Frontend Implementation', amount: 5000, status: 'in_progress' as const, fulfillment: 85 },
      { id: 'm3', title: 'Backend Development', amount: 4000, status: 'pending' as const, fulfillment: 0 },
      { id: 'm4', title: 'Testing & Deployment', amount: 3000, status: 'pending' as const, fulfillment: 0 },
    ],
    requirements: [
      { id: 'r1', text: 'User authentication with OAuth', status: 'fulfilled' as const, coverage: 95 },
      { id: 'r2', text: 'Product catalog with search and filters', status: 'in_progress' as const, coverage: 78 },
      { id: 'r3', text: 'Shopping cart functionality', status: 'in_progress' as const, coverage: 65 },
      { id: 'r4', text: 'Payment gateway integration', status: 'not_started' as const, coverage: 0 },
      { id: 'r5', text: 'Order management system', status: 'not_started' as const, coverage: 0 },
    ],
    github: {
      repo: 'techcorp/ecommerce-platform',
      lastCommit: '2 hours ago',
      commits: 47,
    },
    feedback: [
      { id: 'f1', content: 'API response time needs optimization', addressed: false },
      { id: 'f2', content: 'Great progress on the product listing!', addressed: true },
    ],
  },
  {
    id: '2',
    title: 'CRM Integration API',
    client: 'SalesForce Pro',
    status: 'in_progress' as const,
    fulfillment: 45,
    driftScore: 0,
    delayRisk: 'medium',
    amount: 8500,
    milestones: [
      { id: 'm1', title: 'API Architecture', amount: 2000, status: 'approved' as const, fulfillment: 100 },
      { id: 'm2', title: 'Core Endpoints', amount: 3500, status: 'in_progress' as const, fulfillment: 60 },
      { id: 'm3', title: 'Documentation & Testing', amount: 3000, status: 'pending' as const, fulfillment: 0 },
    ],
    requirements: [
      { id: 'r1', text: 'RESTful API design', status: 'fulfilled' as const, coverage: 100 },
      { id: 'r2', text: 'CRM data sync endpoints', status: 'in_progress' as const, coverage: 55 },
      { id: 'r3', text: 'Webhook integration', status: 'not_started' as const, coverage: 0 },
    ],
    github: {
      repo: 'salesforce/crm-api',
      lastCommit: '5 hours ago',
      commits: 23,
    },
    feedback: [],
  },
];

const FreelancerMyProjects: React.FC = () => {
  const [selectedProject, setSelectedProject] = React.useState(activeProjects[0]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground mt-1">Track progress and manage your active projects</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Project List */}
          <div className="space-y-4">
            {activeProjects.map((project) => (
              <Card
                key={project.id}
                className={`cursor-pointer transition-all ${
                  selectedProject.id === project.id ? 'ring-2 ring-primary' : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{project.title}</h4>
                      <p className="text-sm text-muted-foreground">{project.client}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={project.status} />
                        {project.driftScore > 0 && (
                          <span className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {project.driftScore}% drift
                          </span>
                        )}
                      </div>
                    </div>
                    <ProgressRing progress={project.fulfillment} size={50} strokeWidth={4} showLabel={false} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Project Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedProject.title}</CardTitle>
                  <CardDescription>{selectedProject.client}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${selectedProject.amount.toLocaleString()}</p>
                  <StatusBadge status={selectedProject.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="requirements">Requirements</TabsTrigger>
                  <TabsTrigger value="milestones">Milestones</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                  {/* Progress Overview */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted text-center">
                      <ProgressRing progress={selectedProject.fulfillment} size={80} strokeWidth={6} />
                      <p className="text-sm text-muted-foreground mt-2">Overall Progress</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{selectedProject.driftScore}%</div>
                      <p className="text-sm text-muted-foreground">Drift Score</p>
                      <p className={`text-xs mt-1 ${selectedProject.driftScore > 10 ? 'text-destructive' : 'text-success'}`}>
                        {selectedProject.driftScore > 10 ? 'Attention needed' : 'On track'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className={`text-2xl font-bold ${
                        selectedProject.delayRisk === 'low' ? 'text-success' :
                        selectedProject.delayRisk === 'medium' ? 'text-warning' : 'text-destructive'
                      }`}>
                        {selectedProject.delayRisk.charAt(0).toUpperCase() + selectedProject.delayRisk.slice(1)}
                      </div>
                      <p className="text-sm text-muted-foreground">Delay Risk</p>
                    </div>
                  </div>

                  {/* GitHub Info */}
                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{selectedProject.github.repo}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedProject.github.commits} commits • Last commit {selectedProject.github.lastCommit}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in GitHub
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="requirements" className="mt-6">
                  <div className="space-y-3">
                    {selectedProject.requirements.map((req) => (
                      <div key={req.id} className="p-4 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{req.text}</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={req.coverage} className="flex-1" />
                          <span className="text-sm text-muted-foreground w-12">{req.coverage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="milestones" className="mt-6">
                  <div className="space-y-4">
                    {selectedProject.milestones.map((milestone, index) => (
                      <div key={milestone.id} className="flex items-center gap-4">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          milestone.status === 'approved' ? 'bg-success text-success-foreground' :
                          milestone.status === 'in_progress' ? 'bg-primary text-primary-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {milestone.status === 'approved' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <span className="text-sm font-medium">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{milestone.title}</span>
                            <span className="font-bold">${milestone.amount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={milestone.fulfillment} className="flex-1 h-2" />
                            <StatusBadge status={milestone.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="feedback" className="mt-6">
                  {selectedProject.feedback.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No feedback yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedProject.feedback.map((fb) => (
                        <div key={fb.id} className="p-4 rounded-lg border border-border">
                          <div className="flex items-start justify-between gap-4">
                            <p>{fb.content}</p>
                            {fb.addressed ? (
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                            ) : (
                              <Button variant="outline" size="sm">
                                Address
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default FreelancerMyProjects;
