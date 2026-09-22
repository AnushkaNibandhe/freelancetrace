import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiJson, apiFetch } from '@/lib/api';

export interface CreateProjectData {
  title: string;
  description: string;
  domain: string;
  tech_stack: string[];
  budget_min: number;
  budget_max: number;
  duration_days?: number;
  visibility: string;
  srs_file_url?: string;
}

export const useProjects = (status?: string) => {
  const { user, isDemo } = useAuth();

  return useQuery({
    queryKey: ['projects', user?.id, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.set('status', status);
      }
      const query = params.toString();
      return apiJson(`/projects${query ? `?${query}` : ''}`);
    },
    enabled: !!user && !isDemo,
  });
};

export const useClientProjects = () => {
  const { user, isDemo } = useAuth();

  return useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      return apiJson(`/projects?client_id=${user!.id}`);
    },
    enabled: !!user && !isDemo,
  });
};

export const useFreelancerProjects = () => {
  const { user, isDemo } = useAuth();

  return useQuery({
    queryKey: ['freelancer-projects', user?.id],
    queryFn: async () => {
      return apiJson(`/projects?freelancer_id=${user!.id}&status=in_progress,completed`);
    },
    enabled: !!user && !isDemo,
  });
};

export const useOpenProjects = () => {
  return useQuery({
    queryKey: ['open-projects'],
    queryFn: async () => {
      return apiJson('/projects?status=open&visibility=public');
    },
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      return apiJson(`/projects/${projectId}`);
    },
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user, isDemo } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ project, requirements }: { project: CreateProjectData; requirements: string[] }) => {
      if (isDemo) {
        throw new Error('Demo mode: project creation is disabled.');
      }
      if (!user) {
        throw new Error('Not authenticated');
      }

      return apiJson('/projects', {
        method: 'POST',
        body: JSON.stringify({
          project,
          requirements,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      queryClient.invalidateQueries({ queryKey: ['open-projects'] });
      toast({
        title: 'Project Created!',
        description: 'Your project is now live and accepting bids.',
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

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDemo } = useAuth();

  return useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: string;
      updates: Partial<CreateProjectData & { status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' }>;
    }) => {
      if (isDemo) {
        throw new Error('Demo mode: updates are disabled.');
      }
      return apiJson(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      toast({
        title: 'Project Updated',
        description: 'Your changes have been saved.',
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

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDemo } = useAuth();

  return useMutation({
    mutationFn: async (projectId: string) => {
      if (isDemo) {
        throw new Error('Demo mode: deletes are disabled.');
      }
      await apiJson(`/projects/${projectId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      toast({
        title: 'Project Deleted',
        description: 'The project has been removed.',
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

export const useUploadSRS = () => {
  const { isDemo } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (isDemo) {
        return `demo://srs/${Date.now()}-${encodeURIComponent(file.name)}`;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch('/uploads/srs', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Upload failed');
      }
      return data.url as string;
    },
  });
};

export interface ExtractedRequirement {
  id?: number;
  text: string;
  priority: 'high' | 'medium' | 'low';
  status?: string;
}

export interface SRSUploadResult {
  message: string;
  requirements_extracted: number;
  pipeline: 'gemini' | 'spacy' | 'legacy';
  requirements: ExtractedRequirement[];
}

export const useUploadSRSToProject = () => {
  const queryClient = useQueryClient();
  const { isDemo } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }): Promise<SRSUploadResult> => {
      if (isDemo) {
        // Return mock data in demo mode
        return {
          message: 'Demo mode',
          requirements_extracted: 3,
          pipeline: 'gemini',
          requirements: [
            { text: 'The system shall support user authentication.', priority: 'high', status: 'not_started' },
            { text: 'The application must display a dashboard.', priority: 'medium', status: 'not_started' },
            { text: 'The system should provide export functionality.', priority: 'low', status: 'not_started' },
          ],
        };
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch(`/projects/${projectId}/upload_srs`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'SRS upload failed');
      }
      return data as SRSUploadResult;
    },
    onSuccess: (_data, variables) => {
      // Invalidate requirements so the detail page re-fetches
      queryClient.invalidateQueries({ queryKey: ['requirements', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
    },
  });
};
