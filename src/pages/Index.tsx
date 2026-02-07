import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  GitBranch,
  Shield,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowRight,
  Code,
  FileText,
  Users,
  CreditCard,
} from 'lucide-react';

const Index: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user && profile) {
      const dashboardPath = 
        profile.role === 'admin' ? '/admin/dashboard' :
        profile.role === 'client' ? '/client/dashboard' :
        '/freelancer/dashboard';
      navigate(dashboardPath);
    } else {
      navigate('/auth');
    }
  };

  const features = [
    {
      icon: FileText,
      title: 'SRS-Driven Tracking',
      description: 'Upload your Software Requirements Specification and automatically track fulfillment against every commit.',
    },
    {
      icon: GitBranch,
      title: 'GitHub Integration',
      description: 'Connect repositories and get real-time traceability between requirements and code changes.',
    },
    {
      icon: BarChart3,
      title: 'Progress Analytics',
      description: 'View objective metrics: fulfillment scores, drift detection, delay risk, and compliance readiness.',
    },
    {
      icon: Shield,
      title: 'Dispute Prevention',
      description: 'Evidence-backed milestones reduce disputes by 95%. Pay with confidence based on actual progress.',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Projects Tracked' },
    { value: '95%', label: 'Dispute Reduction' },
    { value: '$2.5M+', label: 'Paid to Freelancers' },
    { value: '4.9/5', label: 'Average Rating' },
  ];

  const workflowSteps = [
    { icon: FileText, title: 'Upload SRS', description: 'Client uploads project requirements' },
    { icon: Users, title: 'Get Bids', description: 'Freelancers submit proposals with milestones' },
    { icon: Code, title: 'Track Progress', description: 'Commits linked to requirements in real-time' },
    { icon: CreditCard, title: 'Pay Securely', description: 'Evidence-backed milestone approvals' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">FreelanceTrace</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Button onClick={handleGetStarted}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Zap className="h-4 w-4" />
              Evidence-Backed Freelance Collaboration
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Connect Requirements to Code.{' '}
              <span className="gradient-text">Pay with Confidence.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              FreelanceTrace bridges the gap between what's promised and what's delivered. 
              Track every commit against your SRS. Get objective progress metrics. Eliminate disputes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetStarted} className="text-lg px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why FreelanceTrace?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Traditional freelance platforms give you chat and file uploads. 
              We give you engineering-grade traceability.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">Four simple steps to evidence-backed collaboration</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="relative text-center">
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="absolute top-8 left-[60%] hidden md:block w-[80%] h-0.5 bg-border last:hidden" 
                  style={{ display: index === 3 ? 'none' : undefined }} />
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <Card className="gradient-primary overflow-hidden">
            <CardContent className="p-12 text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Ready to Transform Your Freelance Workflow?
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">
                Join thousands of clients and freelancers who trust FreelanceTrace for transparent, evidence-backed collaboration.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" onClick={handleGetStarted} className="text-lg px-8">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 text-white/70 text-sm">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  14-day free trial
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Cancel anytime
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">FreelanceTrace</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 FreelanceTrace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
