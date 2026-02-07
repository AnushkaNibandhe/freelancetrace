import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useProfiles = (role?: string) => {
  return useQuery({
    queryKey: ['profiles', role],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (role && role !== 'all') {
        query = query.eq('role', role as 'client' | 'freelancer' | 'admin');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useProfile = (userId: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (updates: Partial<{
      full_name: string;
      bio: string;
      skills: string[];
      tech_stack: string[];
      hourly_rate: number;
      github_username: string;
      portfolio_url: string;
      organization_name: string;
    }>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user!.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({
        title: 'Profile Updated',
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

export const useSuspendUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_suspended: suspend })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', data.id] });
      toast({
        title: data.is_suspended ? 'User Suspended' : 'User Reinstated',
        description: data.is_suspended 
          ? 'The user can no longer access the platform.' 
          : 'The user can now access the platform again.',
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

export const useVerifyUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', data.id] });
      toast({
        title: 'User Verified',
        description: 'The user has been verified.',
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

export const useProfileStats = () => {
  return useQuery({
    queryKey: ['profile-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_verified, is_suspended, created_at');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const clients = data?.filter(p => p.role === 'client').length || 0;
      const freelancers = data?.filter(p => p.role === 'freelancer').length || 0;
      const admins = data?.filter(p => p.role === 'admin').length || 0;
      const verified = data?.filter(p => p.is_verified).length || 0;
      const suspended = data?.filter(p => p.is_suspended).length || 0;
      
      // New users this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const newThisMonth = data?.filter(p => 
        new Date(p.created_at!) >= startOfMonth
      ).length || 0;
      
      return { total, clients, freelancers, admins, verified, suspended, newThisMonth };
    },
  });
};
