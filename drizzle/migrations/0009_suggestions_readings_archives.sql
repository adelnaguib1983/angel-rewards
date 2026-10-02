ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref_id uuid;
ALTER TABLE public.member_notifications ADD COLUMN IF NOT EXISTS ref_id uuid;

CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugg insert own" ON public.suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()) AND length(trim(body)) > 0);
CREATE POLICY "sugg read" ON public.suggestions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_servant(auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_suggestion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n text; msg text;
BEGIN
  SELECT full_name INTO n FROM public.profiles WHERE id = NEW.user_id;
  msg := 'اقتراح جديد من ' || COALESCE(n,'مشترك') || ': ' || left(NEW.body, 80);
  INSERT INTO public.notifications(kind, message, actor_id, ref_id) VALUES ('suggestion', msg, NEW.user_id, NEW.id);
  INSERT INTO public.member_notifications(user_id, message, kind, ref_id)
    SELECT p.id, msg, 'suggestion', NEW.id FROM public.profiles p WHERE p.account_type='servant' AND p.status='approved';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_suggestion AFTER INSERT ON public.suggestions FOR EACH ROW EXECUTE FUNCTION public.notify_suggestion();

CREATE TABLE public.daily_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date date NOT NULL UNIQUE,
  book_nr integer NOT NULL,
  book_name text NOT NULL,
  chapter integer NOT NULL,
  points integer NOT NULL DEFAULT 5,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_readings TO authenticated;
GRANT ALL ON public.daily_readings TO service_role;
ALTER TABLE public.daily_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readings read" ON public.daily_readings FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "readings insert" ON public.daily_readings FOR INSERT TO authenticated WITH CHECK (public.is_servant(auth.uid()));
CREATE POLICY "readings update" ON public.daily_readings FOR UPDATE TO authenticated USING (public.is_servant(auth.uid())) WITH CHECK (public.is_servant(auth.uid()));
CREATE POLICY "readings delete" ON public.daily_readings FOR DELETE TO authenticated USING (public.is_servant(auth.uid()));

CREATE TABLE public.reading_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reading_id uuid NOT NULL REFERENCES public.daily_readings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reading_id)
);
GRANT SELECT ON public.reading_completions TO authenticated;
GRANT ALL ON public.reading_completions TO service_role;
ALTER TABLE public.reading_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "completions read" ON public.reading_completions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_servant(auth.uid()));

CREATE OR REPLACE FUNCTION public.complete_reading(_reading uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.daily_readings;
BEGIN
  IF NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'الحساب غير مفعّل'; END IF;
  SELECT * INTO r FROM public.daily_readings WHERE id=_reading;
  IF NOT FOUND THEN RAISE EXCEPTION 'القراءة غير موجودة'; END IF;
  IF r.reading_date <> (now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'يمكن احتساب قراءة اليوم فقط'; END IF;
  IF EXISTS (SELECT 1 FROM public.reading_completions WHERE user_id=auth.uid() AND reading_id=_reading) THEN RAISE EXCEPTION 'تم احتساب هذه القراءة من قبل'; END IF;
  INSERT INTO public.reading_completions(user_id, reading_id) VALUES (auth.uid(), _reading);
  IF r.points > 0 THEN
    INSERT INTO public.point_adjustments(user_id, amount, reason, admin_id) VALUES (auth.uid(), r.points, 'قراءة يومية: ' || r.book_name || ' ' || r.chapter, NULL);
  END IF;
  RETURN r.points;
END $$;

CREATE OR REPLACE FUNCTION public.quiz_league() RETURNS TABLE(id uuid, full_name text, avatar text, photo_url text, academic_year text, points integer, quizzes integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name, p.avatar, p.photo_url, p.academic_year, sum(a.score)::int, count(*)::int
  FROM public.quiz_attempts a JOIN public.profiles p ON p.id=a.user_id
  WHERE public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin')
  GROUP BY p.id ORDER BY 6 DESC, 7 DESC
$$;

CREATE OR REPLACE FUNCTION public.member_visit_history(_member uuid) RETURNS TABLE(created_at timestamptz, week_start date, method text, servant text, note text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT v.created_at, v.week_start, v.method, COALESCE(s.full_name,'خادم'), v.note
  FROM public.visitations v LEFT JOIN public.profiles s ON s.id=v.servant_id
  WHERE v.member_id=_member AND public.is_servant(auth.uid())
  ORDER BY v.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.visit_archive() RETURNS TABLE(id uuid, created_at timestamptz, member_id uuid, member text, academic_year text, method text, servant text, note text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT v.id, v.created_at, v.member_id, COALESCE(m.full_name,'مشترك'), m.academic_year, v.method, COALESCE(s.full_name,'خادم'), v.note
  FROM public.visitations v LEFT JOIN public.profiles m ON m.id=v.member_id LEFT JOIN public.profiles s ON s.id=v.servant_id
  WHERE public.has_role(auth.uid(),'admin') OR (public.is_servant(auth.uid()) AND v.servant_id=auth.uid())
  ORDER BY v.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.birthdays(_month integer) RETURNS TABLE(id uuid, full_name text, avatar text, photo_url text, academic_year text, day integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name, p.avatar, p.photo_url, p.academic_year, extract(day FROM p.birth_date)::int
  FROM public.profiles p
  WHERE p.birth_date IS NOT NULL AND extract(month FROM p.birth_date)=_month AND p.status='approved'
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  ORDER BY 6, 2
$$;