ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone2 text, ADD COLUMN IF NOT EXISTS staff_notes text;
REVOKE SELECT (phone2, staff_notes) ON public.profiles FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.staff_get_extra(_id uuid)
RETURNS TABLE(phone2 text, staff_notes text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_servant(auth.uid())) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  RETURN QUERY SELECT p.phone2, p.staff_notes FROM public.profiles p WHERE p.id=_id;
END $$;
CREATE OR REPLACE FUNCTION public.staff_set_extra(_id uuid, _phone2 text, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text;
BEGIN
  SELECT account_type INTO t FROM public.profiles WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'غير موجود'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR (t='member' AND public.is_servant(auth.uid()))) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  UPDATE public.profiles SET phone2 = nullif(left(trim(coalesce(_phone2,'')),20),''), staff_notes = nullif(left(trim(coalesce(_notes,'')),1000),'') WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.staff_get_extra(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.staff_set_extra(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_get_extra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_set_extra(uuid,text,text) TO authenticated;