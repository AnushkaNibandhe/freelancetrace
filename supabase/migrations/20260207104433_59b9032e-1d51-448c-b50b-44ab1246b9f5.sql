
-- Allow project clients to update bid status (accept/reject)
CREATE POLICY "Clients can update bids on their projects"
ON public.bids
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = bids.project_id AND p.client_id = auth.uid()
  )
);
