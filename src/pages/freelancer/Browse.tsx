import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenProjects } from '@/hooks/useProjects';
import { useCreateBid } from '@/hooks/useBids';
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

const FreelancerBrowse: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedBudget, setSelectedBudget] = useState('all');
  const [bidAmount, setBidAmount] = useState('');
  const [bidDuration, setBidDuration] = useState('');
  const [bidProposal, setBidProposal] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: projects, isLoading } = useOpenProjects();
  const createBid = useCreateBid();

  const handleSubmitBid = () => {
    if (!selectedProject) return;
    
    createBid.mutate(
      {
        project_id: selectedProject.id,
        amount: parseFloat(bidAmount),
        estimated_duration_days: bidDuration ? parseInt(bidDuration) : undefined,
        proposal: bidProposal,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setBidAmount('');
          setBidDuration('');
          setBidProposal('');
          setSelectedProject(null);
        },
      }
    );
  };

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || project.domain?.toLowerCase() === selectedDomain;
    const matchesBudget = selectedBudget === 'all' ||
      (selectedBudget === 'low' && (project.budget_max || 0) <= 15000) ||
      (selectedBudget === 'medium' && (project.budget_max || 0) > 15000 && (project.budget_max || 0) <= 25000) ||
      (selectedBudget === 'high' && (project.budget_max || 0) > 25000);
    return matchesSearch && matchesDomain && matchesBudget;
  }) || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
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
                    <SelectItem value="e-commerce">E-commerce</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="fintech">Fintech</SelectItem>
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

          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No projects match your criteria</p>
              </CardContent>
            </Card>
          ) : (
            filteredProjects.map((project) => {
              const bidsCount = (project.bids as any)?.[0]?.count || 0;
              const requirementsCount = (project.requirements as any)?.[0]?.count || 0;
              
              return (
                <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Main Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-semibold">{project.title}</h3>
                              <StatusBadge status={project.status || 'open'} />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Posted {new Date(project.created_at!).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Bookmark className="h-5 w-5" />
                          </Button>
                        </div>

                        <p className="text-muted-foreground line-clamp-2">{project.description}</p>

                        {/* Tech Stack */}
                        <div className="flex flex-wrap gap-2">
                          {project.tech_stack?.map((tech) => (
                            <Badge key={tech} variant="secondary">
                              {tech}
                            </Badge>
                          ))}
                        </div>

                        {/* Metrics */}
                        <div className="flex flex-wrap gap-6 text-sm">
                          <span className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-success" />
                            ${project.budget_min?.toLocaleString() || 0} - ${project.budget_max?.toLocaleString() || 0}
                          </span>
                          {project.duration_days && (
                            <span className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {project.duration_days} days
                            </span>
                          )}
                          {project.domain && (
                            <span className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {project.domain}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {requirementsCount} requirements • {bidsCount} bids
                          </span>
                        </div>
                      </div>

                      {/* Client Info Sidebar */}
                      <div className="lg:w-64 p-4 rounded-lg bg-muted/50 space-y-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {project.client?.organization_name?.charAt(0) || project.client?.full_name?.charAt(0) || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {project.client?.organization_name || project.client?.full_name || 'Client'}
                            </p>
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              <span>{project.client?.trust_score || 0}</span>
                              <span className="text-muted-foreground">
                                ({project.client?.projects_completed || 0} projects)
                              </span>
                            </div>
                          </div>
                        </div>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              className="w-full" 
                              onClick={() => setSelectedProject(project)}
                            >
                              Submit Bid
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Submit Your Bid</DialogTitle>
                              <DialogDescription>
                                {selectedProject?.title}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="bid-amount">Bid Amount ($)</Label>
                                  <Input
                                    id="bid-amount"
                                    type="number"
                                    placeholder={selectedProject?.budget_min?.toString() || '0'}
                                    value={bidAmount}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="bid-duration">Duration (days)</Label>
                                  <Input
                                    id="bid-duration"
                                    type="number"
                                    placeholder={selectedProject?.duration_days?.toString() || '30'}
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
                              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleSubmitBid}
                                disabled={!bidAmount || createBid.isPending}
                              >
                                {createBid.isPending ? 'Submitting...' : 'Submit Bid'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default FreelancerBrowse;
