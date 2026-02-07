-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Commits viewable by project participants" ON public.commits;

CREATE POLICY "Commits viewable by project participants"
ON public.commits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = commits.project_id
    AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid())
  )
);