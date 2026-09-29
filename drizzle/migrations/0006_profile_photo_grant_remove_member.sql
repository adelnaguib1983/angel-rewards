GRANT SELECT (photo_url) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_member(_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF _member = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك إزالة نفسك'; END IF;
  IF public.is_owner(_member) THEN RAISE EXCEPTION 'لا يمكن إزالة المشرف المسؤول'; END IF;
  IF public.has_role(_member, 'admin') AND NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'إزالة مشرف تتطلب المشرف المسؤول'; END IF;
  DELETE FROM public.announcement_signups WHERE user_id = _member;
  DELETE FROM public.member_notifications WHERE user_id = _member;
  DELETE FROM public.quiz_attempts WHERE user_id = _member;
  DELETE FROM public.redemptions WHERE user_id = _member;
  DELETE FROM public.point_adjustments WHERE user_id = _member;
  DELETE FROM public.activity_logs WHERE user_id = _member;
  DELETE FROM public.admin_permissions WHERE user_id = _member;
  DELETE FROM public.user_roles WHERE user_id = _member;
  DELETE FROM public.profiles WHERE id = _member;
  DELETE FROM auth.users WHERE id = _member;
END $$;
REVOKE ALL ON FUNCTION public.admin_remove_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_member(uuid) TO authenticated;