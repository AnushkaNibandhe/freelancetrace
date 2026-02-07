import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
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

    const body = await req.text();
    const event = req.headers.get('x-github-event');
    
    console.log('GitHub webhook event:', event);

    const payload = JSON.parse(body);

    if (event === 'push') {
      const repoFullName = payload.repository?.full_name;
      const owner = payload.repository?.owner?.login;
      const repoName = payload.repository?.name;

      // Find the repository in our database
      const { data: repo, error: repoError } = await supabaseClient
        .from('github_repositories')
        .select('id, project_id')
        .eq('owner', owner)
        .eq('repo_name', repoName)
        .maybeSingle();

      if (repoError || !repo) {
        console.log('Repository not found in database:', repoFullName);
        return new Response(
          JSON.stringify({ message: 'Repository not linked' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Process commits
      const commits = payload.commits || [];
      const commitRecords = commits.map((commit: any) => ({
        repository_id: repo.id,
        project_id: repo.project_id,
        commit_hash: commit.id,
        message: commit.message,
        author: commit.author?.name || commit.author?.username,
        files_changed: [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])],
        additions: 0, // Would need API call to get this
        deletions: 0,
        committed_at: commit.timestamp,
      }));

      if (commitRecords.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('commits')
          .insert(commitRecords);

        if (insertError) {
          console.error('Error inserting commits:', insertError);
        } else {
          console.log(`Inserted ${commitRecords.length} commits for project ${repo.project_id}`);
        }

        // Update last_sync_at on repository
        await supabaseClient
          .from('github_repositories')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', repo.id);

        // Get project client for notification
        const { data: project } = await supabaseClient
          .from('projects')
          .select('client_id, title')
          .eq('id', repo.project_id)
          .single();

        if (project?.client_id) {
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: project.client_id,
              type: 'new_commits',
              title: 'New Commits',
              message: `${commitRecords.length} new commit(s) pushed to ${project.title}`,
              data: {
                project_id: repo.project_id,
                commit_count: commitRecords.length,
              },
            });
        }
      }
    } else if (event === 'installation') {
      // Handle GitHub App installation events
      console.log('Installation event:', payload.action);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
