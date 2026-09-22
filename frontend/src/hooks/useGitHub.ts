import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/lib/api';

export const useProjectRepository = (projectId: string) => {
  return useQuery({
    queryKey: ['github-repo', projectId],
    queryFn: async () => {
      return apiJson(`/projects/${projectId}/github`);
    },
    enabled: !!projectId,
  });
};

export const useProjectCommits = (projectId: string) => {
  return useQuery({
    queryKey: ['commits', projectId],
    queryFn: async () => {
      return apiJson(`/projects/${projectId}/commits`);
    },
    enabled: !!projectId,
  });
};

export const useGitHubRepos = () => {
  return useQuery({
    queryKey: ['github-repos'],
    queryFn: async () => {
      return apiJson('/github/repos');
    },
  });
};

export const useSyncCommits = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      return apiJson(`/projects/${projectId}/github/sync`, { method: 'POST' });
    },
    onSuccess: (data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['commits', projectId] });
      queryClient.invalidateQueries({ queryKey: ['github-repo', projectId] });
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
      queryClient.invalidateQueries({ queryKey: ['metrics', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({
        title: 'Commits Synced',
        description: `${data.synced} new commit(s) synced from GitHub.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useLinkRepository = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      repoFullName,
    }: {
      projectId: string;
      repoFullName: string;
    }) => {
      return apiJson(`/projects/${projectId}/github/link`, {
        method: 'POST',
        body: JSON.stringify({ repo_full_name: repoFullName }),
      });
    },
    onSuccess: (data) => {
      if (data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['github-repo', data.project_id] });
      }
      toast({
        title: 'Repository Linked',
        description: 'GitHub repository has been connected to the project.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useConnectGitHub = () => {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async () => {
      return apiJson('/github/oauth/url', {
        method: 'POST',
        body: JSON.stringify({ redirect_to: window.location.href }),
      });
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
