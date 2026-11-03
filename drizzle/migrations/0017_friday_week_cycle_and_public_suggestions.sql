-- دورة الأسبوع من الجمعة إلى الخميس
CREATE OR REPLACE FUNCTION public.week_start(_offset integer DEFAULT 0)
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT ((now() AT TIME ZONE 'Africa/Cairo')::date
    - ((extract(dow FROM (now() AT TIME ZONE 'Africa/Cairo'))::int + 2) % 7)
    - 7 * greatest(_offset, 0))
$function$;

-- أسبوع الأنشطة الحالي = فترة الجمعة الحالية، مرقمة بترتيب جمعة الشهر الذي تبدأ فيه (1..5)
CREATE OR REPLACE FUNCTION public.is_current_week(_y integer, _m integer, _w integer)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH nc AS (SELECT (now() AT TIME ZONE 'Africa/Cairo')::date AS d),
  fr AS (SELECT nc.d - ((extract(dow FROM nc.d)::int + 2) % 7) AS f FROM nc)
  SELECT _y = extract(year FROM fr.f)::int
     AND _m = extract(month FROM fr.f)::int
     AND _w = (SELECT count(*) FROM generate_series(
                  date_trunc('month', fr.f)::date, fr.f, interval '1 day') g(gd)
               WHERE extract(dow FROM gd)::int = 5)
  FROM fr
$function$;

CREATE OR REPLACE FUNCTION public.weekly_leaderboard(_offset integer DEFAULT 0)
RETURNS TABLE(rank integer, id uuid, full_name text, avatar text, points integer, activities integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH b AS (SELECT public.week_start(greatest(_offset, 0)) AS s),
  t AS (
    SELECT p.id, p.full_name, p.avatar, sum(l.points)::int AS points, count(*)::int AS activities
    FROM public.activity_logs l JOIN public.profiles p ON p.id = l.user_id, b
    WHERE l.status='approved' AND p.status='approved'
      AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN b.s AND b.s + 6
      AND public.is_approved(auth.uid())
    GROUP BY p.id, p.full_name, p.avatar
  )
  SELECT (rank() OVER (ORDER BY points DESC))::int, id, full_name, avatar, points, activities
  FROM t ORDER BY points DESC, activities DESC, full_name LIMIT 20
$function$;

-- السماح للمخدومين المعتمدين بقراءة الاقتراحات المنشورة للجميع
CREATE POLICY "sugg read public to members"
ON public.suggestions
FOR SELECT
TO authenticated
USING (target_type = 'all' AND public.is_approved(auth.uid()));