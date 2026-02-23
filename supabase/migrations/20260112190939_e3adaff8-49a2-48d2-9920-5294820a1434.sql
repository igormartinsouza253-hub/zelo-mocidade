-- Enable realtime for visitas table
ALTER TABLE public.visitas REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.visitas;