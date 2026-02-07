import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const techStackOptions = [
  'React', 'Vue.js', 'Angular', 'Next.js', 'Node.js', 'Python', 'Django', 'FastAPI',
  'Ruby on Rails', 'Go', 'Rust', 'Java', 'Spring Boot', 'PostgreSQL', 'MongoDB',
  'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'TypeScript', 'GraphQL',
];

const domainOptions = [
  'E-commerce', 'Healthcare', 'Fintech', 'Education', 'Social Media', 'Enterprise',
  'Gaming', 'IoT', 'AI/ML', 'Blockchain', 'Media', 'Travel', 'Real Estate', 'Other',
];

const CreateProject: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    domain: '',
    techStack: [] as string[],
    budgetMin: '',
    budgetMax: '',
    durationDays: '',
    visibility: 'public',
    srsFile: null as File | null,
  });

  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState('');

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTechStackToggle = (tech: string) => {
    setFormData((prev) => ({
      ...prev,
      techStack: prev.techStack.includes(tech)
        ? prev.techStack.filter((t) => t !== tech)
        : [...prev.techStack, tech],
    }));
  };

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements((prev) => [...prev, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, srsFile: file }));
      // Simulate SRS parsing
      toast({
        title: 'SRS Uploaded',
        description: 'Document will be analyzed for requirements extraction.',
      });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    toast({
      title: 'Project Created!',
      description: 'Your project is now live and accepting bids.',
    });
    navigate('/client/projects');
  };

  const isStep1Valid = formData.title && formData.description && formData.domain;
  const isStep2Valid = formData.techStack.length > 0 && formData.budgetMin && formData.budgetMax;
  const isStep3Valid = requirements.length > 0 || formData.srsFile;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground mt-1">
            Fill in the details to post your project and receive bids
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div className="flex items-center">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                    step >= s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                </div>
                <span className="ml-3 text-sm font-medium hidden sm:block">
                  {s === 1 && 'Basic Info'}
                  {s === 2 && 'Tech & Budget'}
                  {s === 3 && 'Requirements'}
                  {s === 4 && 'Review'}
                </span>
              </div>
              {s < 4 && <div className="flex-1 h-0.5 bg-muted mx-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell us about your project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., E-commerce Platform Development"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project requirements, goals, and expectations..."
                  rows={5}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain *</Label>
                <Select value={formData.domain} onValueChange={(v) => handleInputChange('domain', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domainOptions.map((domain) => (
                      <SelectItem key={domain} value={domain.toLowerCase()}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={formData.visibility} onValueChange={(v) => handleInputChange('visibility', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Anyone can bid</SelectItem>
                    <SelectItem value="private">Private - Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Tech & Budget */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Technology & Budget</CardTitle>
              <CardDescription>Specify technical requirements and budget range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Tech Stack *</Label>
                <div className="flex flex-wrap gap-2">
                  {techStackOptions.map((tech) => (
                    <Button
                      key={tech}
                      type="button"
                      variant={formData.techStack.includes(tech) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTechStackToggle(tech)}
                    >
                      {tech}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">Budget Min ($) *</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    placeholder="5000"
                    value={formData.budgetMin}
                    onChange={(e) => handleInputChange('budgetMin', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMax">Budget Max ($) *</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    placeholder="10000"
                    value={formData.budgetMax}
                    onChange={(e) => handleInputChange('budgetMax', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Expected Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="30"
                  value={formData.durationDays}
                  onChange={(e) => handleInputChange('durationDays', e.target.value)}
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!isStep2Valid}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Requirements */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>Define your project requirements or upload an SRS document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SRS Upload */}
              <div className="space-y-2">
                <Label>Upload SRS Document</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="srs-upload"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {formData.srsFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <span className="font-medium">{formData.srsFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData((prev) => ({ ...prev, srsFile: null }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="srs-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop or click to upload (PDF, DOC, DOCX)
                      </p>
                    </label>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or add manually</span>
                </div>
              </div>

              {/* Manual Requirements */}
              <div className="space-y-2">
                <Label>Requirements</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a requirement..."
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
                  />
                  <Button onClick={handleAddRequirement}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {requirements.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {requirements.map((req, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted"
                      >
                        <span className="flex-1 text-sm">{req}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRequirement(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setStep(4)} disabled={!isStep3Valid}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Submit</CardTitle>
              <CardDescription>Review your project details before posting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="font-medium mb-2">Basic Information</h4>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Title:</dt>
                      <dd className="font-medium">{formData.title}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Domain:</dt>
                      <dd className="font-medium capitalize">{formData.domain}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Visibility:</dt>
                      <dd className="font-medium capitalize">{formData.visibility}</dd>
                    </div>
                  </dl>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="font-medium mb-2">Tech & Budget</h4>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tech Stack:</dt>
                      <dd className="font-medium">{formData.techStack.join(', ')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Budget:</dt>
                      <dd className="font-medium">
                        ${parseInt(formData.budgetMin).toLocaleString()} - ${parseInt(formData.budgetMax).toLocaleString()}
                      </dd>
                    </div>
                    {formData.durationDays && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Duration:</dt>
                        <dd className="font-medium">{formData.durationDays} days</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="font-medium mb-2">Requirements</h4>
                  <p className="text-sm text-muted-foreground">
                    {formData.srsFile
                      ? `SRS Document: ${formData.srsFile.name}`
                      : `${requirements.length} requirements defined`}
                  </p>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Post Project
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default CreateProject;
