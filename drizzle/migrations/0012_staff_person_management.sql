CREATE OR REPLACE FUNCTION public.admin_add_servant(_name text, _birth date, _phone text, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nid uuid := gen_random_uuid();
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'الاسم مطلوب'; END IF;
  IF _birth IS NULL THEN RAISE EXCEPTION 'تاريخ الميلاد مطلوب'; END IF;
  IF coalesce(trim(_phone),'') = '' THEN RAISE EXCEPTION 'رقم الموبايل مطلوب'; END IF;
  IF coalesce(trim(_address),'') = '' THEN RAISE EXCEPTION 'العنوان مطلوب'; END IF;
  INSERT INTO public.profiles(id, full_name, birth_date, phone, address, status, account_type)
  VALUES (nid, left(trim(_name),80), _birth, left(trim(_phone),20), left(trim(_address),200), 'approved', 'servant');
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.staff_update_person(_id uuid, _name text, _year text, _birth date, _phone text, _address text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text;
BEGIN
  SELECT account_type INTO t FROM public.profiles WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'غير موجود'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR (t='member' AND public.is_servant(auth.uid()))) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'الاسم مطلوب'; END IF;
  IF _year IS NOT NULL AND _year <> '' AND _year NOT IN ('أولى إعدادي','ثانية إعدادي','ثالثة إعدادي') THEN RAISE EXCEPTION 'المرحلة غير صحيحة'; END IF;
  UPDATE public.profiles SET
    full_name = left(trim(_name),80),
    academic_year = CASE WHEN coalesce(_year,'')='' THEN academic_year ELSE _year END,
    birth_date = coalesce(_birth, birth_date),
    phone = CASE WHEN coalesce(trim(_phone),'')='' THEN phone ELSE left(trim(_phone),20) END,
    address = CASE WHEN coalesce(trim(_address),'')='' THEN address ELSE left(trim(_address),200) END
  WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_servants()
RETURNS TABLE(id uuid, full_name text, status text, birth_date date, created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.status, p.birth_date, p.created_at FROM public.profiles p WHERE p.account_type='servant' ORDER BY p.full_name;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_add_servant(text,date,text,text), public.staff_update_person(uuid,text,text,date,text,text), public.admin_servants() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_add_servant(text,date,text,text), public.staff_update_person(uuid,text,text,date,text,text), public.admin_servants() TO authenticated;