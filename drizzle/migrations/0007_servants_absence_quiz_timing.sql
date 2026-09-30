ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'member';
GRANT SELECT (account_type) ON public.profiles TO authenticated;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS opens_at timestamptz, ADD COLUMN IF NOT EXISTS closes_at timestamptz, ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE FUNCTION public.week_start(_offset int DEFAULT 0) RETURNS date LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT ((now() AT TIME ZONE 'Africa/Cairo')::date - extract(dow FROM (now() AT TIME ZONE 'Africa/Cairo'))::int - 7*greatest(_offset,0))
$$;

CREATE OR REPLACE FUNCTION public.is_servant(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=_uid AND status='approved' AND account_type='servant') OR public.has_role(_uid,'admin')
$$;

CREATE TABLE public.servant_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  week_start date NOT NULL DEFAULT public.week_start(0),
  notes text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE ON public.servant_preparations TO authenticated;
GRANT ALL ON public.servant_preparations TO service_role;
ALTER TABLE public.servant_preparations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servant own prep read" ON public.servant_preparations FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "servant own prep insert" ON public.servant_preparations FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public.is_servant(auth.uid()) AND week_start=public.week_start(0));
CREATE POLICY "servant own prep update" ON public.servant_preparations FOR UPDATE TO authenticated USING (user_id=auth.uid() AND week_start=public.week_start(0)) WITH CHECK (user_id=auth.uid() AND week_start=public.week_start(0));

CREATE TABLE public.visitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_id uuid NOT NULL DEFAULT auth.uid(),
  member_id uuid NOT NULL,
  week_start date NOT NULL DEFAULT public.week_start(0),
  method text NOT NULL DEFAULT 'call',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.visitations TO authenticated;
GRANT ALL ON public.visitations TO service_role;
ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visit read" ON public.visitations FOR SELECT TO authenticated USING (servant_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "visit insert" ON public.visitations FOR INSERT TO authenticated WITH CHECK (servant_id=auth.uid() AND public.is_servant(auth.uid()));
CREATE POLICY "visit delete" ON public.visitations FOR DELETE TO authenticated USING (servant_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  question_id uuid NOT NULL,
  choice int NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
GRANT SELECT ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own answers" ON public.quiz_answers FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.notify_prep() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('prep', '📘 ' || (SELECT full_name FROM public.profiles WHERE id=NEW.user_id) || ' أرسل تحضير الخادم', NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_prep AFTER INSERT ON public.servant_preparations FOR EACH ROW EXECUTE FUNCTION public.notify_prep();

CREATE OR REPLACE FUNCTION public.servant_members() RETURNS TABLE(id uuid, full_name text, avatar text, photo_url text, academic_year text, visited boolean, active_this_week boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.avatar, p.photo_url, p.academic_year,
    EXISTS (SELECT 1 FROM public.visitations v WHERE v.member_id=p.id AND v.week_start=public.week_start(0)),
    EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.user_id=p.id AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date >= public.week_start(0))
  FROM public.profiles p WHERE p.status='approved' AND p.account_type='member' AND NOT public.has_role(p.id,'admin')
  ORDER BY p.academic_year NULLS LAST, p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.admin_prep_status(_offset int DEFAULT 0) RETURNS TABLE(user_id uuid, full_name text, submitted boolean, notes text, images text[], submitted_at timestamptz, visits int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, sp.id IS NOT NULL, sp.notes, sp.images, sp.updated_at,
    (SELECT count(*)::int FROM public.visitations v WHERE v.servant_id=p.id AND v.week_start=public.week_start(_offset))
  FROM public.profiles p LEFT JOIN public.servant_preparations sp ON sp.user_id=p.id AND sp.week_start=public.week_start(_offset)
  WHERE p.status='approved' AND p.account_type='servant' ORDER BY 3, p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.admin_visit_report(_offset int DEFAULT 0) RETURNS TABLE(servant text, member text, academic_year text, method text, note text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT s.full_name, m.full_name, m.academic_year, v.method, v.note, v.created_at
  FROM public.visitations v JOIN public.profiles s ON s.id=v.servant_id JOIN public.profiles m ON m.id=v.member_id
  WHERE v.week_start=public.week_start(_offset) ORDER BY m.academic_year, m.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.admin_absence(_offset int DEFAULT 0) RETURNS TABLE(id uuid, full_name text, academic_year text, visited boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.academic_year,
    EXISTS (SELECT 1 FROM public.visitations v WHERE v.member_id=p.id AND v.week_start=public.week_start(_offset))
  FROM public.profiles p
  WHERE p.status='approved' AND p.account_type='member' AND NOT public.has_role(p.id,'admin')
    AND NOT EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.user_id=p.id AND l.status='approved'
      AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN public.week_start(_offset) AND public.week_start(_offset)+6)
  ORDER BY p.academic_year NULLS LAST, p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.admin_notify_absent(_year text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.member_notifications(user_id, message)
  SELECT a.id, '💙 وحشتنا هذا الأسبوع! مستنيينك في الخدمة والقداس' FROM public.admin_absence(0) a WHERE coalesce(a.academic_year,'') = coalesce(_year,'');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.leaderboard_years() RETURNS TABLE(id uuid, full_name text, avatar text, photo_url text, academic_year text, points integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name, p.avatar, p.photo_url, p.academic_year, public.points_of(p.id)
  FROM public.profiles p
  WHERE p.status='approved' AND p.account_type='member' AND public.is_approved(auth.uid())
  ORDER BY 6 DESC
$$;

CREATE OR REPLACE FUNCTION public.my_stats() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT json_build_object('points', public.points_of(auth.uid()), 'balance', public.balance_of(auth.uid()),
    'deductions', coalesce((SELECT -sum(amount) FROM public.point_adjustments WHERE user_id=auth.uid() AND amount<0 AND log_id IS NULL),0)::int,
    'spent', coalesce((SELECT sum(cost) FROM public.redemptions WHERE user_id=auth.uid() AND status<>'rejected'),0)::int)
$$;

CREATE OR REPLACE FUNCTION public.my_deductions() RETURNS TABLE(amount int, reason text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT -a.amount, a.reason, a.created_at FROM public.point_adjustments a WHERE a.user_id=auth.uid() AND a.amount<0 AND a.log_id IS NULL
  UNION ALL
  SELECT r.cost, 'استبدال هدية: ' || g.name, r.created_at FROM public.redemptions r JOIN public.gifts g ON g.id=r.gift_id WHERE r.user_id=auth.uid() AND r.status<>'rejected'
  ORDER BY 3 DESC
$$;

CREATE OR REPLACE FUNCTION public.quiz_open(_quiz uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id=_quiz AND z.published AND (z.opens_at IS NULL OR z.opens_at<=now()) AND (z.closes_at IS NULL OR z.closes_at>now()))
$$;

CREATE OR REPLACE FUNCTION public.quiz_questions_v2(_quiz uuid) RETURNS TABLE(id uuid, question text, options text[], points integer, image_url text, my_choice int, is_correct boolean, correct int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT q.id, q.question, q.options, q.points, q.image_url, a.choice, a.correct, CASE WHEN a.id IS NOT NULL THEN q.correct END
  FROM public.quiz_questions q
  LEFT JOIN public.quiz_answers a ON a.question_id=q.id AND a.user_id=auth.uid()
  WHERE q.quiz_id=_quiz AND public.is_approved(auth.uid()) AND (public.quiz_open(_quiz) OR a.id IS NOT NULL)
  ORDER BY q.sort, q.id
$$;

CREATE OR REPLACE FUNCTION public.answer_question(_question uuid, _choice int) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE q public.quiz_questions; ok boolean; t text;
BEGIN
  IF NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'الحساب غير مفعّل'; END IF;
  SELECT * INTO q FROM public.quiz_questions WHERE id=_question;
  IF NOT FOUND THEN RAISE EXCEPTION 'السؤال غير موجود'; END IF;
  IF NOT public.quiz_open(q.quiz_id) THEN RAISE EXCEPTION 'المسابقة مغلقة الآن'; END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_answers WHERE user_id=auth.uid() AND question_id=_question) THEN RAISE EXCEPTION 'أجبت على هذا السؤال بالفعل'; END IF;
  ok := (_choice = q.correct);
  INSERT INTO public.quiz_answers(user_id, quiz_id, question_id, choice, correct) VALUES (auth.uid(), q.quiz_id, _question, _choice, ok);
  INSERT INTO public.quiz_attempts(quiz_id, user_id, score, max_score) VALUES (q.quiz_id, auth.uid(), CASE WHEN ok THEN q.points ELSE 0 END, q.points)
  ON CONFLICT (quiz_id, user_id) DO UPDATE SET score = quiz_attempts.score + EXCLUDED.score, max_score = quiz_attempts.max_score + EXCLUDED.max_score;
  IF ok AND q.points > 0 THEN
    SELECT title INTO t FROM public.quizzes WHERE id=q.quiz_id;
    INSERT INTO public.point_adjustments(user_id, amount, reason, admin_id) VALUES (auth.uid(), q.points, 'مسابقة: ' || t, NULL);
  END IF;
  RETURN json_build_object('correct', ok, 'answer', q.correct, 'points', CASE WHEN ok THEN q.points ELSE 0 END);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE first boolean; bd date; atype text;
BEGIN
  first := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin');
  atype := CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'servant' THEN 'servant' ELSE 'member' END;
  BEGIN bd := nullif(NEW.raw_user_meta_data->>'birth_date','')::date; EXCEPTION WHEN others THEN bd := NULL; END;
  INSERT INTO public.profiles(id, full_name, class_name, academic_year, birth_date, phone, address, status, account_type)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),80),
          left(NEW.raw_user_meta_data->>'class_name',60), left(NEW.raw_user_meta_data->>'academic_year',40), bd,
          left(NEW.raw_user_meta_data->>'phone',20), left(NEW.raw_user_meta_data->>'address',200),
          CASE WHEN first THEN 'approved' ELSE 'pending' END, atype);
  IF first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin');
    INSERT INTO public.admin_permissions(user_id, is_owner, can_view_contacts) VALUES (NEW.id, true, true);
  END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('signup', CASE WHEN atype='servant' THEN 'طلب تسجيل خادم جديد: ' ELSE 'طلب تسجيل جديد: ' END || coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.id);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_account_type(_member uuid, _type text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _type NOT IN ('member','servant') THEN RAISE EXCEPTION 'bad type'; END IF;
  UPDATE public.profiles SET account_type=_type WHERE id=_member;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_member(_member uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF _member = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك إزالة نفسك'; END IF;
  IF public.is_owner(_member) THEN RAISE EXCEPTION 'لا يمكن إزالة المشرف المسؤول'; END IF;
  IF public.has_role(_member, 'admin') AND NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'إزالة مشرف تتطلب المشرف المسؤول'; END IF;
  DELETE FROM public.announcement_signups WHERE user_id = _member;
  DELETE FROM public.member_notifications WHERE user_id = _member;
  DELETE FROM public.quiz_answers WHERE user_id = _member;
  DELETE FROM public.quiz_attempts WHERE user_id = _member;
  DELETE FROM public.visitations WHERE member_id = _member OR servant_id = _member;
  DELETE FROM public.servant_preparations WHERE user_id = _member;
  DELETE FROM public.redemptions WHERE user_id = _member;
  DELETE FROM public.point_adjustments WHERE user_id = _member;
  DELETE FROM public.activity_logs WHERE user_id = _member;
  DELETE FROM public.admin_permissions WHERE user_id = _member;
  DELETE FROM public.user_roles WHERE user_id = _member;
  DELETE FROM public.profiles WHERE id = _member;
  DELETE FROM auth.users WHERE id = _member;
END $function$;