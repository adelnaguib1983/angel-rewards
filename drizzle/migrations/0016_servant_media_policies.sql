CREATE POLICY "servant_media_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'servant-media' AND public.is_servant(auth.uid()) AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "servant_media_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'servant-media' AND (public.is_servant(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.is_approved(auth.uid())));

CREATE POLICY "servant_media_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'servant-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "servant_media_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'servant-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'servant-media' AND (storage.foldername(name))[1] = auth.uid()::text);