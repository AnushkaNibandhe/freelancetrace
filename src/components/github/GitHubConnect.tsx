import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLinkRepository, useProjectRepository, useSyncCommits } from '@/hooks/useGitHub';
import { GitBranch, ExternalLink, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface GitHubConnectProps {
  projectId: string;
}

export const GitHubConnect: React.FC<GitHubConnectProps> = ({ projectId }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: repository, isLoading: loadingRepo } = useProjectRepository(projectId);
  const linkRepo = useLinkRepository();
  const syncCommits = useSyncCommits();

  const handleConnect = () => {
    if (!repoUrl.trim()) return;
    
    linkRepo.mutate(
      { projectId, repoUrl: repoUrl.trim() },
      {
        onSuccess: () => {
          setIsOpen(false);
          setRepoUrl('');
        },
      }
    );
  };

  if (loadingRepo) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading repository...</span>
      </div>
    );
  }

  if (repository) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitHub Repository
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{repository.owner}/{repository.repo_name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Connected
                {repository.last_sync_at && (
                  <span> • Last sync: {new Date(repository.last_sync_at).toLocaleDateString()}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncCommits.mutate(projectId)}
                disabled={syncCommits.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncCommits.isPending ? 'animate-spin' : ''}`} />
                {syncCommits.isPending ? 'Syncing...' : 'Sync Commits'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={repository.repo_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          GitHub Repository
        </CardTitle>
        <CardDescription>
          Connect your GitHub repository to track commits and progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <GitBranch className="mr-2 h-4 w-4" />
              Connect Repository
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect GitHub Repository</DialogTitle>
              <DialogDescription>
                Enter the URL of your GitHub repository to link it to this project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL</Label>
                <Input
                  id="repo-url"
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Make sure your repository is public, or you have configured access for the webhook.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConnect} 
                disabled={!repoUrl.trim() || linkRepo.isPending}
              >
                {linkRepo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
