import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusType = 
  | 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
  | 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  | 'submitted' | 'approved' | 'disputed'
  | 'not_started' | 'fulfilled'
  | 'under_review' | 'resolved'
  | 'processing' | 'failed' | 'refunded';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-muted' },
  open: { label: 'Open', className: 'bg-info/10 text-info border-info/20' },
  in_progress: { label: 'In Progress', className: 'bg-warning/10 text-warning border-warning/20' },
  completed: { label: 'Completed', className: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground border-muted' },
  accepted: { label: 'Accepted', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  withdrawn: { label: 'Withdrawn', className: 'bg-muted text-muted-foreground border-muted' },
  submitted: { label: 'Submitted', className: 'bg-info/10 text-info border-info/20' },
  approved: { label: 'Approved', className: 'bg-success/10 text-success border-success/20' },
  disputed: { label: 'Disputed', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground border-muted' },
  fulfilled: { label: 'Fulfilled', className: 'bg-success/10 text-success border-success/20' },
  under_review: { label: 'Under Review', className: 'bg-warning/10 text-warning border-warning/20' },
  resolved: { label: 'Resolved', className: 'bg-success/10 text-success border-success/20' },
  processing: { label: 'Processing', className: 'bg-info/10 text-info border-info/20' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  refunded: { label: 'Refunded', className: 'bg-warning/10 text-warning border-warning/20' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };

  return (
    <Badge variant="outline" className={cn('font-medium', config.className, className)}>
      {config.label}
    </Badge>
  );
};
