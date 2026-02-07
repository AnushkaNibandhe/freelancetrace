import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProjectRepository = (projectId: string) => {
  return useQuery({
    queryKey: ['github-repo', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('github_repositories')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useProjectCommits = (projectId: string) => {
  return useQuery({
    queryKey: ['commits', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commits')
        .select('*')
        .eq('project_id', projectId)
        .order('committed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useLinkRepository = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      repoUrl 
    }: { 
      projectId: string; 
      repoUrl: string;
    }) => {
      // Parse repo URL to extract owner and name
      const urlParts = repoUrl.replace('https://github.com/', '').split('/');
      const owner = urlParts[0];
      const repoName = urlParts[1]?.replace('.git', '');
      
      if (!owner || !repoName) {
        throw new Error('Invalid GitHub repository URL');
      }
      
      const { data, error } = await supabase
        .from('github_repositories')
        .insert({
          project_id: projectId,
          repo_url: repoUrl,
          owner,
          repo_name: repoName,
          is_connected: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['github-repo', data.project_id] });
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
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('github-connect', {
        body: { project_id: projectId },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Redirect to GitHub OAuth
      if (data.auth_url) {
        window.location.href = data.auth_url;
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
