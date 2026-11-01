-- 1) السنة الخدمية (عيد النيروز سبتمبر)
CREATE TABLE public.service_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  label text,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_years_range_chk CHECK (end_date > start_date)
);
GRANT SELECT ON public.service_years TO authenticated;
GRANT ALL ON public.service_years TO service_role;
ALTER TABLE public.service_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_years_read" ON public.service_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_years_admin_all" ON public.service_years FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) دورة اعتماد المسابقات
ALTER TABLE public.quizzes ADD COLUMN status text NOT NULL DEFAULT 'published';
UPDATE public.quizzes SET status = CASE WHEN published THEN 'published' ELSE 'draft' END;
COMMENT ON COLUMN public.quizzes.status IS 'draft | pending | published | rejected — servant quiz approval workflow';

-- 3) وسائط تحضير الخادم (صوت/فيديو على التخزين)
ALTER TABLE public.servant_preparations ADD COLUMN audio_url text;
ALTER TABLE public.servant_preparations ADD COLUMN video_url text;

-- 4) RPC: الخادم يرسل مسودة مسابقة للاعتماد
CREATE OR REPLACE FUNCTION public.servant_submit_quiz(_title text, _questions jsonb, _opens_at timestamptz, _closes_at timestamptz, _source text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nid uuid;
  nq int := 0;
  q jsonb;
  opts text[];
  pts int;
  corr int;
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'عنوان المسابقة مطلوب'; END IF;
  IF jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) < 1 OR jsonb_array_length(_questions) > 30 THEN RAISE EXCEPTION 'عدد الأسئلة غير صحيح'; END IF;
  IF _closes_at IS NOT NULL AND _opens_at IS NOT NULL AND _closes_at <= _opens_at THEN RAISE EXCEPTION 'وقت القفل يجب أن يكون بعد وقت الفتح'; END IF;

  INSERT INTO public.quizzes(title, published, status, opens_at, closes_at, created_by, image_url)
  VALUES (left(trim(_title),120), false, 'pending', _opens_at, _closes_at, auth.uid(), _source)
  RETURNING id INTO nid;

  FOR q IN SELECT * FROM jsonb_array_elements(_questions) LOOP
    IF q->>'question' IS NULL OR coalesce(trim(q->>'question'),'') = '' THEN RAISE EXCEPTION 'يوجد سؤال بدون نص'; END IF;
    IF jsonb_typeof(q->'options') <> 'array' OR jsonb_array_length(q->'options') < 2 OR jsonb_array_length(q->'options') > 3 THEN RAISE EXCEPTION 'كل سؤال يحتاج ٢ أو ٣ اختيارات'; END IF;
    SELECT coalesce(array_agg(v), '{}') INTO opts FROM jsonb_array_elements_text(q->'options') AS t(v) WHERE coalesce(trim(v),'') <> '';
    IF array_length(opts,1) < 2 THEN RAISE EXCEPTION 'كل سؤال يحتاج اختيارين على الأقل'; END IF;
    corr := (q->>'correct')::int;
    pts := coalesce((q->>'points')::int, 5);
    IF pts < 1 OR pts > 50 THEN pts := 5; END IF;
    IF corr IS NULL OR corr < 0 OR corr >= coalesce(jsonb_array_length(q->'options'),0) THEN RAISE EXCEPTION 'حدد الإجابة الصحيحة لكل سؤال'; END IF;
    IF corr >= coalesce(array_length(opts,1),0) THEN corr := 0; END IF;
    nq := nq + 1;
    INSERT INTO public.quiz_questions(quiz_id, question, options, correct, points, sort)
    VALUES (nid, left(trim(q->>'question'),400), opts, corr, pts, nq);
  END LOOP;

  INSERT INTO public.notifications(kind, message, actor_id, ref_id)
  VALUES ('quiz_approval',
    '🧠 مسابقة جديدة بانتظار الاعتماد: ' || left(trim(_title),80) || ' (' || nq || ' سؤال)',
    auth.uid(), nid);

  RETURN nid;
END $function$;

-- 5) RPC: المشرف يعتمد أو يرفض المسابقة
CREATE OR REPLACE FUNCTION public.admin_review_quiz(_quiz uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE z public.quizzes%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id=_quiz;
  IF NOT FOUND THEN RAISE EXCEPTION 'المسابقة غير موجودة'; END IF;
  IF z.status <> 'pending' THEN RAISE EXCEPTION 'تم مراجعة هذه المسابقة من قبل'; END IF;
  IF _approve THEN
    UPDATE public.quizzes SET status='published', published=true,
      opens_at = coalesce(opens_at, now()),
      closes_at = closes_at
    WHERE id=_quiz;
  ELSE
    UPDATE public.quizzes SET status='rejected', published=false WHERE id=_quiz;
  END IF;
END $function$;

-- 6) RPC: الخادم يبلغ المشرف عن غياب متكرر
CREATE OR REPLACE FUNCTION public.servant_report_absence_alert(_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF coalesce(trim(_message),'') = '' THEN RAISE EXCEPTION 'الرسالة مطلوبة'; END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('absence_alert', left(trim(_message),300), auth.uid());
END $function$;

-- 7) RPC: الخادم يستعرض تحضيرات باقي الخدام لأسبوع ما
CREATE OR REPLACE FUNCTION public.servant_week_preps(_week date DEFAULT public.week_start(0))
RETURNS TABLE(user_id uuid, full_name text, avatar text, notes text, images text[], audio_url text, video_url text, updated_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_servant(auth.uid()) THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  RETURN QUERY
  SELECT sp.user_id, p.full_name, p.avatar, sp.notes, sp.images, sp.audio_url, sp.video_url, sp.updated_at
  FROM public.servant_preparations sp
  JOIN public.profiles p ON p.id = sp.user_id
  WHERE sp.week_start = _week AND p.status = 'approved'
  ORDER BY sp.updated_at DESC;
END $function$;

-- 8) RPC: ترقية المراحل عند بداية السنة الخدمية (زر يدوي مع تحقق مشرف)
CREATE OR REPLACE FUNCTION public.admin_promote_academic_years()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  PERFORM public.promote_academic_years();
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('promotion', '🎓 تمت ترقية المراحل لبداية السنة الخدمية: أولى أصبحت ثانية، وثانية أصبحت ثالثة، وثالثة خرجت من كشف الأسماء الفعالة', auth.uid());
END $function$;

GRANT EXECUTE ON FUNCTION public.servant_submit_quiz(text, jsonb, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_quiz(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.servant_report_absence_alert(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.servant_week_preps(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_academic_years() TO authenticated;

REVOKE ALL ON FUNCTION public.promote_academic_years() FROM anon;
