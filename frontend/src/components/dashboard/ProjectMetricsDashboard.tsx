import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectMetrics } from '@/hooks/useProjectMetrics';
import { Shield, Clock, Target, AlertTriangle, FileCheck2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ProjectMetricsDashboardProps {
  projectId: string;
}

export const ProjectMetricsDashboard: React.FC<ProjectMetricsDashboardProps> = ({ projectId }) => {
  const { metrics, isLoading, error } = useProjectMetrics(projectId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>Failed to load AI metrics: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback defaults
  const data = metrics || {
    fulfillment_score: 0,
    drift_score: 0,
    delay_risk: 0,
    trust_score: 0,
    compliance_score: 0
  };

  // Safe formatting helpers
  const formatScore = (val: number) => Math.round(Number(val));

  return (
    <div className="space-y-6">
      
      {/* Top Level Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Fulfillment Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-medium">Fulfillment Confidence</CardTitle>
              <CardDescription>Requirements covered by code</CardDescription>
            </div>
            <Target className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
             <ProgressRing 
                progress={formatScore(data.fulfillment_score)} 
                size={80} 
                strokeWidth={8} 
              />
              <div>
                 <p className="text-sm text-balance">
                   NLP tracing shows {formatScore(data.fulfillment_score)}% of specifications are met in repository commits.
                 </p>
              </div>
          </CardContent>
        </Card>

        {/* Drift Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-medium">Requirement Drift</CardTitle>
              <CardDescription>Scope deviation risk</CardDescription>
            </div>
             <AlertTriangle className={`h-5 w-5 ${data.drift_score > 30 ? 'text-destructive' : 'text-primary'}`} />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
             <ProgressRing 
                progress={formatScore(data.drift_score)} 
                size={80} 
                strokeWidth={8} 
              />
              <div>
                 {data.drift_score > 30 ? (
                    <Badge variant="destructive">High Drift</Badge>
                 ) : (
                    <Badge variant="secondary">On Track</Badge>
                 )}
                 <p className="text-sm mt-2">
                   Commit semantics deviating from SRS by {formatScore(data.drift_score)}%.
                 </p>
              </div>
          </CardContent>
        </Card>

        {/* Delay Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-medium">Delay Risk</CardTitle>
              <CardDescription>Predicted timeline slip</CardDescription>
            </div>
            <Clock className={`h-5 w-5 ${data.delay_risk > 50 ? 'text-destructive' : 'text-primary'}`} />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
             <ProgressRing 
                progress={formatScore(data.delay_risk)} 
                size={80} 
                strokeWidth={8} 
              />
              <div>
                 <p className="text-sm text-balance">
                   Based on commit velocity vs deadline, delay probability is {formatScore(data.delay_risk)}%.
                 </p>
              </div>
          </CardContent>
        </Card>

        {/* Trust Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-medium">Developer Trust</CardTitle>
              <CardDescription>Reliability index</CardDescription>
            </div>
            <Shield className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
             <div className="text-4xl font-bold text-primary">
                {formatScore(data.trust_score)}
             </div>
             <div>
                <p className="text-sm text-muted-foreground">
                  Score based on consistent commits and low drift.
                </p>
             </div>
          </CardContent>
        </Card>

        {/* Compliance Readiness */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-medium">Compliance Readiness</CardTitle>
              <CardDescription>Traceability Matrix Health</CardDescription>
            </div>
            <FileCheck2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
             <ProgressRing 
                progress={formatScore(data.compliance_score)} 
                size={80} 
                strokeWidth={8} 
              />
              <div>
                 <p className="text-sm text-muted-foreground">
                   {formatScore(data.compliance_score)}% of requirements have semantic coverage proof.
                 </p>
              </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
