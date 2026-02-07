import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CreateBidData {
  project_id: string;
  amount: number;
  estimated_duration_days?: number;
  proposal?: string;
  milestone_breakdown?: any;
}

export const useProjectBids = (projectId: string) => {
  return useQuery({
    queryKey: ['bids', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          freelancer:profiles!bids_freelancer_id_fkey(
            id, full_name, avatar_url, trust_score, 
            skills, projects_completed, hourly_rate
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useFreelancerBids = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['freelancer-bids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          project:projects(
            id, title, status, budget_min, budget_max,
            client:profiles!projects_client_id_fkey(full_name, organization_name)
          )
        `)
        .eq('freelancer_id', user!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreateBid = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (bidData: CreateBidData) => {
      const { data, error } = await supabase
        .from('bids')
        .insert({
          ...bidData,
          freelancer_id: user!.id,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bids', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['freelancer-bids'] });
      queryClient.invalidateQueries({ queryKey: ['open-projects'] });
      toast({
        title: 'Bid Submitted!',
        description: 'Your proposal has been sent to the client.',
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

export const useAcceptBid = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ bidId, projectId }: { bidId: string; projectId: string }) => {
      // Update bid status to accepted
      const { data: bid, error: bidError } = await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bidId)
        .select('*, freelancer_id, amount')
        .single();
      
      if (bidError) throw bidError;
      
      // Reject all other bids for this project
      await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('project_id', projectId)
        .neq('id', bidId);
      
      // Update project with awarded freelancer
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          status: 'in_progress',
          awarded_freelancer_id: bid.freelancer_id,
          awarded_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      
      if (projectError) throw projectError;
      
      return bid;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bids', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      toast({
        title: 'Bid Accepted',
        description: 'The freelancer has been awarded the project.',
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

export const useRejectBid = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (bidId: string) => {
      const { data, error } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('id', bidId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bids', data.project_id] });
      toast({
        title: 'Bid Rejected',
        description: 'The bid has been declined.',
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

export const useWithdrawBid = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (bidId: string) => {
      const { error } = await supabase
        .from('bids')
        .delete()
        .eq('id', bidId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freelancer-bids'] });
      toast({
        title: 'Bid Withdrawn',
        description: 'Your bid has been removed.',
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
