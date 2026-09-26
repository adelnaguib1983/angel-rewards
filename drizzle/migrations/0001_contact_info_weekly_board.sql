ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

CREATE OR REPLACE FUNCTION public.update_my_contact(_name text, _academic_year text, _birth_date date, _phone text, _address text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET full_name = left(coalesce(nullif(trim(_name),''), full_name),80),
    academic_year = left(_academic_year,40), birth_date = _birth_date,
    phone = left(_phone,20), address = left(_address,200)
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first boolean; bd date;
BEGIN
  first := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin');
  BEGIN bd := nullif(NEW.raw_user_meta_data->>'birth_date','')::date; EXCEPTION WHEN others THEN bd := NULL; END;
  INSERT INTO public.profiles(id, full_name, class_name, academic_year, birth_date, phone, address, status)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),80),
          left(NEW.raw_user_meta_data->>'class_name',60), left(NEW.raw_user_meta_data->>'academic_year',40), bd,
          left(NEW.raw_user_meta_data->>'phone',20), left(NEW.raw_user_meta_data->>'address',200),
          CASE WHEN first THEN 'approved' ELSE 'pending' END);
  IF first THEN INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin'); END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('signup', 'طلب تسجيل جديد: ' || coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- weekly top: points earned from activities logged in the Cairo week (Sunday..Saturday), offset 0 = this week
CREATE OR REPLACE FUNCTION public.weekly_leaderboard(_offset int DEFAULT 0)
RETURNS TABLE(id uuid, full_name text, avatar text, points int, activities int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (
    SELECT ((now() AT TIME ZONE 'Africa/Cairo')::date - extract(dow FROM (now() AT TIME ZONE 'Africa/Cairo'))::int - 7*_offset) AS s
  )
  SELECT p.id, p.full_name, p.avatar, sum(l.points)::int, count(*)::int
  FROM public.activity_logs l JOIN public.profiles p ON p.id = l.user_id, b
  WHERE l.status='approved' AND p.status='approved'
    AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN b.s AND b.s + 6
    AND (public.is_approved(auth.uid()))
  GROUP BY p.id, p.full_name, p.avatar
  ORDER BY 4 DESC, 5 DESC LIMIT 20
$$;