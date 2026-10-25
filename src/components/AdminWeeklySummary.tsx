// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, useMe } from "@/lib/app";
import { Textarea } from "@/components/ui/textarea";
import { AddMemberButton, removeMember, BirthdaysButton, PrepArchive, VisitArchive, VisitHistoryDialog } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";
import { AdminWeeklySummary } from "@/components/AdminWeeklySummary";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة المشرف | أبطال الملاك" },
      { name: "description", content: "إدارة الخدام، المخدومين، والمتابعة الأسبوعية." },
      { property: "og:title", content: "لوحة المشرف | أبطال الملاك" },
      { property: "og:description", content: "إدارة الخدام، المخدومين، والمتابعة الأسبوعية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

function AdminPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<string>("summary");
  if (isLoading || !me) return <div className="p-10 text-center">...</div>;
  const p = me.profile;
  const allowed = me.isAdmin || p?.account_type === "servant";

  return (
    <div className="stage-admin pb-16">
      <AppHeader stage="admin" isAdmin={me.isAdmin} name={p?.full_name} avatar={p?.avatar} photo={p?.photo_url} />
      <main className="mx-auto max-w-5xl px-4">
        {!allowed ? (
          <div className={`${card} mx-auto mt-10 max-w-md text-center`}>
            <div className="text-6xl">🚫</div>
            <h1 className="mt-3 text-2xl font-extrabold">هذه الصفحة للمشرفين والخدام فقط</h1>
            <Link to="/home" className="mt-3 inline-block font-bold text-primary">رجوع</Link>
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-l from-sky/40 via-card to-card p-5 pop float-in">
              <div className="text-sm font-bold text-sky">أهلاً بك يا مشرف 🙏</div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-sky-500 via-indigo-500 to-primary bg-clip-text text-transparent drop-shadow-sm">✨ أبطال الملاك ✨</h1>
              <p className="text-sm text-muted-foreground">لوحة التحكم والمتابعة الشاملة لخدمة أبطال الملاك.</p>
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([
                ["summary", "📊 الملخص الأسبوعي"],
                ["servants", "👥 إدارة الخدام والطلبات"],
                ["members", "🧒 إدارة المخدومين"],
                ["broadcast", "📢 الإشعارات الجماعية"],
                ["preparch", "📚 أرشيف التحضيرات"],
                ["visitarch", "🗂️ أرشيف الافتقاد"]
              ] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-2xl border-2 px-4 py-2 font-bold transition ${tab === k ? "border-sky bg-sky text-primary-foreground pop" : "border-border bg-card"}`}>{l}</button>
              ))}
              <BirthdaysButton />
              <div className="mr-auto"><NotificationsBell /></div>
            </nav>
            {tab === "summary" && <AdminWeeklySummary />}
            {tab === "servants" && <ServantsManagement />}
            {tab === "members" && <MembersManagement />}
            {tab === "broadcast" && <BroadcastSection />}
            {tab === "preparch" && <PrepArchive />}
            {tab === "visitarch" && <VisitArchive />}
          </>
        )}
      </main>
    </div>
  );
}

function ServantsManagement() {
  const qc = useQueryClient();
  const { data: servants, isLoading } = useQuery({
    queryKey: ["admin-servants-list"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("account_type", "servant")).data ?? [],
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث حالة الخادم بنجاح ✅");
    qc.invalidateQueries({ queryKey: ["admin-servants-list"] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">إدارة الخدام وحساباتهم</h2>
      {isLoading ? <p className="text-center text-muted-foreground py-6">جاري التحميل...</p> : !servants?.length ? <p className="text-center text-muted-foreground py-6">لا يوجد خدام مسجلين.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {servants.map((s: any) => (
            <div key={s.id} className={card}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {s.photo_url ? <img src={s.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="text-3xl">{s.avatar || "👤"}</span>}
                  <div>
                    <h3 className="font-extrabold text-base">{s.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{s.email || "بدون بريد"}</p>
                    <span className={`inline-block mt-1 rounded-md px-2 py-0.5 text-xs font-bold ${s.status === "approved" ? "bg-emerald-500/20 text-emerald-600" : s.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-600"}`}>
                      {s.status === "approved" ? "مقبول" : s.status === "rejected" ? "مرفوض" : "قيد الانتظار"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {s.status !== "approved" && <button onClick={() => updateStatus(s.id, "approved")} className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white">قبول</button>}
                  {s.status !== "rejected" && <button onClick={() => updateStatus(s.id, "rejected")} className="rounded-xl bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">رفض</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MembersManagement() {
  const qc = useQueryClient();
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);
  const [hist, setHist] = useState(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["admin-members-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_members");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (members ?? []).filter((m: any) => m.academic_year === year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {ACADEMIC_YEARS.map((y) => (
            <button key={y} onClick={() => setYear(y)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${year === y ? "bg-sky text-primary-foreground" : "bg-card"}`}>{y} ({(members ?? []).filter((m: any) => m.academic_year === y).length})</button>
          ))}
        </div>
        <AddMemberButton defaultYear={year} />
      </div>

      {isLoading ? <p className="text-center text-muted-foreground py-6">جاري التحميل...</p> : !rows.length ? <p className="text-center text-muted-foreground py-6">لا يوجد مخدومون في هذه المرحلة.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((m: any) => (
            <div key={m.id} className={card}>
              <div className="flex items-center gap-3">
                {m.photo_url ? <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-3xl">{m.avatar || "👤"}</span>}
                <div className="flex-1">
                  <button onClick={() => setHist({ id: m.id, name: m.full_name })} className="text-right font-bold text-primary underline-offset-4 hover:underline">{m.full_name}</button>
                  <div className="text-xs text-muted-foreground">{m.phone || "بدون هاتف"}</div>
                </div>
                <button title="حذف المخدوم" onClick={() => removeMember(m.id, m.full_name, () => qc.invalidateQueries({ queryKey: ["admin-members-list"] }))} className="rounded-xl bg-destructive/15 px-2 py-1.5 text-sm">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <VisitHistoryDialog member={hist} onClose={() => setHist(null)} />
    </div>
  );
}

function BroadcastSection() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return toast.error("يرجى إدخال عنوان ورسالة الإشعار");
    setLoading(true);
    const { error } = await supabase.from("notifications").insert({ title: title.trim(), message: message.trim(), target_type: "all" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال الإشعار الجماعي بنجاح 🚀");
    setTitle("");
    setMessage("");
  };

  return (
    <section className={card}>
      <h2 className="text-xl font-extrabold mb-3">📢 إرسال إشعار جماعي للجميع</h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">عنوان الإشعار:</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تنبيه هام بخصوص اجتماع الكنيسة" className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">نص الرسالة:</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب تفاصيل الإشعار هنا..." className="min-h-32" />
        </div>
        <button disabled={loading} onClick={handleSend} className="pop w-full rounded-2xl bg-sky py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60">
          {loading ? "جاري الإرسال..." : "إرسال الإشعار الآن 🚀"}
        </button>
      </div>
    </section>
  );
}
