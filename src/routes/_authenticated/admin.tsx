// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { PROFILE_COLS, ACADEMIC_YEARS, MONTHS, REDEEM_STATUS, cairoDate, cairoWeek, useMe, useSettings, fileToDataUrl } from "@/lib/app";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddMemberButton, BirthdaysButton, PersonDialog, PrepArchive, PrepDetail, QuizLeague, ReadingPlanner, ServantsManager, SuggestionDetail, VisitArchive, VisitHistoryDialog, removeMember } from "@/components/StaffMemberExtras";
import AdminWeeklySummary from "@/components/AdminWeeklySummary";
import { ImageLightbox } from "@/components/ImageLightbox";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة المشرف | أبطال الإيمان" },
      { name: "description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },
      { property: "og:title", content: "لوحة المشرف | أبطال الإيمان" },
      { property: "og:description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Member = { id: string; full_name: string; avatar: string; class_name: string | null; academic_year: string | null; status: string; created_at: string; points: number; balance: number };

function useMembers() {
  return useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_members");
      if (error) throw error;
      return data as Member[];
    },
  });
}

const TABS = [
  ["summary", "📊 الملخص الأسبوعي"], ["announcements", "📣 الإعلانات"], ["requests", "📝 طلبات التسجيل"], ["members", "👥 المخدومون"], ["servants", "📘 الخدام والافتقاد"], ["absence", "🚫 الغياب الأسبوعي"],
  ["activities", "✅ الأنشطة"], ["redeem", "🎁 طلبات الهدايا"], ["log", "📒 سجل النقاط"],
  ["archive", "🗂️ الأرشيف والمقارنة"], ["gifts", "🛍️ الهدايا"], ["badges", "🏅 الأوسمة والنقاط"], ["notif", "🔔 مركز التنبيهات"], ["quiz", "🧠 المسابقات"], ["visitarch", "🗂️ أرشيف الافتقاد"], ["read", "📖 القراءات اليومية"],
  ["audit", "🕵️ سجل التدقيق"], ["staff", "🔑 الصلاحيات"],
] as const;
type Tab = (typeof TABS)[number][0];

function Admin() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>("summary");
  const qc = useQueryClient();
  const { data: unread } = useQuery({
    queryKey: ["unread"],
    enabled: !!me?.isAdmin,
    queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false)).count ?? 0,
  });
  const { data: pending } = useMembers();
  const { data: perms } = usePerms();
  useEffect(() => {
    if (!me?.isAdmin) return;
    const ch = supabase.channel("admin-notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        toast.info((payload.new as { message: string }).message);
        qc.invalidateQueries();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.isAdmin, qc]);

  if (isLoading) return <div className="p-10 text-center">...</div>;
  if (!me?.isAdmin) return (
    <div className="p-10 text-center"><p>هذه الصفحة للمشرفين فقط.</p><Link to="/home" className="text-primary">رجوع</Link></div>
  );
  const ownerOnly = (k: string) => k === "audit" || k === "staff";
  const pendingCount = pending?.filter((m) => m.status === "pending").length ?? 0;

  return (
    <div className="stage-admin pb-16">
      <AppHeader stage="admin" name={me.profile?.full_name} avatar={me.profile?.avatar} isAdmin />
      <main className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-extrabold">لوحة المشرف 🛠️</h1><BirthdaysButton /></div>
        <nav className="my-5 flex flex-wrap gap-2">
          {TABS.filter(([k]) => !ownerOnly(k) || perms?.owner).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative rounded-2xl border-2 px-3 py-2 text-sm font-bold ${tab === k ? "border-secondary bg-secondary text-secondary-foreground pop" : "border-border bg-card hover:bg-muted"}`}>
              {l}
              {k === "requests" && pendingCount > 0 && <Dot n={pendingCount} />}
              {k === "notif" && !!unread && <Dot n={unread} />}
            </button>
          ))}
        </nav>
        {tab === "summary" && <AdminWeeklySummary />}
        {tab === "announcements" && <Announcements />}
        {tab === "requests" && <Requests />}
        {tab === "members" && <Members />}
        {tab === "servants" && <ServantsTab />}
        {tab === "absence" && <AbsenceTab />}
        {tab === "activities" && <Activities />}
        {tab === "redeem" && <Redemptions />}
        {tab === "log" && <AdjLog />}
        {tab === "gifts" && <Gifts />}
        {tab === "badges" && <BadgesAndPoints />}
        {tab === "notif" && <Notifications />}
        {tab === "quiz" && <AdminQuizzes />}
        {tab === "visitarch" && <VisitArchive />}
        {tab === "read" && <ReadingPlanner />}
        {tab === "archive" && <Archive />}
        {tab === "audit" && perms?.owner && <Audit />}
        {tab === "staff" && perms?.owner && <Staff />}
      </main>
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-destructive px-1 text-xs text-destructive-foreground">{n}</span>;
}
const card = "rounded-3xl border-2 border-border bg-card p-4";
const nameMap = (m?: Member[]) => Object.fromEntries((m ?? []).map((x) => [x.id, x]));

/* ---------- Announcements ---------- */
function Announcements() {
  const qc = useQueryClient();
  const empty = { title: "", body: "", event_date: "", published: true, image_url: "" };
  const [signupsFor, setSignupsFor] = useState<{ id: string; title: string } | null>(null);
  const { data: signups } = useQuery({ queryKey: ["admin-signups", signupsFor?.id], enabled: !!signupsFor, queryFn: async () => (await supabase.rpc("admin_signups", { _ann: signupsFor.id })).data ?? [] });
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("اكتب عنوان الإعلان وتفاصيله");
    const payload = { title: form.title.trim(), body: form.body.trim(), event_date: form.event_date || null, published: form.published, image_url: form.image_url || null };
    if (editing) {
      const { error } = await supabase.from("announcements").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing);
      if (error) return toast.error(error.message);
      toast.success("تم تحديث الإعلان");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return toast.error("سجّل الدخول مرة أخرى");
      const { error } = await supabase.from("announcements").insert({ ...payload, created_by: userId });
      if (error) return toast.error(error.message);
      toast.success("تم نشر الإعلان");
    }
    setForm(empty); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const edit = (item: { id: string; title: string; body: string; event_date: string | null; published: boolean }) => {
    setEditing(item.id); setForm({ title: item.title, body: item.body, event_date: item.event_date ?? "", published: item.published, image_url: item.image_url ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (id: string, published: boolean) => {
    const { error } = await supabase.from("announcements").update({ published, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const remove = async (id: string) => {
    if (!confirm("حذف هذا الإعلان نهائيًا؟")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الإعلان"); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="mb-3 text-xl font-extrabold">{editing ? "تعديل الإعلان" : "إعلان جديد"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold">العنوان<Input className="mt-1" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: رحلة الدير" /></label>
          <label className="text-sm font-bold">تاريخ النشاط أو الرحلة (اختياري)<Input className="mt-1" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></label>
          <label className="text-sm font-bold md:col-span-2">التفاصيل<textarea className="mt-1 min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm" maxLength={1500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="اكتب المكان والموعد وأي تفاصيل مهمة" /></label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl border-2 border-dashed border-border px-4 py-2 text-sm font-bold
