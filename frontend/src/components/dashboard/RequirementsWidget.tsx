import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface Requirement {
  status: 'not_started' | 'in_progress' | 'fulfilled';
  priority: 'high' | 'medium' | 'low';
  [key: string]: unknown;
}

interface Project {
  id: number | string;
  requirements?: Requirement[];
  [key: string]: unknown;
}

interface RequirementsWidgetProps {
  project: Project;
  basePath?: string; // defaults to '/client/projects'
}

export const RequirementsWidget: React.FC<RequirementsWidgetProps> = ({
  project,
  basePath = '/client/projects',
}) => {
  const navigate = useNavigate();

  const requirements = project.requirements ?? [];
  const total = requirements.length;
  const fulfilled = requirements.filter((r) => r.status === 'fulfilled').length;
  const highPriority = requirements.filter((r) => r.priority === 'high').length;
  const progressPct = total > 0 ? Math.round((fulfilled / total) * 100) : 0;

  const handleClick = () => {
    navigate(`${basePath}/${project.id}?tab=requirements`);
  };

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View requirements for project`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Requirements
        </CardTitle>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {progressPct}%
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No requirements defined
          </p>
        ) : (
          <>
            {/* Progress bar */}
            <Progress value={progressPct} className="h-2" />

            {/* Stats row */}
            <div className="flex items-center justify-between text-sm">
              {/* Fulfilled count */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  <span className="font-medium text-foreground">{fulfilled}</span>
                  {' / '}
                  <span className="font-medium text-foreground">{total}</span>
                  {' fulfilled'}
                </span>
              </div>

              {/* High-priority count */}
              {highPriority > 0 && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{highPriority} high priority</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
