-- Create notifications table for real-time notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT USING (user_id = auth.uid());

-- RLS: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- RLS: System/edge functions can insert notifications (using service role)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create storage bucket for SRS documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('srs-documents', 'srs-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for SRS documents
CREATE POLICY "Clients can upload SRS documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'srs-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients can view own SRS documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'srs-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Project participants can view SRS documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'srs-documents'
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.srs_file_url LIKE '%' || name || '%'
    AND (p.client_id = auth.uid() OR p.awarded_freelancer_id = auth.uid())
  )
);