import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConnectGitHub, useGitHubRepos, useLinkRepository, useProjectRepository, useSyncCommits } from '@/hooks/useGitHub';
import { GitBranch, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GitHubConnectProps {
  projectId: string;
}

export const GitHubConnect: React.FC<GitHubConnectProps> = ({ projectId }) => {
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: repository, isLoading: loadingRepo } = useProjectRepository(projectId);
  const { data: repos } = useGitHubRepos();
  const connectGitHub = useConnectGitHub();
  const linkRepo = useLinkRepository();
  const syncCommits = useSyncCommits();

  const handleConnect = () => {
    if (!selectedRepo) return;

    linkRepo.mutate(
      { projectId, repoFullName: selectedRepo },
      {
        onSuccess: () => {
          setIsOpen(false);
          setSelectedRepo('');
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
        {repository ? (
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
                {syncCommits.isPending ? 'Syncing...' : 'Sync'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                Change Repo
              </Button>
            </div>
          </div>
        ) : (
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
                  Sign in with GitHub and select a repository to link.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>GitHub Account</Label>
                  {repos ? (
                    <div className="flex items-center gap-2 text-success text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> Connected
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => connectGitHub.mutate()}
                      disabled={connectGitHub.isPending}
                    >
                      {connectGitHub.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {connectGitHub.isPending ? 'Redirecting...' : 'Connect GitHub'}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Repository</Label>
                  <Input 
                    value={selectedRepo} 
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    placeholder="owner/repo (e.g. myorg/myrepo)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={!selectedRepo || linkRepo.isPending}
                >
                  {linkRepo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Change dialog for already connected repo */}
        {repository && isOpen && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Connected Repository</DialogTitle>
                <DialogDescription>
                  Select a new repository to link to this project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Repository</Label>
                  <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {(repos || []).map((repo: any) => (
                        <SelectItem key={repo.full_name} value={repo.full_name}>
                          {repo.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={!selectedRepo || linkRepo.isPending}
                >
                  {linkRepo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};
