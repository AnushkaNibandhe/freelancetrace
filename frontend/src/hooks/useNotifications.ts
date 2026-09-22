import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDb } from '@/lib/mockDb';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user, isDemo } = useAuth();
  const queryClient = useQueryClient();
  
  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user || isDemo) return;
    
    const channel = mockDb
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-count', user.id] });
        }
      )
      .subscribe();
    
    return () => {
      mockDb.removeChannel(channel);
    };
  }, [user, queryClient]);
  
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await mockDb
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user && !isDemo,
  });
};

export const useUnreadCount = () => {
  const { user, isDemo } = useAuth();
  
  return useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      const { count, error } = await mockDb
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user && !isDemo,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { user, isDemo } = useAuth();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (isDemo) return;
      const { error } = await mockDb
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', user?.id] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  const { user, isDemo } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (isDemo) return;
      const { error } = await mockDb
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', user?.id] });
    },
  });
};
