import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  className,
  showLabel = true,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const getColor = (value: number) => {
    if (value >= 80) return 'stroke-success';
    if (value >= 50) return 'stroke-warning';
    return 'stroke-destructive';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-500 ease-out', getColor(progress))}
        />
      </svg>
      {showLabel && (
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold">{Math.round(progress)}%</span>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
};
