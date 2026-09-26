DROP FUNCTION IF EXISTS public.weekly_leaderboard(int);
CREATE FUNCTION public.weekly_leaderboard(_offset int DEFAULT 0)
RETURNS TABLE(rank int, id uuid, full_name text, avatar text, points int, activities int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (
    SELECT ((now() AT TIME ZONE 'Africa/Cairo')::date - extract(dow FROM (now() AT TIME ZONE 'Africa/Cairo'))::int - 7*greatest(_offset,0)) AS s
  ), t AS (
    SELECT p.id, p.full_name, p.avatar, sum(l.points)::int AS points, count(*)::int AS activities
    FROM public.activity_logs l JOIN public.profiles p ON p.id = l.user_id, b
    WHERE l.status='approved' AND p.status='approved'
      AND (l.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN b.s AND b.s + 6
      AND public.is_approved(auth.uid())
    GROUP BY p.id, p.full_name, p.avatar
  )
  SELECT (rank() OVER (ORDER BY points DESC))::int, id, full_name, avatar, points, activities
  FROM t ORDER BY points DESC, activities DESC, full_name LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.validate_profile() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' AND NEW.phone !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'رقم الموبايل غير صحيح (مثال: 01012345678)';
  END IF;
  IF NEW.birth_date IS NOT NULL AND (NEW.birth_date > current_date - interval '5 years' OR NEW.birth_date < current_date - interval '30 years') THEN
    RAISE EXCEPTION 'تاريخ الميلاد غير صحيح';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile();
REVOKE EXECUTE ON FUNCTION public.validate_profile() FROM PUBLIC, anon, authenticated;