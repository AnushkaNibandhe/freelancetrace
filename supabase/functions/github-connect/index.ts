import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    const { project_id, repo_url, repo_owner, repo_name } = await req.json();
    
    if (!project_id) {
      throw new Error('Missing project_id');
    }

    // Verify user is the awarded freelancer
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('awarded_freelancer_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    if (project.awarded_freelancer_id !== user.id) {
      throw new Error('Only the awarded freelancer can connect a repository');
    }

    // If repo details provided, link directly
    if (repo_url && repo_owner && repo_name) {
      const { data: repo, error: repoError } = await supabaseClient
        .from('github_repositories')
        .insert({
          project_id,
          repo_url,
          owner: repo_owner,
          repo_name,
          is_connected: true,
        })
        .select()
        .single();

      if (repoError) {
        throw repoError;
      }

      // Notify client about repo connection
      const { data: projectData } = await supabaseClient
        .from('projects')
        .select('client_id, title')
        .eq('id', project_id)
        .single();

      if (projectData?.client_id) {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: projectData.client_id,
            type: 'github_connected',
            title: 'GitHub Repository Connected',
            message: `A GitHub repository has been connected to ${projectData.title}`,
            data: {
              project_id,
              repo_url,
            },
          });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          repository: repo,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // For full OAuth flow, return instructions
    // This would normally redirect to GitHub OAuth
    return new Response(
      JSON.stringify({
        message: 'Please provide repo_url, repo_owner, and repo_name to link a repository',
        instructions: 'You can manually link a repository by providing the GitHub URL',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
