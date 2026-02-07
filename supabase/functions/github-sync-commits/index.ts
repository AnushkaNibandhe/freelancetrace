import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get the linked repository
    const { data: repo, error: repoError } = await supabaseClient
      .from('github_repositories')
      .select('*')
      .eq('project_id', project_id)
      .maybeSingle();

    if (repoError || !repo) {
      return new Response(JSON.stringify({ error: 'No repository linked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Fetch commits from GitHub API (works for public repos without auth)
    const githubUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo_name}/commits?per_page=50`;
    console.log('Fetching commits from:', githubUrl);

    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'FreelanceTrace',
    };
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const ghResponse = await fetch(githubUrl, { headers });

    if (!ghResponse.ok) {
      const errorText = await ghResponse.text();
      console.error('GitHub API error:', ghResponse.status, errorText);
      return new Response(JSON.stringify({ error: `GitHub API error: ${ghResponse.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    const ghCommits = await ghResponse.json();

    // Get existing commit hashes to avoid duplicates
    const { data: existingCommits } = await supabaseClient
      .from('commits')
      .select('commit_hash')
      .eq('project_id', project_id);

    const existingHashes = new Set((existingCommits || []).map((c: any) => c.commit_hash));

    const newCommits = ghCommits
      .filter((c: any) => !existingHashes.has(c.sha))
      .map((c: any) => ({
        repository_id: repo.id,
        project_id: project_id,
        commit_hash: c.sha,
        message: c.commit?.message || '',
        author: c.commit?.author?.name || c.author?.login || 'Unknown',
        committed_at: c.commit?.author?.date || new Date().toISOString(),
        additions: c.stats?.additions || 0,
        deletions: c.stats?.deletions || 0,
        files_changed: [],
      }));

    let insertedCount = 0;
    if (newCommits.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('commits')
        .insert(newCommits);

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      insertedCount = newCommits.length;
    }

    // Update last_sync_at
    await supabaseClient
      .from('github_repositories')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', repo.id);

    console.log(`Synced ${insertedCount} new commits for project ${project_id}`);

    return new Response(
      JSON.stringify({ synced: insertedCount, total_from_github: ghCommits.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Sync error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
