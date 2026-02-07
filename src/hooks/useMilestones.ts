import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useProjectMilestones = (projectId: string) => {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useContractMilestones = (contractId: string) => {
  return useQuery({
    queryKey: ['contract-milestones', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('contract_id', contractId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
};

export const usePendingMilestones = () => {
  const { user, profile } = useAuth();
  
  return useQuery({
    queryKey: ['pending-milestones', user?.id, profile?.role],
    queryFn: async () => {
      let query = supabase
        .from('milestones')
        .select(`
          *,
          contract:contracts(
            client_id, 
            freelancer_id,
            project:projects(title, client:profiles!projects_client_id_fkey(full_name))
          )
        `)
        .in('status', ['submitted', 'in_progress']);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter based on role
      return data?.filter(m => {
        if (profile?.role === 'client') {
          return m.contract?.client_id === user?.id && m.status === 'submitted';
        } else {
          return m.contract?.freelancer_id === user?.id;
        }
      }) || [];
    },
    enabled: !!user && !!profile,
  });
};

export const useSubmitMilestone = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const { data, error } = await supabase
        .from('milestones')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['pending-milestones'] });
      toast({
        title: 'Milestone Submitted',
        description: 'Waiting for client approval.',
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

export const useApproveMilestone = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const { data, error } = await supabase
        .from('milestones')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['pending-milestones'] });
      toast({
        title: 'Milestone Approved',
        description: 'Payment will be processed shortly.',
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

export const useDisputeMilestone = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ milestoneId, reason }: { milestoneId: string; reason: string }) => {
      // Update milestone status
      const { data: milestone, error: milestoneError } = await supabase
        .from('milestones')
        .update({ status: 'disputed' })
        .eq('id', milestoneId)
        .select('*, contract:contracts(client_id, freelancer_id, project_id)')
        .single();
      
      if (milestoneError) throw milestoneError;
      
      // Create dispute record
      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          project_id: milestone.contract?.project_id,
          milestone_id: milestoneId,
          opened_by: milestone.contract?.client_id,
          against: milestone.contract?.freelancer_id,
          reason,
          status: 'open',
        });
      
      if (disputeError) throw disputeError;
      
      return milestone;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['pending-milestones'] });
      toast({
        title: 'Dispute Opened',
        description: 'An admin will review your case.',
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
