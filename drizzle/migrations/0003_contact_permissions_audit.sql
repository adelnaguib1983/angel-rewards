CREATE TABLE public.admin_permissions (
  user_id uuid PRIMARY KEY,
  is_owner boolean NOT NULL DEFAULT false,
  can_view_contacts boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read perms" ON public.admin_permissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.admin_permissions(user_id, is_owner, can_view_contacts)
SELECT user_id, true, true FROM public.user_roles WHERE role='admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_owner(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id=_uid AND is_owner) AND public.has_role(_uid,'admin')
$$;
CREATE OR REPLACE FUNCTION public.can_view_contacts(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id=_uid AND (can_view_contacts OR is_owner))
$$;

-- first user trigger also creates owner perms
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
  IF first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin');
    INSERT INTO public.admin_permissions(user_id, is_owner, can_view_contacts) VALUES (NEW.id, true, true);
  END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('signup', 'طلب تسجيل جديد: ' || coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- hide contact columns from direct reads
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, class_name, avatar, status, created_at, academic_year) ON public.profiles TO authenticated;

CREATE TABLE public.contact_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_access_log TO authenticated;
GRANT ALL ON public.contact_access_log TO service_role;
ALTER TABLE public.contact_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads audit" ON public.contact_access_log FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.my_contact()
RETURNS TABLE(birth_date date, phone text, address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT birth_date, phone, address FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.view_contact(_member uuid)
RETURNS TABLE(birth_date date, phone text, address text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_contacts(auth.uid()) THEN RAISE EXCEPTION 'ليس لديك صلاحية الاطلاع على بيانات التواصل'; END IF;
  INSERT INTO public.contact_access_log(admin_id, member_id) VALUES (auth.uid(), _member);
  RETURN QUERY SELECT p.birth_date, p.phone, p.address FROM public.profiles p WHERE p.id=_member;
END $$;

CREATE OR REPLACE FUNCTION public.owner_list_staff()
RETURNS TABLE(user_id uuid, full_name text, avatar text, is_admin boolean, is_owner boolean, can_view_contacts boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.avatar, public.has_role(p.id,'admin'),
    coalesce(ap.is_owner,false), coalesce(ap.can_view_contacts,false)
  FROM public.profiles p LEFT JOIN public.admin_permissions ap ON ap.user_id=p.id
  WHERE p.status='approved' ORDER BY 4 DESC, p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.owner_set_staff(_user uuid, _is_admin boolean, _can_view boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك تعديل صلاحياتك'; END IF;
  IF _is_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user,'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id=_user AND role='admin';
  END IF;
  INSERT INTO public.admin_permissions(user_id, can_view_contacts, updated_at) VALUES (_user, _is_admin AND _can_view, now())
  ON CONFLICT (user_id) DO UPDATE SET can_view_contacts = _is_admin AND _can_view, updated_at = now();
END $$;

DROP FUNCTION IF EXISTS public.admin_members();
CREATE FUNCTION public.admin_members()
RETURNS TABLE(id uuid, full_name text, avatar text, class_name text, academic_year text, status text, created_at timestamptz, points int, balance int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.avatar, p.class_name, p.academic_year, p.status, p.created_at, public.points_of(p.id), public.balance_of(p.id)
  FROM public.profiles p ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.my_permissions() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('owner', public.is_owner(auth.uid()), 'contacts', public.can_view_contacts(auth.uid()))
$$;