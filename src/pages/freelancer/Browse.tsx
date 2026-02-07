import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  Filter,
  Clock,
  DollarSign,
  MapPin,
  Star,
  Bookmark,
  ArrowRight,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// Demo projects data
const demoProjects = [
  {
    id: '1',
    title: 'AI-Powered Content Management System',
    description: 'Build a modern CMS with AI capabilities for content generation, SEO optimization, and automated tagging. The system should support multiple content types and have a clean, intuitive admin interface.',
    client: {
      name: 'ContentPro Solutions',
      rating: 4.7,
      projectsCompleted: 15,
      avgApprovalTime: '2 days',
    },
    budget: { min: 12000, max: 18000 },
    duration: 45,
    techStack: ['React', 'Node.js', 'PostgreSQL', 'OpenAI API'],
    domain: 'Enterprise',
    bidsCount: 6,
    requirements: 28,
    postedAt: '2 days ago',
    status: 'open' as const,
  },
  {
    id: '2',
    title: 'Real-time Collaboration Platform',
    description: 'Develop a Figma-like collaboration tool for document editing. Features include real-time cursor tracking, commenting, version history, and team management. WebSocket-based architecture required.',
    client: {
      name: 'TeamSync Inc.',
      rating: 4.9,
      projectsCompleted: 23,
      avgApprovalTime: '1 day',
    },
    budget: { min: 25000, max: 35000 },
    duration: 60,
    techStack: ['React', 'TypeScript', 'Socket.io', 'Redis', 'AWS'],
    domain: 'SaaS',
    bidsCount: 12,
    requirements: 42,
    postedAt: '1 day ago',
    status: 'open' as const,
  },
  {
    id: '3',
    title: 'Healthcare Appointment Booking System',
    description: 'Create a comprehensive appointment booking system for a network of clinics. Features include patient portal, doctor scheduling, telemedicine integration, and billing management.',
    client: {
      name: 'MedCare Network',
      rating: 4.5,
      projectsCompleted: 8,
      avgApprovalTime: '3 days',
    },
    budget: { min: 15000, max: 22000 },
    duration: 50,
    techStack: ['Next.js', 'Python', 'FastAPI', 'PostgreSQL'],
    domain: 'Healthcare',
    bidsCount: 9,
    requirements: 35,
    postedAt: '3 days ago',
    status: 'open' as const,
  },
  {
    id: '4',
    title: 'E-learning Mobile Application',
    description: 'Build a cross-platform mobile app for online courses. Features include video streaming, progress tracking, quizzes, certificates, and offline mode. Integration with Stripe for payments.',
    client: {
      name: 'LearnHub Academy',
      rating: 4.8,
      projectsCompleted: 11,
      avgApprovalTime: '2 days',
    },
    budget: { min: 18000, max: 25000 },
    duration: 55,
    techStack: ['React Native', 'Node.js', 'MongoDB', 'AWS S3'],
    domain: 'Education',
    bidsCount: 14,
    requirements: 38,
    postedAt: '4 days ago',
    status: 'open' as const,
  },
];

const FreelancerBrowse: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedBudget, setSelectedBudget] = useState('all');
  const [bidAmount, setBidAmount] = useState('');
  const [bidDuration, setBidDuration] = useState('');
  const [bidProposal, setBidProposal] = useState('');
  const [selectedProject, setSelectedProject] = useState<typeof demoProjects[0] | null>(null);

  const handleSubmitBid = () => {
    toast({
      title: 'Bid Submitted!',
      description: 'Your proposal has been sent to the client.',
    });
    setSelectedProject(null);
    setBidAmount('');
    setBidDuration('');
    setBidProposal('');
  };

  const filteredProjects = demoProjects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || project.domain.toLowerCase() === selectedDomain;
    const matchesBudget = selectedBudget === 'all' ||
      (selectedBudget === 'low' && project.budget.max <= 15000) ||
      (selectedBudget === 'medium' && project.budget.max > 15000 && project.budget.max <= 25000) ||
      (selectedBudget === 'high' && project.budget.max > 25000);
    return matchesSearch && matchesDomain && matchesBudget;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Browse Projects</h1>
          <p className="text-muted-foreground mt-1">Find your next opportunity</p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by title, description, or tech stack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Budget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Budgets</SelectItem>
                    <SelectItem value="low">Under $15k</SelectItem>
                    <SelectItem value="medium">$15k - $25k</SelectItem>
                    <SelectItem value="high">Over $25k</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{filteredProjects.length} projects found</p>

          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Main Content */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold">{project.title}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{project.postedAt}</p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Bookmark className="h-5 w-5" />
                      </Button>
                    </div>

                    <p className="text-muted-foreground line-clamp-2">{project.description}</p>

                    {/* Tech Stack */}
                    <div className="flex flex-wrap gap-2">
                      {project.techStack.map((tech) => (
                        <Badge key={tech} variant="secondary">
                          {tech}
                        </Badge>
                      ))}
                    </div>

                    {/* Metrics */}
                    <div className="flex flex-wrap gap-6 text-sm">
                      <span className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-success" />
                        ${project.budget.min.toLocaleString()} - ${project.budget.max.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {project.duration} days
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {project.domain}
                      </span>
                      <span className="text-muted-foreground">
                        {project.requirements} requirements • {project.bidsCount} bids
                      </span>
                    </div>
                  </div>

                  {/* Client Info Sidebar */}
                  <div className="lg:w-64 p-4 rounded-lg bg-muted/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {project.client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{project.client.name}</p>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <span>{project.client.rating}</span>
                          <span className="text-muted-foreground">
                            ({project.client.projectsCompleted} projects)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Avg. approval: {project.client.avgApprovalTime}</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full" onClick={() => setSelectedProject(project)}>
                          Submit Bid
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Submit Your Bid</DialogTitle>
                          <DialogDescription>
                            {project.title}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="bid-amount">Bid Amount ($)</Label>
                              <Input
                                id="bid-amount"
                                type="number"
                                placeholder={project.budget.min.toString()}
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bid-duration">Duration (days)</Label>
                              <Input
                                id="bid-duration"
                                type="number"
                                placeholder={project.duration.toString()}
                                value={bidDuration}
                                onChange={(e) => setBidDuration(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bid-proposal">Your Proposal</Label>
                            <Textarea
                              id="bid-proposal"
                              placeholder="Describe your approach, relevant experience, and why you're the best fit for this project..."
                              rows={5}
                              value={bidProposal}
                              onChange={(e) => setBidProposal(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedProject(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSubmitBid}>Submit Bid</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default FreelancerBrowse;
