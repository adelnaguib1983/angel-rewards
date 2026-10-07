CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE first boolean; bd date; atype text; ph text; old public.profiles%ROWTYPE; nmatch int;
BEGIN
  first := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin');
  atype := CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'servant' THEN 'servant' ELSE 'member' END;
  BEGIN bd := nullif(NEW.raw_user_meta_data->>'birth_date','')::date; EXCEPTION WHEN others THEN bd := NULL; END;
  ph := nullif(left(trim(coalesce(NEW.raw_user_meta_data->>'phone','')),20),'');

  -- Smart merge: link to an existing login-less profile with the same phone
  IF ph IS NOT NULL AND NOT first THEN
    SELECT count(*) INTO nmatch FROM public.profiles p
      WHERE p.phone = ph AND p.id <> NEW.id AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
    IF nmatch = 1 THEN
      SELECT p.* INTO old FROM public.profiles p
        WHERE p.phone = ph AND p.id <> NEW.id AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
      INSERT INTO public.profiles(id, full_name, class_name, academic_year, birth_date, phone, address, status, account_type, avatar, photo_url, phone2, staff_notes, created_at)
      VALUES (NEW.id, old.full_name,
              coalesce(old.class_name, left(NEW.raw_user_meta_data->>'class_name',60)),
              coalesce(old.academic_year, left(NEW.raw_user_meta_data->>'academic_year',40)),
              coalesce(old.birth_date, bd), old.phone,
              coalesce(old.address, left(NEW.raw_user_meta_data->>'address',200)),
              old.status, old.account_type, old.avatar, old.photo_url, old.phone2, old.staff_notes, old.created_at);
      UPDATE public.activity_logs SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.announcement_signups SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.contact_access_log SET member_id=NEW.id WHERE member_id=old.id;
      UPDATE public.member_notifications SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.point_adjustments SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.quiz_answers SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.quiz_attempts SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.reading_completions SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.redemptions SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.servant_attendance SET servant_id=NEW.id WHERE servant_id=old.id;
      UPDATE public.servant_preparations SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.suggestions SET user_id=NEW.id WHERE user_id=old.id;
      UPDATE public.visitations SET member_id=NEW.id WHERE member_id=old.id;
      UPDATE public.visitations SET servant_id=NEW.id WHERE servant_id=old.id;
      UPDATE public.notifications SET actor_id=NEW.id WHERE actor_id=old.id;
      DELETE FROM public.profiles WHERE id=old.id;
      INSERT INTO public.notifications(kind, message, actor_id)
      VALUES ('signup', 'تم ربط حساب دخول جديد بملف موجود: ' || old.full_name, NEW.id);
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.profiles(id, full_name, class_name, academic_year, birth_date, phone, address, status, account_type)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),80),
          left(NEW.raw_user_meta_data->>'class_name',60), left(NEW.raw_user_meta_data->>'academic_year',40), bd,
          ph, left(NEW.raw_user_meta_data->>'address',200),
          CASE WHEN first THEN 'approved' ELSE 'pending' END, atype);
  IF first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin');
    INSERT INTO public.admin_permissions(user_id, is_owner, can_view_contacts) VALUES (NEW.id, true, true);
  END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('signup', CASE WHEN atype='servant' THEN 'طلب تسجيل خادم جديد: ' ELSE 'طلب تسجيل جديد: ' END || coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.id);
  RETURN NEW;
END $function$;