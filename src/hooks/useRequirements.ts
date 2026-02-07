import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProjectRequirements = (projectId: string) => {
  return useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
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
      orderIndex 
    }: { 
      projectId: string; 
      text: string;
      priority?: string;
      orderIndex: number;
    }) => {
      const { data, error } = await supabase
        .from('requirements')
        .insert({
          project_id: projectId,
          requirement_text: text,
          priority,
          order_index: orderIndex,
          status: 'not_started',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
      updates 
    }: { 
      requirementId: string; 
      updates: Partial<{
        requirement_text: string;
        status: 'not_started' | 'in_progress' | 'fulfilled';
        priority: string;
        coverage_percentage: number;
      }>;
    }) => {
      const { data, error } = await supabase
        .from('requirements')
        .update(updates)
        .eq('id', requirementId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
    mutationFn: async ({ requirementId, projectId }: { requirementId: string; projectId: string }) => {
      const { error } = await supabase
        .from('requirements')
        .delete()
        .eq('id', requirementId);
      
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', data.projectId] });
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
