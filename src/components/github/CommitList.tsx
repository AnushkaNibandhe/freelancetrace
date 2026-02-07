import React from 'react';
import { useProjectCommits } from '@/hooks/useGitHub';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCommit, FileCode, Plus, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommitListProps {
  projectId: string;
  limit?: number;
}

export const CommitList: React.FC<CommitListProps> = ({ projectId, limit = 10 }) => {
  const { data: commits, isLoading } = useProjectCommits(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Commits</CardTitle>
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

  const displayCommits = commits?.slice(0, limit) || [];

  if (displayCommits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Commits</CardTitle>
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
          Recent Commits
        </CardTitle>
        <CardDescription>{commits?.length || 0} total commits</CardDescription>
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
      </CardContent>
    </Card>
  );
};
