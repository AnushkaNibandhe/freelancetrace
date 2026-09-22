import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/lib/api';

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
      return apiJson(`/projects/${projectId}/bids`);
    },
    enabled: !!projectId,
  });
};

export const useFreelancerBids = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['freelancer-bids', user?.id],
    queryFn: async () => {
      return apiJson(`/bids?freelancer_id=${user!.id}`);
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
      if (!user) {
        throw new Error('Not authenticated');
      }
      return apiJson(`/projects/${bidData.project_id}/bids`, {
        method: 'POST',
        body: JSON.stringify({
          amount: bidData.amount,
          estimated_duration_days: bidData.estimated_duration_days,
          proposal: bidData.proposal,
          milestone_breakdown: bidData.milestone_breakdown,
        }),
      });
    },
    onSuccess: (data) => {
      if (data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['bids', data.project_id] });
      }
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
      return apiJson(`/bids/${bidId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted' }),
      });
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
      return apiJson(`/bids/${bidId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' }),
      });
    },
    onSuccess: (data) => {
      if (data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['bids', data.project_id] });
      }
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
      await apiJson(`/bids/${bidId}`, { method: 'DELETE' });
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
