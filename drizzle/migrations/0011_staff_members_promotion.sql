CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.staff_add_member(_name text, _year text, _birth date, _phone text, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nid uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'الاسم مطلوب'; END IF;
  IF _birth IS NULL THEN RAISE EXCEPTION 'تاريخ الميلاد مطلوب'; END IF;
  IF _year NOT IN ('أولى إعدادي','ثانية إعدادي','ثالثة إعدادي') THEN RAISE EXCEPTION 'المرحلة غير صحيحة'; END IF;
  INSERT INTO public.profiles(id, full_name, academic_year, birth_date, phone, address, status, account_type)
  VALUES (nid, left(trim(_name),80), _year, _birth, nullif(left(trim(coalesce(_phone,'')),20),''), nullif(left(trim(coalesce(_address,'')),200),''), 'approved', 'member');
  RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_add_member(text,text,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.staff_add_member(text,text,date,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_member(_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _member = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك إزالة نفسك'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NOT public.is_servant(auth.uid()) OR public.has_role(_member,'admin')
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_member AND account_type='member') THEN
      RAISE EXCEPTION 'غير مصرح';
    END IF;
  END IF;
  IF public.is_owner(_member) THEN RAISE EXCEPTION 'لا يمكن إزالة المشرف المسؤول'; END IF;
  IF public.has_role(_member, 'admin') AND NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'إزالة مشرف تتطلب المشرف المسؤول'; END IF;
  DELETE FROM public.announcement_signups WHERE user_id = _member;
  DELETE FROM public.member_notifications WHERE user_id = _member;
  DELETE FROM public.quiz_answers WHERE user_id = _member;
  DELETE FROM public.quiz_attempts WHERE user_id = _member;
  DELETE FROM public.reading_completions WHERE user_id = _member;
  DELETE FROM public.suggestions WHERE user_id = _member;
  DELETE FROM public.visitations WHERE member_id = _member OR servant_id = _member;
  DELETE FROM public.servant_preparations WHERE user_id = _member;
  DELETE FROM public.servant_attendance WHERE servant_id = _member;
  DELETE FROM public.redemptions WHERE user_id = _member;
  DELETE FROM public.point_adjustments WHERE user_id = _member;
  DELETE FROM public.activity_logs WHERE user_id = _member;
  DELETE FROM public.admin_permissions WHERE user_id = _member;
  DELETE FROM public.user_roles WHERE user_id = _member;
  DELETE FROM public.profiles WHERE id = _member;
  DELETE FROM auth.users WHERE id = _member;
END $$;

CREATE OR REPLACE FUNCTION public.promote_academic_years()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles SET status='graduated' WHERE account_type='member' AND academic_year='ثالثة إعدادي' AND status<>'graduated';
  UPDATE public.profiles SET academic_year='ثالثة إعدادي' WHERE account_type='member' AND academic_year='ثانية إعدادي' AND status<>'graduated';
  UPDATE public.profiles SET academic_year='ثانية إعدادي' WHERE account_type='member' AND academic_year='أولى إعدادي' AND status<>'graduated';
END $$;
REVOKE EXECUTE ON FUNCTION public.promote_academic_years() FROM anon, authenticated, public;