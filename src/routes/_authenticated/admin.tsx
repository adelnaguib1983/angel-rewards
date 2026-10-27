
// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guardedimport { createFileRoute, Link } from "@tanstack/react-router";import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";import { useEffect, useMemo, useState } from "react";import { toast } from "sonner";import { supabase } from "@/integrations/supabase/client";import { AppHeader } from "@/components/AppHeader";import { PROFILE_COLS, ACADEMIC_YEARS, MONTHS, REDEEM_STATUS, cairoDate, cairoWeek, useMe, useSettings, fileToDataUrl } from "@/lib/app";import { Input } from "@/components/ui/input";import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";import { AddMemberButton, BirthdaysButton, PersonDialog, PrepArchive, PrepDetail, QuizLeague, ReadingPlanner, ServantsManager, SuggestionDetail, VisitArchive, VisitHistoryDialog, removeMember } from "@/components/StaffMemberExtras";import AdminWeeklySummary from "@/components/AdminWeeklySummary";import { ImageLightbox } from "@/components/ImageLightbox";
export const Route = createFileRoute("/_authenticated/admin")({head: () => ({meta: [{ title: "لوحة المشرف | أبطال الإيمان" },{ name: "description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },{ property: "og:title", content: "لوحة المشرف | أبطال الإيمان" },{ property: "og:description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" },],}),component: Admin,});
type Member = { id: string; full_name: string; avatar: string; class_name: string | null; academic_year: string | null; status: string; created_at: string; points: number; balance: number };
function useMembers() {return useQuery({queryKey: ["admin-members"],queryFn: async () => {const { data, error } = await supabase.rpc("admin_members");if (error) throw error;return data as Member[];},});}
const TABS = [["summary", "📊 الملخص الأسبوعي"], ["announcements", "📣 الإعلانات"], ["requests", "📝 طلبات التسجيل"], ["members", "👥 المخدومون"], ["servants", "📘 الخدام والافتقاد"], ["absence", "🚫 الغياب الأسبوعي"],["activities", "✅ الأنشطة"], ["redeem", "🎁 طلبات الهدايا"], ["log", "📒 سجل النقاط"],["archive", "🗂️ الأرشيف والمقارنة"], ["gifts", "🛍️ الهدايا"], ["badges", "🏅 الأوسمة والنقاط"], ["notif", "🔔 مركز التنبيهات"], ["quiz", "🧠 المسابقات"], ["visitarch", "🗂️ أرشيف الافتقاد"], ["read", "📖 القراءات اليومية"],["audit", "🕵️ سجل التدقيق"], ["staff", "🔑 الصلاحيات"],] as const;type Tab = (typeof TABS)[number][0];
function Admin() {const { data: me, isLoading } = useMe();const [tab, setTab] = useState("summary");const qc = useQueryClient();const { data: unread } = useQuery({queryKey: ["unread"],enabled: !!me?.isAdmin,queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false)).count ?? 0,});const { data: pending } = useMembers();const { data: perms } = usePerms();useEffect(() => {if (!me?.isAdmin) return;const ch = supabase.channel("admin-notif").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {toast.info((payload.new as { message: string }).message);qc.invalidateQueries();}).subscribe();return () => { supabase.removeChannel(ch); };}, [me?.isAdmin, qc]);
if (isLoading) return
...
;if (!me?.isAdmin) return (
هذه الصفحة للمشرفين فقط.
رجوع
);const ownerOnly = (k: string) => k === "audit" || k === "staff";const pendingCount = pending?.filter((m) => m.status === "pending").length ?? 0;

return (
لوحة المشرف 🛠️
{TABS.filter(([k]) => !ownerOnly(k) || perms?.owner).map(([k, l]) => (<button key={k} onClick={() => setTab(k)}className={relative rounded-2xl border-2 px-3 py-2 text-sm font-bold ${tab === k ? "border-secondary bg-secondary text-secondary-foreground pop" : "border-border bg-card hover:bg-muted"}}>{l}{k === "requests" && pendingCount > 0 && }{k === "notif" && !!unread && }))}{tab === "summary" && }{tab === "announcements" && }{tab === "requests" && }{tab === "members" && }{tab === "servants" && }{tab === "absence" && }{tab === "activities" && }{tab === "redeem" && }{tab === "log" && }{tab === "gifts" && }{tab === "badges" && }{tab === "notif" && }{tab === "quiz" && }{tab === "visitarch" && }{tab === "read" && }{tab === "archive" && }{tab === "audit" && perms?.owner && }{tab === "staff" && perms?.owner && }
);}

function Dot({ n }: { n: number }) {return {n};}const card = "rounded-3xl border-2 border-border bg-card p-4";const nameMap = (m?: Member[]) => Object.fromEntries((m ?? []).map((x) => [x.id, x]));
/* ---------- Announcements ---------- /function Announcements() {const qc = useQueryClient();const empty = { title: "", body: "", event_date: "", published: true, image_url: "" };const [signupsFor, setSignupsFor] = useState<{ id: string; title: string } | null>(null);const { data: signups } = useQuery({ queryKey: ["admin-signups", signupsFor?.id], enabled: !!signupsFor, queryFn: async () => (await supabase.rpc("admin_signups", { _ann: signupsFor.id })).data ?? [] });const [form, setForm] = useState(empty);const [editing, setEditing] = useState<string | null>(null);const { data, isLoading } = useQuery({queryKey: ["admin-announcements"],queryFn: async () => {const { data, error } = await supabase.from("announcements").select("").order("created_at", { ascending: false });if (error) throw error;return data;},});const save = async () => {if (!form.title.trim() || !form.body.trim()) return toast.error("اكتب عنوان الإعلان وتفاصيله");const payload = { title: form.title.trim(), body: form.body.trim(), event_date: form.event_date || null, published: form.published, image_url: form.image_url || null };if (editing) {const { error } = await supabase.from("announcements").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing);if (error) return toast.error(error.message);toast.success("تم تحديث الإعلان");} else {const { data: auth } = await supabase.auth.getUser();const userId = auth.user?.id;if (!userId) return toast.error("سجّل الدخول مرة أخرى");const { error } = await supabase.from("announcements").insert({ ...payload, created_by: userId });if (error) return toast.error(error.message);toast.success("تم نشر الإعلان");}setForm(empty); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });};const edit = (item: { id: string; title: string; body: string; event_date: string | null; published: boolean }) => {setEditing(item.id); setForm({ title: item.title, body: item.body, event_date: item.event_date ?? "", published: item.published, image_url: item.image_url ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" });};const toggle = async (id: string, published: boolean) => {const { error } = await supabase.from("announcements").update({ published, updated_at: new Date().toISOString() }).eq("id", id);if (error) return toast.error(error.message);qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });};const remove = async (id: string) => {if (!confirm("حذف هذا الإعلان نهائيًا؟")) return;const { error } = await supabase.from("announcements").delete().eq("id", id);if (error) return toast.error(error.message);toast.success("تم حذف الإعلان"); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });};return (
{editing ? "تعديل الإعلان" : "إعلان جديد"}
العنوان<Input className="mt-1" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: رحلة الدير" />تاريخ النشاط أو الرحلة (اختياري)<Input className="mt-1" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />التفاصيل<textarea className="mt-1 min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm" maxLength={1500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="اكتب المكان والموعد وأي تفاصيل مهمة" />
📷 {form.image_url ? "تغيير الصورة" : "إضافة صورة"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setForm({ ...form, image_url: await fileToDataUrl(f, 1000, 0.75) }); } catch (err) { toast.error((err as Error).message); } }} />{form.image_url && <>
<button onClick={() => setForm({ ...form, image_url: "" })} className="text-sm text-destructive">إزالة</>}
<input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> ظاهر للمخدومين
{editing ? "حفظ التعديل" : "نشر الإعلان"}{editing && <button onClick={() => { setEditing(null); setForm(empty); }} className="rounded-xl bg-muted px-4 py-2 font-bold">إلغاء}
الإعلانات السابقة
{isLoading &&
جاري التحميل...
}{!isLoading && !data?.length &&
لا توجد إعلانات بعد.
}
{data?.map((item) => (<article key={item.id} className={${card} grid grid-cols-[minmax(0,1fr)_auto] gap-3}>
📌 {item.title}
<span className={rounded-full px-2 py-0.5 text-xs font-bold ${item.published ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}}>{item.published ? "ظاهر" : "مخفي"}{item.event_date && 📅 {item.event_date}}
{item.image_url &&
}
{item.body}
<button onClick={() => setSignupsFor({ id: item.id, title: item.title })} className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">🙋 المسجلون<button onClick={() => edit(item)} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">تعديل<button onClick={() => toggle(item.id, !item.published)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">{item.published ? "إخفاء" : "إظهار"}<button onClick={() => remove(item.id)} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">حذف
))}
<Dialog open={!!signupsFor} onOpenChange={(o) => !o && setSignupsFor(null)}>المسجلون في: {signupsFor?.title} ({signups?.length ?? 0})
{!signups?.length &&
لا يوجد مسجلون بعد.
}{signups?.map((r, i) =>
{i + 1}. {r.full_name}{r.academic_year ?? ""} · {new Date(r.created_at).toLocaleString("ar-EG")}
)}
);}

/* ---------- Weekly summary ---------- /function Summary({ initialOffset = 0 }: { initialOffset?: number }) {const [offset, setOffset] = useState(initialOffset);const [year, setYear] = useState("");const days = cairoWeek(offset);const { data: members } = useMembers();const { data: settings } = useSettings();const { data: allLogs } = useQuery({queryKey: ["admin-week-logs", offset],queryFn: async () => {const from = new Date(new Date(days[0]).getTime() - 86400000).toISOString();const to = new Date(new Date(days[6]).getTime() + 2 * 86400000).toISOString();const { data, error } = await supabase.from("activity_logs").select("").gte("created_at", from).lt("created_at", to).eq("status", "approved");if (error) throw error;return data.filter((l) => days.includes(cairoDate(l.created_at)));},});const yearOf = nameMap(members);const logs = (allLogs ?? []).filter((l) => !year || yearOf[l.user_id]?.academic_year === year);const byMember = useMemo(() => {const m: Record<string, { points: number; count: number; acts: Record<string, number> }> = {};logs.forEach((l) => {m[l.user_id] ??= { points: 0, count: 0, acts: {} };m[l.user_id].points += l.points; m[l.user_id].count++;m[l.user_id].acts[l.activity] = (m[l.user_id].acts[l.activity] ?? 0) + 1;});const rows = Object.entries(m).sort((a, b) => b[1].points - a[1].points || b[1].count - a[1].count);return rows.map(([id, v]) => ({ id, ...v, rank: rows.findIndex((r) => r[1].points === v.points) + 1, tied: rows.filter((r) => r[1].points === v.points).length > 1 }));}, [logs]);const names = nameMap(members);const perActivity = settings?.map((s) => ({ ...s, n: logs.filter((l) => l.activity === s.key).length ?? 0 })) ?? [];const total = logs.reduce((a, l) => a + l.points, 0);const [detail, setDetail] = useState<null | "acts" | "points" | "approved">(null);const approvedList = (members ?? []).filter((m) => m.status === "approved" && (!year || m.academic_year === year));
function exportCsv() {const head = ["من تاريخ", "إلى تاريخ", "المركز", "تعادل", "الاسم", "العام الدراسي", "الفصل", "النقاط", "عدد الأنشطة", ...(settings?.map((s) => s.label) ?? [])];const rows = byMember.map((r) => [days[0], days[6], r.tied ? =${r.rank} : r.rank, r.tied ? "نعم (مركز مشترك)" : "لا", names[r.id]?.full_name ?? "", names[r.id]?.academic_year ?? "", names[r.id]?.class_name ?? "", r.points, r.count, ...(settings?.map((s) => r.acts[s.key] ?? 0) ?? [])]);const esc = (v: unknown) => "${String(v).replace(/"/g, '""')}";const csv = "\uFEFF" + [[الأسبوع من الأحد ${days[0]} إلى السبت ${days[6]} (توقيت القاهرة)${year ? — ${year} : ""}], ["قواعد الترتيب: المتساوون في النقاط يأخذون نفس المركز (=)، ويليهم المركز التالي بعد عددهم"], head, ...rows].map((r) => r.map(esc).join(",")).join("\n");const a = document.createElement("a");a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));a.download = weekly-summary-${days[0]}${year ? "-" + year : ""}.csv; a.click();}
return (
<button onClick={() => setOffset(offset + 1)} className="rounded-xl bg-card px-3 py-2 font-bold">→ السابق
من الأحد {days[0]} إلى السبت {days[6]}
<button disabled={offset === 0} onClick={() => setOffset(offset - 1)} className="rounded-xl bg-card px-3 py-2 font-bold disabled:opacity-40">التالي ←
<select value={year} onChange={(e) => setYear(e.target.value)} className="h-10 rounded-xl border border-input bg-card px-2 text-sm">كل الأعوام الدراسية{ACADEMIC_YEARS.map((y) => {y})}⬇️ تصدير CSV
<Stat label="أنشطة مكتملة" v={logs.length} cls="bg-primary text-primary-foreground" onClick={() => setDetail("acts")} /><Stat label="نقاط مكتسبة" v={total} cls="bg-secondary text-secondary-foreground" onClick={() => setDetail("points")} /><Stat label="أعضاء مشاركون" v={byMember.length} cls="bg-accent text-accent-foreground" onClick={() => setDetail("points")} /><Stat label="إجمالي المفعّلين" v={approvedList.length} cls="bg-sky text-primary-foreground" onClick={() => setDetail("approved")} />
<Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>{detail === "acts" ? "الأنشطة المكتملة" : detail === "points" ? "النقاط لكل مخدوم" : "المخدومون المفعّلون"}{detail === "acts" && (logs.length ? [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((l) => {const s = settings?.find((x) => x.key === l.activity);return
{s?.emoji}{s?.label ?? l.activity}{names[l.user_id]?.full_name ?? "—"}{cairoDate(l.created_at)}
;}) :
لا توجد أنشطة.
)}{detail === "points" && (byMember.length ? byMember.map((r) => (
{r.tied ? =${r.rank} : r.rank}{names[r.id]?.avatar}{names[r.id]?.full_name}{r.count} نشاط{r.points}
)) :
لا توجد نقاط.
)}{detail === "approved" && approvedList.map((m) => (
{m.avatar}{m.full_name}{m.academic_year ?? ""}
))}
الأنشطة المكتملة
{perActivity.map((a) => (
{a.emoji} {a.label}{a.n}
<div className="h-2 rounded bg-primary" style={{ width: ${Math.min(100, (a.n / Math.max(1, ...perActivity.map((x) => x.n))) * 100)}% }} />
))}
الأكثر مشاركة
{!byMember.length &&
لا توجد أنشطة هذا الأسبوع.
}{byMember.slice(0, 10).map((r) => (
{r.tied ? =${r.rank} : r.rank}{names[r.id]?.avatar}{names[r.id]?.full_name}{r.count} نشاط{r.points}
))}
);}function Stat({ label, v, cls, onClick }: { label: string; v: number; cls: string; onClick?: () => void }) {return <button type="button" onClick={onClick} className={pop rounded-3xl p-4 text-right transition hover:scale-[1.02] ${cls}}>
{label} ›
{v}
;}

/* ---------- Requests ---------- */function Requests() {const qc = useQueryClient();const { data } = useQuery({queryKey: ["admin-pending"],queryFn: async () => (await supabase.from("profiles").select(PROFILE_COLS + ", account_type").neq("status", "approved").order("created_at", { ascending: false })).data ?? [],});const set = async (id: string, status: string) => {const { error } = await supabase.from("profiles").update({ status }).eq("id", id);if (error) return toast.error(error.message);toast.success(status === "approved" ? "تم تفعيل الحساب" : "تم الرفض");qc.invalidateQueries();};if (!data?.length) return
لا توجد طلبات جديدة 🎉
;return (
{data.map((p) => (
{p.avatar} {p.full_name} <span className={rounded-full px-2 py-0.5 text-xs ${p.account_type === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}}>{p.account_type === "servant" ? "خادم" : "مخدوم"}<span className={rounded-full px-2 py-0.5 text-xs ${p.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}}>{p.status === "rejected" ? "مرفوض" : "جديد"}
<button onClick={() => set(p.id, "approved")} className="flex-1 rounded-xl bg-accent py-2 font-bold text-accent-foreground">✓ موافقة{p.status !== "rejected" && <button onClick={() => set(p.id, "rejected")} className="flex-1 rounded-xl bg-destructive py-2 font-bold text-destructive-foreground">✗ رفض}
))}
);}type P = { id: string; academic_year?: string | null; class_name?: string | null; created_at: string };function usePerms() {return useQuery({ queryKey: ["perms"], queryFn: async () => (await supabase.rpc("my_permissions")).data as { owner: boolean; contacts: boolean } });}function Contact({ p }: { p: P }) {const { data: perms } = usePerms();const [c, setC] = useState<{ birth_date: string | null; phone: string | null; address: string | null } | null>(null);const reveal = async () => {const { data, error } = await supabase.rpc("view_contact", { _member: p.id });if (error) return toast.error(error.message);setC(data?.[0] ?? { birth_date: null, phone: null, address: null });};return (
العام الدراسي
{p.academic_year ?? "—"} {p.class_name ? · ${p.class_name} : ""}
تاريخ التسجيل
{cairoDate(p.created_at)}
{c ? (<>تاريخ الميلاد
{c.birth_date ?? "—"}
الموبايل
{c.phone ? <a href={tel:${c.phone}} className="text-primary">{c.phone} : "—"}
العنوان
{c.address ?? "—"}
</>) : perms?.contacts ? (
🔒 عرض بيانات التواصل (يُسجَّل في سجل التدقيق)
) : (
🔒 بيانات التواصل متاحة للمشرفين المخولين فقط
)}
);}

/* ---------- Members ---------- */function Members() {const [hist, setHist] = useState(null);const qc = useQueryClient();const { data: members } = useMembers();const { data: profiles } = useQuery({queryKey: ["admin-profiles"],queryFn: async () => (await supabase.from("profiles").select(PROFILE_COLS)).data ?? [],});const [q, setQ] = useState("");const [adj, setAdj] = useState<Member | null>(null);const [open, setOpen] = useState<string | null>(null);const [year, setYear] = useState("all");const [edit, setEdit] = useState(null);const [amount, setAmount] = useState(10);const [reason, setReason] = useState("");const pmap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));const approved = (members ?? []).filter((m) => m.status === "approved");const yearOf = (m: Member) => pmap[m.id]?.academic_year ?? m.academic_year ?? "";const list = approved.filter((m) => (year === "all" || yearOf(m) === year) && m.full_name.includes(q));
async function saveAdj() {if (!adj || !reason.trim() || !amount) return toast.error("اكتب المقدار والسبب");const { data: { user } } = await supabase.auth.getUser();const { error } = await supabase.from("point_adjustments").insert({ user_id: adj.id, amount, reason: reason.trim(), admin_id: user!.id });if (error) return toast.error(error.message);toast.success("تم تعديل النقاط وتسجيل السبب"); setAdj(null); setReason(""); qc.invalidateQueries();}
return (
{[["all", "الكل", approved.length], ...ACADEMIC_YEARS.map((y) => [y, فصل ${y}, approved.filter((m) => yearOf(m) === y).length])].map(([k, label, n]) => (<button key={k as string} onClick={() => setYear(k as string)} className={pop rounded-2xl p-3 text-center font-extrabold ${year === k ? "bg-primary text-primary-foreground" : "bg-muted"}}>
{label}
{n as number}
))}
<Input placeholder="بحث بالاسم..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /><AddMemberButton defaultYear={year !== "all" ? year : undefined} />
{list.length === 0 &&
لا يوجد مخدومون في هذا الفصل.
}{list.map((m) => (
{m.avatar}
<button onClick={() => setHist({ id: m.id, name: m.full_name })} className="font-bold text-primary underline-offset-4 hover:underline" title="سجل الافتقادات">{m.full_name}
{yearOf(m)} {m.class_name ?? ""}
النقاط
{m.points}
الرصيد
{m.balance}
<button onClick={() => setOpen(open === m.id ? null : m.id)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">التفاصيل<button onClick={() => setEdit({ id: m.id, full_name: m.full_name, academic_year: yearOf(m) || "أولى إعدادي" })} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground">✏️ تعديل<button onClick={() => { setAdj(m); setAmount(10); }} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">± النقاط<button onClick={() => removeMember(m.id, m.full_name, () => qc.invalidateQueries())} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">🗑️ حذف
{open === m.id && pmap[m.id] && }
))}
<VisitHistoryDialog member={hist} onClose={() => setHist(null)} /><PersonDialog person={edit} mode={edit ? "edit" : null} onClose={() => setEdit(null)} /><Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>تعديل نقاط {adj?.full_name}المقدار (سالب للخصم)<Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />السبب (مطلوب)<Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مساعدة في تنظيم الحفل" />حفظ
);}

/* ---------- Activities review ---------- /function Activities() {const qc = useQueryClient();const { data: members } = useMembers();const { data: settings } = useSettings();const names = nameMap(members);const [review, setReview] = useState<{ id: string; points: number; status: string } | null>(null);const [reason, setReason] = useState("");const { data } = useQuery({queryKey: ["admin-logs"],queryFn: async () => (await supabase.from("activity_logs").select("").order("created_at", { ascending: false }).limit(200)).data ?? [],});const save = useMutation({mutationFn: async () => {const { error } = await supabase.rpc("admin_review_log", { _log_id: review!.id, _points: review!.points, _status: review!.status, _reason: reason });if (error) throw error;},onSuccess: () => { toast.success("تم الحفظ في السجل"); setReview(null); setReason(""); qc.invalidateQueries(); },onError: (e) => toast.error((e as Error).message),});const s = Object.fromEntries((settings ?? []).map((x) => [x.key, x]));return (
{data?.map((l) => (<div key={l.id} className={${card} flex flex-wrap items-center gap-3}>{s[l.activity]?.emoji}
{names[l.user_id]?.full_name} · {s[l.activity]?.label}
الأسبوع {l.week} · {MONTHS[l.month - 1]} {l.year} · سُجّل {cairoDate(l.created_at)}
{l.verse &&
«{l.verse}»
}{l.admin_note &&
ملاحظة: {l.admin_note}
}
<span className={rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "approved" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}}>{l.status === "approved" ? ${l.points} نقطة : "مرفوض"}<button onClick={() => { setReview({ id: l.id, points: l.points, status: l.status }); setReason(""); }} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">مراجعة
))}<Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>مراجعة الإنجاز{review && (<>
{(["approved", "rejected"] as const).map((st) => (<button key={st} onClick={() => setReview({ ...review, status: st })} className={flex-1 rounded-xl py-2 font-bold ${review.status === st ? (st === "approved" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground") : "bg-muted"}}>{st === "approved" ? "مقبول" : "مرفوض"}))}
النقاط<Input type="number" min={0} value={review.points} onChange={(e) => setReview({ ...review, points: Math.max(0, parseInt(e.target.value) || 0) })} />سبب التغيير (مطلوب)<Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /><button disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()} className="rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-50">حفظ</>)});}

/* ---------- Redemptions ---------- /function Redemptions() {const qc = useQueryClient();const { data: members } = useMembers();const names = nameMap(members);const [filter, setFilter] = useState("pending");const { data } = useQuery({queryKey: ["admin-red"],queryFn: async () => (await supabase.from("redemptions").select(", gifts(name, emoji)").order("created_at", { ascending: false })).data ?? [],});const set = async (id: string, status: string) => {const note = status === "rejected" ? prompt("سبب الرفض؟") ?? "" : null;const { error } = await supabase.rpc("admin_set_redemption", { _id: id, _status: status, _note: note as string });if (error) return toast.error(error.message);toast.success(تم التحديث: ${REDEEM_STATUS[status].label}); qc.invalidateQueries();};const list = data?.filter((r) => filter === "all" || r.status === filter) ?? [];return (
{[["pending", "قيد المراجعة"], ["approved", "مقبول"], ["delivered", "تم التسليم"], ["rejected", "مرفوض"], ["all", "الكل"]].map(([k, l]) => (<button key={k} onClick={() => setFilter(k)} className={rounded-xl px-3 py-1.5 text-sm font-bold ${filter === k ? "bg-secondary text-secondary-foreground" : "bg-card"}}>{l} ({k === "all" ? data?.length ?? 0 : data?.filter((r) => r.status === k).length ?? 0})))}
{!list.length &&
لا توجد طلبات.
}
{list.map((r) => (<div key={r.id} className={${card} flex flex-wrap items-center gap-3}>{r.gifts?.emoji}
{names[r.user_id]?.full_name} طلب {r.gifts?.name}
{r.cost} نقطة · {cairoDate(r.created_at)}{r.admin_note ? · ${r.admin_note} : ""}
<span className={rounded-full px-3 py-1 text-xs font-bold ${REDEEM_STATUS[r.status]?.cls}}>{REDEEM_STATUS[r.status]?.label}{r.status === "pending" && <button onClick={() => set(r.id, "approved")} className="rounded-xl bg-sky px-3 py-1.5 text-sm font-bold text-primary-foreground">قبول}{(r.status === "pending" || r.status === "approved") && <button onClick={() => set(r.id, "delivered")} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground">تم التسليم}{r.status !== "rejected" && r.status !== "delivered" && <button onClick={() => set(r.id, "rejected")} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">رفض}
))}
);}

/* ---------- Adjustments log ---------- /function AdjLog() {const { data: members } = useMembers();const names = nameMap(members);const [who, setWho] = useState("");const { data } = useQuery({queryKey: ["admin-adj"],queryFn: async () => (await supabase.from("point_adjustments").select("").order("created_at", { ascending: false }).limit(300)).data ?? [],});const list = data?.filter((a) => !who || a.user_id === who) ?? [];return (
<select value={who} onChange={(e) => setWho(e.target.value)} className="mb-3 h-9 rounded-md border border-input bg-card px-2 text-sm">كل الأعضاء{members?.map((m) => {m.full_name})}{!list.length &&
لا توجد تعديلات بعد.
}
p-2 text-center font-bold ${a.amount >= 0 ? "text-accent" : "text-destructive"}{list.map((a) => (<td className={}>{a.amount > 0 ? "+" : ""}{a.amount}))}
التاريخ	العضو	التغيير	السبب	المشرف	النوع
{cairoDate(a.created_at)}	{names[a.user_id]?.full_name}	{a.reason}	{a.admin_id ? names[a.admin_id]?.full_name : ""}	{a.log_id ? "مراجعة إنجاز" : "تعديل يدوي"}	
);}

/* ---------- Gifts ---------- /function Gifts() {const qc = useQueryClient();const { data } = useQuery({ queryKey: ["admin-gifts"], queryFn: async () => (await supabase.from("gifts").select("").order("cost")).data ?? [] });const [f, setF] = useState({ name: "", emoji: "🎁", description: "", cost: 100, stock: 10 });const add = async () => {if (!f.name.trim()) return toast.error("اكتب اسم الهدية");const { error } = await supabase.from("gifts").insert(f);if (error) return toast.error(error.message);setF({ name: "", emoji: "🎁", description: "", cost: 100, stock: 10 }); qc.invalidateQueries();};const upd = async (id: string, patch: Record<string, unknown>) => {const { error } = await supabase.from("gifts").update(patch).eq("id", id);if (error) toast.error(error.message); else qc.invalidateQueries();};return (
<div className={${card} grid gap-2 md:grid-cols-6}><Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} placeholder="🎁" /><Input className="md:col-span-2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم الهدية" /><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} placeholder="النقاط" /><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} placeholder="الكمية" />+ إضافة<Input className="md:col-span-6" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="وصف (اختياري)" />
{data?.map((g) => (<div key={g.id} className={${card} flex flex-wrap items-center gap-3 ${g.active ? "" : "opacity-50"}}>{g.emoji}{g.name}النقاط <Input type="number" className="w-24" defaultValue={g.cost} onBlur={(e) => +e.target.value !== g.cost && upd(g.id, { cost: +e.target.value })} />الكمية <Input type="number" className="w-20" defaultValue={g.stock} onBlur={(e) => +e.target.value !== g.stock && upd(g.id, { stock: +e.target.value })} /><button onClick={() => upd(g.id, { active: !g.active })} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">{g.active ? "إخفاء" : "إظهار"}))});}

/* ---------- Badges & activity points ---------- /function BadgesAndPoints() {const qc = useQueryClient();const { data: settings } = useSettings();const { data: badges } = useQuery({ queryKey: ["badges"], queryFn: async () => (await supabase.from("badges").select("").order("threshold")).data ?? [] });const [f, setF] = useState({ name: "", emoji: "🏅", description: "", threshold: 100 });const [na, setNa] = useState({ label: "", emoji: "⭐", points: 10 });const addActivity = async () => {if (!na.label.trim()) return toast.error("اكتب اسم النشاط");const key = "a_" + Date.now().toString(36);const { error } = await supabase.from("activity_settings").insert({ key, label: na.label.trim(), emoji: na.emoji ||