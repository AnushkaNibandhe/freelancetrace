import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useClientPayments = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['client-payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          milestone:milestones(title, project:projects(title)),
          payee:profiles!payments_payee_id_fkey(full_name)
        `)
        .eq('payer_id', user!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useFreelancerPayments = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['freelancer-payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          milestone:milestones(title, project:projects(title, client:profiles!projects_client_id_fkey(full_name, organization_name)))
        `)
        .eq('payee_id', user!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const usePaymentStats = (role: 'client' | 'freelancer') => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['payment-stats', user?.id, role],
    queryFn: async () => {
      const column = role === 'client' ? 'payer_id' : 'payee_id';
      
      const { data: allPayments, error } = await supabase
        .from('payments')
        .select('amount, net_amount, platform_fee, status, paid_at')
        .eq(column, user!.id);
      
      if (error) throw error;
      
      const completed = allPayments?.filter(p => p.status === 'completed') || [];
      const pending = allPayments?.filter(p => p.status === 'pending') || [];
      const processing = allPayments?.filter(p => p.status === 'processing') || [];
      
      const totalAmount = completed.reduce((sum, p) => sum + (role === 'client' ? p.amount : p.net_amount), 0);
      const pendingAmount = pending.reduce((sum, p) => sum + (role === 'client' ? p.amount : p.net_amount), 0);
      const processingAmount = processing.reduce((sum, p) => sum + (role === 'client' ? p.amount : p.net_amount), 0);
      const platformFees = completed.reduce((sum, p) => sum + (p.platform_fee || 0), 0);
      
      // This month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const thisMonthPayments = completed.filter(p => 
        p.paid_at && new Date(p.paid_at) >= startOfMonth
      );
      const thisMonthAmount = thisMonthPayments.reduce((sum, p) => 
        sum + (role === 'client' ? p.amount : p.net_amount), 0
      );
      
      return {
        totalAmount,
        pendingAmount,
        processingAmount,
        platformFees,
        thisMonthAmount,
        completedCount: completed.length,
        pendingCount: pending.length,
      };
    },
    enabled: !!user,
  });
};

export const useInitiatePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { milestone_id: milestoneId },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Open Razorpay checkout
      if (data.order_id && (window as any).Razorpay) {
        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: 'FreelanceTrace',
          description: data.description,
          order_id: data.order_id,
          handler: function (response: any) {
            // Payment successful, webhook will handle the rest
            queryClient.invalidateQueries({ queryKey: ['client-payments'] });
            queryClient.invalidateQueries({ queryKey: ['freelancer-payments'] });
            toast({
              title: 'Payment Successful',
              description: 'The milestone payment has been processed.',
            });
          },
          prefill: {
            email: data.prefill?.email,
          },
          theme: {
            color: '#6366f1',
          },
        };
        
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    },
    onError: (error) => {
      toast({
        title: 'Payment Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
