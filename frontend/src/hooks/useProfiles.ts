import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/lib/api';

export const useProfiles = (role?: string) => {
  return useQuery({
    queryKey: ['profiles', role],
    queryFn: async () => {
      const params = role && role !== 'all' ? `?role=${role}` : '';
      return apiJson<any[]>(`/admin/profiles${params}`);
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: { id: string; is_suspended?: boolean; is_verified?: boolean; role?: string }) => {
      const { id, ...body } = updates;
      return apiJson(`/admin/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({ title: 'Profile updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
};

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => apiJson<any>('/admin/stats'),
  });
};
