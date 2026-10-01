ALTER TABLE public.member_notifications
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS member_notifications_kind_unread_idx
  ON public.member_notifications(user_id, kind, read);

CREATE OR REPLACE FUNCTION public.notify_visit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES (
    'visitation',
    'افتقاد: ' || COALESCE((SELECT full_name FROM public.profiles WHERE id=NEW.servant_id), 'خادم') ||
    ' افتقد ' || COALESCE((SELECT full_name FROM public.profiles WHERE id=NEW.member_id), 'مشترك'),
    NEW.servant_id
  );
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_visit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_visit ON public.visitations;
CREATE TRIGGER trg_notify_visit AFTER INSERT ON public.visitations
FOR EACH ROW EXECUTE FUNCTION public.notify_visit();

CREATE OR REPLACE FUNCTION public.notify_quiz() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.published AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM NEW.published) THEN
    INSERT INTO public.member_notifications(user_id, quiz_id, kind, message)
    SELECT p.id, NEW.id, 'quiz', '🧠 مسابقة جديدة: ' || NEW.title
    FROM public.profiles p
    WHERE p.status='approved' AND p.account_type='member' AND NOT public.has_role(p.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_quiz() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_quiz ON public.quizzes;
CREATE TRIGGER trg_notify_quiz AFTER INSERT OR UPDATE OF published ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.notify_quiz();

CREATE OR REPLACE FUNCTION public.admin_absence_by_type(_offset int DEFAULT 0, _type text DEFAULT 'member')
RETURNS TABLE(id uuid, full_name text, academic_year text, visited boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _type NOT IN ('member','servant') THEN RAISE EXCEPTION 'bad type'; END IF;
  IF _type = 'member' THEN
    RETURN QUERY SELECT p.id, p.full_name, p.academic_year,
      EXISTS (SELECT 1 FROM public.visitations v WHERE v.member_id=p.id AND v.week_start=public.week_start(_offset))
    FROM public.profiles p
    WHERE p.status='approved' AND p.account_type='member' AND NOT public.has_role(p.id,'admin')
      AND NOT EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.user_id=p.id AND l.status='approved'
        AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN public.week_start(_offset) AND public.week_start(_offset)+6)
    ORDER BY p.academic_year NULLS LAST, p.full_name;
  ELSE
    RETURN QUERY SELECT p.id, p.full_name, p.academic_year, false
    FROM public.profiles p
    WHERE p.status='approved' AND p.account_type='servant' AND NOT public.has_role(p.id,'admin')
      AND NOT EXISTS (SELECT 1 FROM public.servant_preparations sp WHERE sp.user_id=p.id AND sp.week_start=public.week_start(_offset))
      AND NOT EXISTS (SELECT 1 FROM public.visitations v WHERE v.servant_id=p.id AND v.week_start=public.week_start(_offset))
    ORDER BY p.full_name;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_absence_by_type(int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_absence_by_type(int,text) TO authenticated, service_role;