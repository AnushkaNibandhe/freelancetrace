import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useDisputes = (status?: string) => {
  return useQuery({
    queryKey: ['disputes', status],
    queryFn: async () => {
      let query = supabase
        .from('disputes')
        .select(`
          *,
          opener:profiles!disputes_opened_by_fkey(id, full_name, avatar_url, email),
          defendant:profiles!disputes_against_fkey(id, full_name, avatar_url, email),
          project:projects(id, title),
          milestone:milestones(id, title, amount)
        `)
        .order('created_at', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status as 'open' | 'under_review' | 'resolved');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useUserDisputes = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-disputes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          opener:profiles!disputes_opened_by_fkey(id, full_name),
          defendant:profiles!disputes_against_fkey(id, full_name),
          project:projects(id, title),
          milestone:milestones(id, title, amount)
        `)
        .or(`opened_by.eq.${user!.id},against.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useDispute = (disputeId: string) => {
  return useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          opener:profiles!disputes_opened_by_fkey(*),
          defendant:profiles!disputes_against_fkey(*),
          project:projects(*),
          milestone:milestones(*)
        `)
        .eq('id', disputeId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!disputeId,
  });
};

export const useUpdateDispute = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (updates: { 
      id: string; 
      status?: 'open' | 'under_review' | 'resolved';
      resolution?: string;
      resolved_by?: string;
      resolved_at?: string;
    }) => {
      const { id, ...updateData } = updates;
      const { data, error } = await supabase
        .from('disputes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['user-disputes'] });
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

export const useResolveDispute = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      disputeId, 
      resolution, 
      refundAmount 
    }: { 
      disputeId: string; 
      resolution: string;
      refundAmount?: number;
    }) => {
      const { data, error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution,
          resolved_by: user!.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId)
        .select()
        .single();
      
      if (error) throw error;
      
      // If there's a milestone, update its status based on resolution
      if (data.milestone_id) {
        await supabase
          .from('milestones')
          .update({ status: 'approved' })
          .eq('id', data.milestone_id);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['user-disputes'] });
      toast({
        title: 'Dispute Resolved',
        description: 'The dispute has been closed.',
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

export const useDisputeStats = () => {
  return useQuery({
    queryKey: ['dispute-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('status');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const open = data?.filter(d => d.status === 'open').length || 0;
      const underReview = data?.filter(d => d.status === 'under_review').length || 0;
      const resolved = data?.filter(d => d.status === 'resolved').length || 0;
      
      return { total, open, underReview, resolved };
    },
  });
};
