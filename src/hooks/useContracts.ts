import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CreateContractData {
  project_id: string;
  bid_id: string;
  freelancer_id: string;
  total_amount: number;
  start_date?: string;
  expected_end_date?: string;
  terms?: string;
  milestones?: {
    title: string;
    description?: string;
    amount: number;
    due_date?: string;
  }[];
}

export const useProjectContract = (projectId: string) => {
  return useQuery({
    queryKey: ['contract', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          client:profiles!contracts_client_id_fkey(id, full_name, avatar_url),
          freelancer:profiles!contracts_freelancer_id_fkey(id, full_name, avatar_url),
          milestones(*)
        `)
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useUserContracts = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-contracts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          project:projects(id, title, status),
          client:profiles!contracts_client_id_fkey(full_name, avatar_url),
          freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url),
          milestones(id, title, status, amount)
        `)
        .or(`client_id.eq.${user!.id},freelancer_id.eq.${user!.id}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreateContract = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (contractData: CreateContractData) => {
      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          project_id: contractData.project_id,
          bid_id: contractData.bid_id,
          client_id: user!.id,
          freelancer_id: contractData.freelancer_id,
          total_amount: contractData.total_amount,
          start_date: contractData.start_date,
          expected_end_date: contractData.expected_end_date,
          terms: contractData.terms,
          is_active: true,
        })
        .select()
        .single();
      
      if (contractError) throw contractError;
      
      // Create milestones if provided
      if (contractData.milestones && contractData.milestones.length > 0) {
        const milestonesData = contractData.milestones.map((m, index) => ({
          contract_id: contract.id,
          project_id: contractData.project_id,
          title: m.title,
          description: m.description,
          amount: m.amount,
          due_date: m.due_date,
          order_index: index,
          status: (index === 0 ? 'in_progress' : 'pending') as 'pending' | 'in_progress',
        }));
        
        const { error: milestoneError } = await supabase
          .from('milestones')
          .insert(milestonesData);
        
        if (milestoneError) throw milestoneError;
      }
      
      return contract;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['user-contracts'] });
      toast({
        title: 'Contract Created',
        description: 'The project contract has been established.',
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
