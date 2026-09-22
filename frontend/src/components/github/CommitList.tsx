import React, { useState } from 'react';
import { useProjectCommits } from '@/hooks/useGitHub';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCommit, FileCode, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommitListProps {
  projectId: string;
  initialLimit?: number;
}

export const CommitList: React.FC<CommitListProps> = ({ projectId, initialLimit = 10 }) => {
  const { data: commits, isLoading } = useProjectCommits(projectId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const allCommits = commits || [];
  const displayCommits = showAll ? allCommits : allCommits.slice(0, initialLimit);
  const hasMore = allCommits.length > initialLimit;

  if (allCommits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commits</CardTitle>
          <CardDescription>No commits yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <GitCommit className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Commits will appear here once you push to the repository</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          Commits
        </CardTitle>
        <CardDescription>
          {showAll ? allCommits.length : Math.min(initialLimit, allCommits.length)} of {allCommits.length} commits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayCommits.map((commit) => (
            <div key={commit.id} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-xs font-mono text-primary flex-shrink-0">
                {commit.commit_hash.slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{commit.message}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{commit.author}</span>
                  {commit.committed_at && (
                    <span>{formatDistanceToNow(new Date(commit.committed_at), { addSuffix: true })}</span>
                  )}
                </div>
                {commit.files_changed && commit.files_changed.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <FileCode className="h-3 w-3" />
                    <span>{commit.files_changed.length} files changed</span>
                    {commit.additions > 0 && (
                      <span className="flex items-center gap-0.5 text-success">
                        <Plus className="h-3 w-3" />
                        {commit.additions}
                      </span>
                    )}
                    {commit.deletions > 0 && (
                      <span className="flex items-center gap-0.5 text-destructive">
                        <Minus className="h-3 w-3" />
                        {commit.deletions}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? (
                <><ChevronUp className="mr-2 h-4 w-4" /> Show less</>
              ) : (
                <><ChevronDown className="mr-2 h-4 w-4" /> Show {allCommits.length - initialLimit} more commits</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
