CREATE TABLE public.servant_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_id uuid NOT NULL DEFAULT auth.uid(),
  week_start date NOT NULL DEFAULT public.week_start(0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servant_id, week_start)
);
GRANT SELECT, INSERT ON public.servant_attendance TO authenticated;
GRANT ALL ON public.servant_attendance TO service_role;
ALTER TABLE public.servant_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servant attendance read" ON public.servant_attendance FOR SELECT TO authenticated USING (servant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "servant attendance insert" ON public.servant_attendance FOR INSERT TO authenticated WITH CHECK (servant_id = auth.uid() AND public.is_servant(auth.uid()) AND week_start = public.week_start(0));

CREATE OR REPLACE FUNCTION public.mark_servant_attendance() RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ws date := public.week_start(0);
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.servant_attendance(servant_id, week_start) VALUES (auth.uid(), ws)
  ON CONFLICT (servant_id, week_start) DO NOTHING;
  RETURN ws;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_servant_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_servant_attendance() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_servant_attendance(_offset int DEFAULT 0)
RETURNS TABLE(user_id uuid, full_name text, attended boolean, attended_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, sa.id IS NOT NULL, sa.created_at
  FROM public.profiles p
  LEFT JOIN public.servant_attendance sa ON sa.servant_id = p.id AND sa.week_start = public.week_start(_offset)
  WHERE p.status = 'approved' AND p.account_type = 'servant'
  ORDER BY sa.created_at NULLS LAST, p.full_name;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_servant_attendance(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_servant_attendance(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_missing_preparations(_offset int DEFAULT 0) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.member_notifications(user_id, message, kind)
  SELECT p.id, '⏰ تذكير: لم ترسل تحضير أسبوع ' || public.week_start(_offset)::text, 'missing_prep'
  FROM public.profiles p
  WHERE p.status = 'approved' AND p.account_type = 'servant'
    AND NOT EXISTS (
      SELECT 1 FROM public.servant_preparations sp
      WHERE sp.user_id = p.id AND sp.week_start = public.week_start(_offset)
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_missing_preparations(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_missing_preparations(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_prep() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(kind, message, actor_id, ref_id)
  VALUES ('prep', '📘 ' || (SELECT full_name FROM public.profiles WHERE id = NEW.user_id) || ' أرسل تحضير الخادم', NEW.user_id, NEW.id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_absence_by_type(_offset int DEFAULT 0, _type text DEFAULT 'member')
RETURNS TABLE(id uuid, full_name text, academic_year text, visited boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _type = 'servant' THEN
    RETURN QUERY SELECT p.id, p.full_name, p.academic_year, false
    FROM public.profiles p
    WHERE p.status = 'approved' AND p.account_type = 'servant'
      AND NOT EXISTS (
        SELECT 1 FROM public.servant_attendance sa
        WHERE sa.servant_id = p.id AND sa.week_start = public.week_start(_offset)
      )
    ORDER BY p.full_name;
  ELSE
    RETURN QUERY SELECT p.id, p.full_name, p.academic_year,
      EXISTS (SELECT 1 FROM public.visitations v WHERE v.member_id = p.id AND v.week_start = public.week_start(_offset))
    FROM public.profiles p
    WHERE p.status = 'approved' AND p.account_type = 'member' AND NOT public.has_role(p.id, 'admin')
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs l WHERE l.user_id = p.id AND l.status = 'approved'
          AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN public.week_start(_offset) AND public.week_start(_offset) + 6
      )
    ORDER BY p.academic_year NULLS LAST, p.full_name;
  END IF;
END $$;