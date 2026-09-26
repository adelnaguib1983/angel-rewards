CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  class_name text,
  avatar text NOT NULL DEFAULT '🦁',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_approved(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=_uid AND status='approved')
$$;

CREATE POLICY "read own or admin" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
GRANT DELETE ON public.profiles TO authenticated;

-- self update of name/avatar only via function
CREATE OR REPLACE FUNCTION public.update_my_profile(_name text, _avatar text, _class text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET full_name = left(_name,80), avatar = left(_avatar,8), class_name = left(_class,60) WHERE id = auth.uid();
$$;

CREATE TABLE public.activity_settings (
  key text PRIMARY KEY,
  label text NOT NULL,
  emoji text NOT NULL,
  points int NOT NULL DEFAULT 10,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.activity_settings TO authenticated;
GRANT UPDATE ON public.activity_settings TO authenticated;
GRANT ALL ON public.activity_settings TO service_role;
ALTER TABLE public.activity_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.activity_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update settings" ON public.activity_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.activity_settings(key,label,emoji,points,sort) VALUES
('mass','حضور القداس','⛪',20,1),
('service','حضور مدارس الأحد','📖',15,2),
('communion','التناول','🍞',20,3),
('confession','الاعتراف','🕊️',25,4),
('bible','قراءة الكتاب المقدس','📜',10,5),
('giving','العطاء','🎁',10,6);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity text NOT NULL REFERENCES public.activity_settings(key),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  week int NOT NULL CHECK (week BETWEEN 1 AND 4),
  verse text,
  points int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity, year, month, week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin logs" ON public.activity_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "approved insert own" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));
CREATE POLICY "delete own recent or admin" ON public.activity_logs FOR DELETE TO authenticated
USING ((user_id = auth.uid() AND status='approved' AND created_at > now() - interval '2 days') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update logs" ON public.activity_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- server-side point assignment on insert
CREATE OR REPLACE FUNCTION public.set_log_points() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.points := (SELECT points FROM public.activity_settings WHERE key = NEW.activity);
  NEW.status := 'approved';
  NEW.admin_note := NULL;
  IF NEW.activity = 'bible' AND coalesce(trim(NEW.verse),'') = '' THEN
    RAISE EXCEPTION 'اكتب الآية التي لمست قلبك';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_log_points BEFORE INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.set_log_points();

CREATE TABLE public.point_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount int NOT NULL,
  reason text NOT NULL,
  admin_id uuid,
  log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.point_adjustments TO authenticated;
GRANT ALL ON public.point_adjustments TO service_role;
ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin adj" ON public.point_adjustments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert adj" ON public.point_adjustments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid() AND length(trim(reason)) > 0);

-- admin edits a log's points/status with a reason -> logged
CREATE OR REPLACE FUNCTION public.admin_review_log(_log_id uuid, _points int, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.activity_logs; old_eff int; new_eff int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'السبب مطلوب'; END IF;
  IF _status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'bad status'; END IF;
  SELECT * INTO l FROM public.activity_logs WHERE id=_log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  old_eff := CASE WHEN l.status='approved' THEN l.points ELSE 0 END;
  new_eff := CASE WHEN _status='approved' THEN _points ELSE 0 END;
  UPDATE public.activity_logs SET points=_points, status=_status, admin_note=_reason WHERE id=_log_id;
  INSERT INTO public.point_adjustments(user_id, amount, reason, admin_id, log_id)
  VALUES (l.user_id, new_eff - old_eff, _reason, auth.uid(), _log_id);
END $$;

CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🏅',
  description text,
  threshold int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage badges" ON public.badges FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.badges(name,emoji,description,threshold) VALUES
('أول خطوة','🌱','أول 20 نقطة',20),
('نجم الأسبوع','⭐','وصلت 100 نقطة',100),
('فارس الإيمان','🛡️','وصلت 250 نقطة',250),
('بطل الكنيسة','🏆','وصلت 500 نقطة',500),
('قائد روحي','👑','وصلت 1000 نقطة',1000);

CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🎁',
  description text,
  cost int NOT NULL DEFAULT 100,
  stock int NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read gifts" ON public.gifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage gifts" ON public.gifts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.gifts(name,emoji,description,cost,stock) VALUES
('شوكولاتة','🍫','قطعة شوكولاتة لذيذة',50,30),
('كتاب قصص قديسين','📚','كتاب مصور عن حياة القديسين',200,10),
('صليب خشب','✝️','صليب خشبي صغير',150,15),
('كرة قدم','⚽','كرة قدم جديدة',500,3),
('رحلة مع الخدمة','🚌','مكان مجاني في رحلة الخدمة',800,5);

CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gift_id uuid NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  cost int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin red" ON public.redemptions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update red" ON public.redemptions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.points_of(_uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    coalesce((SELECT sum(points) FROM public.activity_logs WHERE user_id=_uid AND status='approved'),0)
    + coalesce((SELECT sum(amount) FROM public.point_adjustments WHERE user_id=_uid AND log_id IS NULL),0)
  )::int
$$;
CREATE OR REPLACE FUNCTION public.balance_of(_uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.points_of(_uid) - coalesce((SELECT sum(cost) FROM public.redemptions WHERE user_id=_uid AND status<>'rejected'),0))::int
$$;

CREATE OR REPLACE FUNCTION public.my_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('points', public.points_of(auth.uid()), 'balance', public.balance_of(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE(id uuid, full_name text, avatar text, points int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.avatar, public.points_of(p.id)
  FROM public.profiles p
  WHERE p.status='approved' AND public.is_approved(auth.uid())
  ORDER BY 4 DESC LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.redeem_gift(_gift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gifts;
BEGIN
  IF NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'الحساب غير مفعل'; END IF;
  SELECT * INTO g FROM public.gifts WHERE id=_gift_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الهدية غير متاحة'; END IF;
  IF g.stock <= 0 THEN RAISE EXCEPTION 'نفدت الكمية'; END IF;
  IF public.balance_of(auth.uid()) < g.cost THEN RAISE EXCEPTION 'نقاطك غير كافية'; END IF;
  UPDATE public.gifts SET stock = stock - 1 WHERE id=g.id;
  INSERT INTO public.redemptions(user_id, gift_id, cost) VALUES (auth.uid(), g.id, g.cost);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_redemption(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.redemptions;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('pending','approved','delivered','rejected') THEN RAISE EXCEPTION 'bad status'; END IF;
  SELECT * INTO r FROM public.redemptions WHERE id=_id FOR UPDATE;
  IF r.status <> 'rejected' AND _status = 'rejected' THEN UPDATE public.gifts SET stock=stock+1 WHERE id=r.gift_id; END IF;
  IF r.status = 'rejected' AND _status <> 'rejected' THEN UPDATE public.gifts SET stock=stock-1 WHERE id=r.gift_id; END IF;
  UPDATE public.redemptions SET status=_status, admin_note=_note, updated_at=now() WHERE id=_id;
END $$;

-- admin: all members with points
CREATE OR REPLACE FUNCTION public.admin_members()
RETURNS TABLE(id uuid, full_name text, avatar text, class_name text, status text, created_at timestamptz, points int, balance int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT p.id, p.full_name, p.avatar, p.class_name, p.status, p.created_at, public.points_of(p.id), public.balance_of(p.id)
  FROM public.profiles p ORDER BY p.created_at DESC;
END $$;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  message text NOT NULL,
  actor_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin notif" ON public.notifications FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- new user: profile; first user becomes admin + approved
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first boolean;
BEGIN
  first := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin');
  INSERT INTO public.profiles(id, full_name, class_name, status)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'class_name', CASE WHEN first THEN 'approved' ELSE 'pending' END);
  IF first THEN INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin'); END IF;
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('signup', 'طلب تسجيل جديد: ' || coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.notify_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('activity', (SELECT full_name FROM public.profiles WHERE id=NEW.user_id) || ' سجّل: ' ||
    (SELECT label FROM public.activity_settings WHERE key=NEW.activity) || ' (الأسبوع ' || NEW.week || ')', NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_activity AFTER INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.notify_activity();

CREATE OR REPLACE FUNCTION public.notify_redemption() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(kind, message, actor_id)
  VALUES ('redeem', (SELECT full_name FROM public.profiles WHERE id=NEW.user_id) || ' طلب هدية: ' ||
    (SELECT name FROM public.gifts WHERE id=NEW.gift_id), NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_redemption AFTER INSERT ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.notify_redemption();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_redemption() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_log_points() FROM PUBLIC, anon, authenticated;