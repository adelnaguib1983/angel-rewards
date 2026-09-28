ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE FUNCTION public.update_my_photo(_photo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _photo IS NOT NULL AND (length(_photo) > 400000 OR _photo NOT LIKE 'data:image/%') THEN RAISE EXCEPTION 'صورة غير صالحة'; END IF;
  UPDATE public.profiles SET photo_url = _photo WHERE id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.update_my_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_photo(text) TO authenticated;

-- announcement signups
CREATE TABLE public.announcement_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.announcement_signups TO authenticated;
GRANT ALL ON public.announcement_signups TO service_role;
ALTER TABLE public.announcement_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin signups" ON public.announcement_signups FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "approved insert own signup" ON public.announcement_signups FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid())
  AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND a.published));
CREATE POLICY "delete own or admin signup" ON public.announcement_signups FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.signup_counts() RETURNS TABLE(announcement_id uuid, n int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT announcement_id, count(*)::int FROM public.announcement_signups
  WHERE public.is_approved(auth.uid()) GROUP BY announcement_id
$$;
CREATE OR REPLACE FUNCTION public.admin_signups(_ann uuid) RETURNS TABLE(user_id uuid, full_name text, academic_year text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT s.user_id, p.full_name, p.academic_year, s.created_at
  FROM public.announcement_signups s JOIN public.profiles p ON p.id = s.user_id
  WHERE s.announcement_id = _ann ORDER BY s.created_at;
END $$;

-- member notifications
CREATE TABLE public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.member_notifications(user_id, read);
GRANT SELECT, UPDATE ON public.member_notifications TO authenticated;
GRANT ALL ON public.member_notifications TO service_role;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notif" ON public.member_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notif" ON public.member_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.published AND (TG_OP = 'INSERT' OR NOT OLD.published) THEN
    INSERT INTO public.member_notifications(user_id, announcement_id, message)
    SELECT p.id, NEW.id, '📣 إعلان جديد: ' || NEW.title FROM public.profiles p WHERE p.status = 'approved';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_announcement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_announcement AFTER INSERT OR UPDATE OF published ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();

-- admins add activities
GRANT INSERT ON public.activity_settings TO authenticated;
CREATE POLICY "admin insert settings" ON public.activity_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- activity week lock (Cairo current month/week only)
CREATE OR REPLACE FUNCTION public.is_current_week(_y int, _m int, _w int) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT _y = extract(year FROM (now() AT TIME ZONE 'Africa/Cairo'))::int
     AND _m = extract(month FROM (now() AT TIME ZONE 'Africa/Cairo'))::int
     AND _w = least(4, ceil(extract(day FROM (now() AT TIME ZONE 'Africa/Cairo')) / 7.0))::int
$$;
CREATE OR REPLACE FUNCTION public.enforce_log_week() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') AND NOT public.is_current_week(NEW.year, NEW.month, NEW.week) THEN
    RAISE EXCEPTION 'يمكنك تسجيل أنشطة الأسبوع الحالي فقط';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_log_week() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_log_week BEFORE INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.enforce_log_week();
DROP POLICY IF EXISTS "delete own recent or admin" ON public.activity_logs;
CREATE POLICY "delete own current week or admin" ON public.activity_logs FOR DELETE TO authenticated
USING ((user_id = auth.uid() AND status = 'approved' AND public.is_current_week(year, month, week)) OR public.has_role(auth.uid(),'admin'));

-- weekly quizzes
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read quizzes" ON public.quizzes FOR SELECT TO authenticated
USING ((published AND public.is_approved(auth.uid())) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin write quizzes" ON public.quizzes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  correct int NOT NULL,
  points int NOT NULL DEFAULT 5,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all questions" ON public.quiz_questions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score int NOT NULL,
  max_score int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id)
);
GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin attempts" ON public.quiz_attempts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- questions for members without the answer
CREATE OR REPLACE FUNCTION public.quiz_questions_for(_quiz uuid) RETURNS TABLE(id uuid, question text, options text[], points int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question, q.options, q.points FROM public.quiz_questions q
  JOIN public.quizzes z ON z.id = q.quiz_id
  WHERE q.quiz_id = _quiz AND z.published AND public.is_approved(auth.uid())
  ORDER BY q.sort, q.id
$$;

CREATE OR REPLACE FUNCTION public.submit_quiz(_quiz uuid, _answers jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s int := 0; m int := 0; r record; t text;
BEGIN
  IF NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'الحساب غير مفعّل'; END IF;
  SELECT title INTO t FROM public.quizzes WHERE id=_quiz AND published;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسابقة غير متاحة'; END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_attempts WHERE quiz_id=_quiz AND user_id=auth.uid()) THEN RAISE EXCEPTION 'لقد شاركت في هذه المسابقة بالفعل'; END IF;
  FOR r IN SELECT id, correct, points FROM public.quiz_questions WHERE quiz_id=_quiz LOOP
    m := m + r.points;
    IF (_answers->>(r.id::text)) IS NOT NULL AND (_answers->>(r.id::text))::int = r.correct THEN s := s + r.points; END IF;
  END LOOP;
  INSERT INTO public.quiz_attempts(quiz_id, user_id, score, max_score) VALUES (_quiz, auth.uid(), s, m);
  IF s > 0 THEN
    INSERT INTO public.point_adjustments(user_id, amount, reason, admin_id) VALUES (auth.uid(), s, 'مسابقة: ' || t, NULL);
  END IF;
  RETURN json_build_object('score', s, 'max', m);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_quiz_results(_quiz uuid) RETURNS TABLE(full_name text, academic_year text, score int, max_score int, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.full_name, p.academic_year, a.score, a.max_score, a.created_at
  FROM public.quiz_attempts a JOIN public.profiles p ON p.id=a.user_id WHERE a.quiz_id=_quiz ORDER BY a.score DESC, a.created_at;
END $$;