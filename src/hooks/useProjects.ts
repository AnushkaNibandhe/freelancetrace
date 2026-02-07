import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CreateProjectData {
  title: string;
  description: string;
  domain: string;
  tech_stack: string[];
  budget_min: number;
  budget_max: number;
  duration_days?: number;
  visibility: string;
  srs_file_url?: string;
}

export interface CreateRequirementData {
  project_id: string;
  requirement_text: string;
  priority?: string;
  order_index: number;
}

export const useProjects = (status?: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['projects', user?.id, status],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          client:profiles!projects_client_id_fkey(id, full_name, avatar_url, trust_score),
          freelancer:profiles!projects_awarded_freelancer_id_fkey(id, full_name, avatar_url, trust_score),
          bids(count),
          requirements(count)
        `)
        .order('created_at', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status as 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useClientProjects = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          freelancer:profiles!projects_awarded_freelancer_id_fkey(id, full_name, avatar_url, trust_score),
          bids(count),
          requirements(id, status, coverage_percentage)
        `)
        .eq('client_id', user!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useFreelancerProjects = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['freelancer-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:profiles!projects_client_id_fkey(id, full_name, avatar_url, trust_score, organization_name),
          requirements(id, requirement_text, status, coverage_percentage, priority),
          github_repositories(*)
        `)
        .eq('awarded_freelancer_id', user!.id)
        .in('status', ['in_progress', 'completed'])
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useOpenProjects = () => {
  return useQuery({
    queryKey: ['open-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:profiles!projects_client_id_fkey(id, full_name, avatar_url, trust_score, projects_completed, organization_name),
          bids(count),
          requirements(count)
        `)
        .eq('status', 'open')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:profiles!projects_client_id_fkey(*),
          freelancer:profiles!projects_awarded_freelancer_id_fkey(*),
          requirements(*),
          bids(*, freelancer:profiles!bids_freelancer_id_fkey(*)),
          github_repositories(*)
        `)
        .eq('id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ project, requirements }: { project: CreateProjectData; requirements: string[] }) => {
      // Insert project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          ...project,
          client_id: user!.id,
          status: 'open',
        })
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      // Insert requirements if any
      if (requirements.length > 0) {
        const requirementsData = requirements.map((text, index) => ({
          project_id: newProject.id,
          requirement_text: text,
          order_index: index,
          priority: 'medium',
        }));
        
        const { error: reqError } = await supabase
          .from('requirements')
          .insert(requirementsData);
        
        if (reqError) throw reqError;
      }
      
      return newProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      queryClient.invalidateQueries({ queryKey: ['open-projects'] });
      toast({
        title: 'Project Created!',
        description: 'Your project is now live and accepting bids.',
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

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ projectId, updates }: { projectId: string; updates: Partial<CreateProjectData & { status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' }> }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      toast({
        title: 'Project Updated',
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

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      toast({
        title: 'Project Deleted',
        description: 'The project has been removed.',
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

export const useUploadSRS = () => {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('srs-documents')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('srs-documents')
        .getPublicUrl(fileName);
      
      return publicUrl;
    },
  });
};
