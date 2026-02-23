ALTER POLICY "Users can view their own profile" ON public.profiles
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));