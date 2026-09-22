import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/lib/api';

export const useProjectRequirements = (projectId: string) => {
  return useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      return apiJson(`/projects/${projectId}/requirements`);
    },
    enabled: !!projectId,
  });
};

export const useAddRequirement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      text,
      priority = 'medium',
      orderIndex,
    }: {
      projectId: string;
      text: string;
      priority?: string;
      orderIndex: number;
    }) => {
      return apiJson(`/projects/${projectId}/requirements`, {
        method: 'POST',
        body: JSON.stringify({
          requirement_text: text,
          priority,
          order_index: orderIndex,
          status: 'not_started',
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', data.project_id] });
      toast({
        title: 'Requirement Added',
        description: 'The requirement has been added to the project.',
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

export const useUpdateRequirement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      requirementId,
      updates,
    }: {
      requirementId: string;
      updates: Partial<{
        requirement_text: string;
        status: 'not_started' | 'in_progress' | 'fulfilled';
        priority: string;
        coverage_percentage: number;
      }>;
    }) => {
      return apiJson(`/requirements/${requirementId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', data.project_id] });
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

export const useDeleteRequirement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ requirementId }: { requirementId: string; projectId: string }) => {
      return apiJson(`/requirements/${requirementId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', data.project_id] });
      toast({
        title: 'Requirement Deleted',
        description: 'The requirement has been removed.',
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
