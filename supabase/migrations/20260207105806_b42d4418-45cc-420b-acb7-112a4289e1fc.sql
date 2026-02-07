-- Enable realtime for commits table so UI updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.commits;