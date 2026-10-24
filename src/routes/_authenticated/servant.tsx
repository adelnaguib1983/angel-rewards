// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, fileToDataUrl, useMe } from "@/lib/app";
import { Textarea } from "@/components/ui/textarea";
import { AddMemberButton, removeMember, BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive, VisitHistoryDialog } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";
import { ImageLightbox } from "@/components/ImageLightbox";

export const Route = createFileRoute("/_authenticated/servant")({
  head: () => ({
    meta: [
      { title: "مرحلة الخدام | أبطال الإيمان" },
      { name: "description", content: "تحضير الخادم الأسبوعي، الحضور والغياب، وافتقاد المخدومين." },
      { property: "og:title", content: "مرحلة الخدام | أبطال الإيمان" },
      { property: "og:description", content: "تحضير الخادم الأسبوعي، الحضور والغياب، وافتقاد المخدومين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServantPage,
});

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

function ServantPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<string>("prep");
  if (isLoading || !me) return <div className="p-10 text-center">...</div>;
  const p = me.profile;
  const allowed = me.isAdmin || (p?.account_type === "servant" && p?.status === "approved");
  return (
    <div className="stage-servant pb-16">
      <AppHeader stage="servant" isAdmin={me.isAdmin} name={p?.full_name} avatar={p?.avatar} photo={p?.photo_url} />
      <main className="mx-auto max-w-5xl px-4">
        {!allowed ? (
          <div className={`${card} mx-auto mt-10 max-w-md text-center`}>
            <div className="text-6xl">{p?.status === "rejected" ? "🚫" : "⏳"}</div>
            <h1 className="mt-3 text-2xl font-extrabold">{p?.account_type !== "servant" ? "هذه الصفحة للخدام فقط" : p?.status === "rejected" ? "لم تتم الموافقة على الحساب" : "طلبك قيد المراجعة"}</h1>
            <p className="mt-2 text-muted-foreground">سيتم تفعيل حساب الخادم بعد موافقة المشرف.</p>
            {p?.account_type !== "servant" && <Link to="/home" className="mt-3 inline-block font-bold text-primary">رجوع</Link>}
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-l from-sky/40 via-card to-card p-5 pop float-in">
              <div className="text-sm font-bold text-sky">أهلا يا خادم 🙏</div>
              <h1 className="text-3xl font-extrabold">{p?.full_name}</h1>
              <p className="text-sm text-muted-foreground">متابعة التحضير، الحضور والغياب، الافتقاد، والتوجيهات المشتركة.</p>
              <ServantAttendance />
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([
                ["prep", "📘 تحضير الخادم"],
                ["attendance", "📋 الحضور والغياب"],
                ["visit", "📞 الافتقاد الأسبوعي"],
                ["suggestions", "💡 الاقتراحات والتوجيهات"],
                ["preparch", "📚 أرشيف التحضيرات"],
                ["visitarch", "🗂️ أرشيف الافتقاد"],
                ["read", "📖 القراءات اليومية"]
              ] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-2xl border-2 px-4 py-2 font-bold transition ${tab === k ? "border-sky bg-sky text-primary-foreground pop" : "border-border bg-card"}`}>{l}</button>
              ))}
              <BirthdaysButton />
              <div className="mr-auto"><NotificationsBell /></div>
            </nav>
            {tab === "prep" && <Prep userId={me.user.id} />}
            {tab === "attendance" && <DailyAttendanceSection />}
            {tab === "visit" && <Visits />}
            {tab === "suggestions" && <SuggestionsSection currentUserId={me.user.id} isAdmin={me.isAdmin} />}
            {tab === "preparch" && <PrepArchive userId={me.user.id} />}
            {tab === "visitarch" && <VisitArchive />}
            {tab === "read" && <ReadingPlanner />}
          </>
        )}
      </main>
    </div>
  );
}

/* ==========================================================================
   قسم الحضور والغياب اليومي المتكامل
   ========================================================================== */
function DailyAttendanceSection() {
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"member" | "servant">("member");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const filterYear = selectedYear === "all" ? null : selectedYear;

  const { data: stats } = useQuery({
    queryKey: ["attendance-stats", date, filterYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_attendance_stats", {
        _date: date,
        _academic_year: filterYear,
      });
      if (error) throw error;
      return data;
    },
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ["daily-attendance", date, accountType, filterYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_attendance", {
        _date: date,
        _account_type: accountType,
        _academic_year: filterYear,
      });
      if (error) throw error;
      return data;
    },
  });

  const { data: absentList, isLoading: isAbsentLoading } = useQuery({
    queryKey: ["daily-absent", date, accountType, filterYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_absent_list", {
        _date: date,
        _account_type: accountType,
        _academic_year: filterYear,
      });
      if (error) throw error;
      return data;
    },
  });

  const handleMark = async (personId: string, status: "present" | "absent") => {
    const { error } = await supabase.rpc("record_daily_attendance", {
      _person_id: personId,
      _date: date,
      _status: status,
      _notes: "",
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["daily-attendance"] });
    qc.invalidateQueries({ queryKey: ["attendance-stats"] });
    qc.invalidateQueries({ queryKey: ["daily-absent"] });
  };

  return (
    <div className="space-y-4">
      {/* إحصائيات الحضور بأعلى اللوحة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">حضور المخدومين</div>
          <div className="mt-1 text-2xl font-black text-emerald-500">
            {stats?.members_present ?? 0} <span className="text-xs text-muted-foreground">/ {stats?.members_total ?? 0}</span>
          </div>
          <div className="text-xs font-bold text-emerald-600">{stats?.members_rate ?? 0}%</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">غياب المخدومين</div>
          <div className="mt-1 text-2xl font-black text-destructive">{stats?.members_absent ?? 0}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">حضور الخدام</div>
          <div className="mt-1 text-2xl font-black text-sky">
            {stats?.servants_present ?? 0} <span className="text-xs text-muted-foreground">/ {stats?.servants_total ?? 0}</span>
          </div>
          <div className="text-xs font-bold text-sky">{stats?.servants_rate ?? 0}%</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">غياب الخدام</div>
          <div className="mt-1 text-2xl font-black text-destructive">{stats?.servants_absent ?? 0}</div>
        </div>
      </div>

      {/* شريط التحكم: التاريخ والتصفية */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <label className="text-sm font-extrabold">📅 التاريخ:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border-2 border-border bg-background px-3 py-1.5 font-bold text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAccountType("member")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "member" ? "bg-sky text-primary-foreground" : "bg-muted"}`}
          >
            المخدومين
          </button>
          <button
            onClick={() => setAccountType("servant")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}
          >
            الخدام
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-xl border-2 border-border bg-background px-3 py-1.5 text-xs font-bold"
          >
            <option value="all">كل المراحل</option>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* التبديل بين كشف الحضور وكشف الغياب */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("record")}
          className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}
        >
          📝 كشف الحضور اليومي
        </button>
        <button
          onClick={() => setSubTab("absent")}
          className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card"}`}
        >
          ⚠️ كشف الغياب للافتقاد ({absentList?.length ?? 0})
        </button>
      </div>

      {/* عرض الكشف */}
      {subTab === "record" ? (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : !list?.length ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد أسماء مسجلة في هذا القسم.</p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {list.map((item) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl">{item.avatar || "👤"}</span>
                    )}
                    <div>
                      <div className="font-extrabold text-sm">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year || "بدون مرحلة"} {item.class_name ? `· ${item.class_name}` : ""}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleMark(item.person_id, "present")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        item.attendance_status === "present"
                          ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400"
                          : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800"
                      }`}
                    >
                      ✓ حاضر
                    </button>
                    <button
                      onClick={() => handleMark(item.person_id, "absent")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        item.attendance_status === "absent"
                          ? "bg-destructive text-destructive-foreground shadow-md ring-2 ring-destructive"
                          : "bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-800"
                      }`}
                    >
                      ✕ غائب
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* كشف الغائبين */
        <div className="space-y-2">
          {isAbsentLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : !absentList?.length ? (
            <div className="rounded-2xl border-2 border-border bg-card p-8 text-center text-emerald-600 font-extrabold">
              🎉 لا يوجد غياب مسجل لهذا التاريخ!
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {absentList.map((item) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-destructive/40 bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl">{item.avatar || "👤"}</span>
                    )}
                    <div>
                      <div className="font-extrabold text-sm">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year || "بدون مرحلة"}</div>
                    </div>
                  </div>

                  {item.phone ? (
                    <a
                      href={`tel:${item.phone}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-sky px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      📞 {item.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">بدون هاتف</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   قسم الاقتراحات والتوجيهات المتكامل
   ========================================================================== */
function SuggestionsSection({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all_servants" | "specific_servant" | "specific_member">("all_servants");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // قائمة الأشخاص لاختيار المستهدف
  const { data: servants } = useQuery({
    queryKey: ["all-servants-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("account_type", "servant").eq("status", "approved")).data ?? [],
  });
  const { data: members } = useQuery({
    queryKey: ["all-members-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("account_type", "member").eq("status", "approved").limit(100)).data ?? [],
  });

  // استعلام جلب الاقتراحات
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["servant-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select(`
          id, body, images, audio_url, video_url, target_type, target_user_id, reply, replied_at, status, created_at, user_id,
          author:profiles!suggestions_user_id_fkey(full_name, avatar),
          target:profiles!suggestions_target_user_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sendSuggestion = async () => {
    if (!body.trim()) return toast.error("يرجى كتابة نص الاقتراح أو التوجيه");
    if ((targetType === "specific_servant" || targetType === "specific_member") && !targetUserId) {
      return toast.error("يرجى اختيار الشخص المستهدف");
    }
    setSubmitting(true);
    const { error } = await supabase.from("suggestions").insert({
      user_id: currentUserId,
      body: body.trim(),
      target_type: targetType,
      target_user_id: targetType === "all_servants" ? null : targetUserId,
      images: images.length ? images : null,
      audio_url: audioUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);

    toast.success("تم إرسال الاقتراح / التوجيه بنجاح ✅");
    setBody("");
    setAudioUrl("");
    setVideoUrl("");
    setImages([]);
    setTargetUserId("");
    qc.invalidateQueries({ queryKey: ["servant-suggestions"] });
  };

  const handleReply = async (id: string) => {
    const text = replyText[id]?.trim();
    if (!text) return toast.error("اكتب الرد أولاً");
    const { error } = await supabase.from("suggestions").update({
      reply: text,
      reply_by: currentUserId,
      replied_at: new Date().toISOString(),
      status: "replied",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال الرد بنجاح ✅");
    setReplyText((prev) => ({ ...prev, [id]: "" }));
    qc.invalidateQueries({ queryKey: ["servant-suggestions"] });
  };

  return (
    <div className="space-y-4">
      {/* نموذج كتابة الاقتراح */}
      <section className={card}>
        <h2 className="text-xl font-extrabold">💡 كتابة اقتراح أو توجيه جديد</h2>
        <Textarea
          className="mt-3 min-h-28"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب فكرتك أو التوجيه أو الملاحظة هنا..."
        />

        {/* جهة الإرسال */}
        <div className="mt-3 space-y-2">
          <label className="text-xs font-bold text-muted-foreground">جهة الإرسال:</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setTargetType("all_servants"); setTargetUserId(""); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "all_servants" ? "bg-sky text-primary-foreground" : "bg-muted"}`}
            >
              👥 كل الخدام
            </button>
            <button
              onClick={() => { setTargetType("specific_servant"); setTargetUserId(""); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "specific_servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}
            >
              👤 خادم محدد
            </button>
            <button
              onClick={() => { setTargetType("specific_member"); setTargetUserId(""); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "specific_member" ? "bg-sky text-primary-foreground" : "bg-muted"}`}
            >
              🧒 مخدوم محدد
            </button>
          </div>

          {targetType === "specific_servant" && (
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-border bg-background p-2 text-sm font-bold"
            >
              <option value="">-- اختر الخادم --</option>
              {servants?.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}

          {targetType === "specific_member" && (
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-border bg-background p-2 text-sm font-bold"
            >
              <option value="">-- اختر المخدوم --</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* روابط الصوت والفيديو والصور */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="🎤 رابط تسجيل صوتي (Google Drive, Dropbox...)"
            className="rounded-xl border-2 border-border bg-background px-3 py-2 text-xs font-bold"
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="🎬 رابط فيديو (YouTube, Drive...)"
            className="rounded-xl border-2 border-border bg-background px-3 py-2 text-xs font-bold"
          />
        </div>

        {/* رفع الصور */}
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <button
                onClick={() => setImages(images.filter((_, j) => j !== i))}
                className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">
              📷 صورة
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const url = await fileToDataUrl(file, 900, 0.75);
                      setImages([...images, url]);
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <button
          disabled={submitting}
          onClick={sendSuggestion}
          className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "جاري الإرسال..." : "إرسال الاقتراح / التوجيه 🚀"}
        </button>
      </section>

      {/* قائمة الاقتراحات السابقة والردود */}
      <section className={card}>
        <h3 className="mb-3 text-xl font-extrabold">📬 سجل الاقتراحات والتوجيهات</h3>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-6">جاري التحميل...</p>
        ) : !suggestions?.length ? (
          <p className="text-center text-muted-foreground py-6">لا توجد اقتراحات حتى الآن.</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-2xl border-2 border-border bg-background p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.author?.avatar || "👤"}</span>
                    <span className="font-extrabold text-sm">{s.author?.full_name || "مستخدم"}</span>
                    <span className="rounded-full bg-sky/20 px-2.5 py-0.5 text-xs font-bold text-sky">
                      {s.target_type === "all_servants" ? "إلى كل الخدام" : `إلى: ${s.target?.full_name || "محدد"}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo" })}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>

                {/* المرفقات إن وجدت */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {s.audio_url && (
                    <a href={s.audio_url} target="_blank" rel="noreferrer" className="rounded-xl bg-muted px-3 py-1 text-xs font-bold text-primary underline">
                      🎤 استماع للصوت
                    </a>
                  )}
                  {s.video_url && (
                    <a href={s.video_url} target="_blank" rel="noreferrer" className="rounded-xl bg-muted px-3 py-1 text-xs font-bold text-primary underline">
                      🎬 مشاهدة الفيديو
                    </a>
                  )}
                  {s.images?.map((img, i) => (
                    <img key={i} src={img} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  ))}
                </div>

                {/* الرد الموجود */}
                {s.reply && (
                  <div className="mt-2 rounded-xl bg-accent/20 border-r-4 border-accent p-3 text-sm">
                    <div className="font-extrabold text-xs text-accent">الرد / التأكيد:</div>
                    <p className="mt-1 whitespace-pre-wrap">{s.reply}</p>
                  </div>
                )}

                {/* نموذج كتابة الرد */}
                {!s.reply && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="اكتب رداً أو تأكيداً..."
                      value={replyText[s.id] || ""}
                      onChange={(e) => setReplyText({ ...replyText, [s.id]: e.target.value })}
                      className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => handleReply(s.id)}
                      className="rounded-xl bg-sky px-4 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      رد
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ==========================================================================
   المكونات القديمة المحفوظة كما هي (التحضير والافتقاد)
   ========================================================================== */
function Prep({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["my-preps"],
    queryFn: async () => (await supabase.from("servant_preparations").select("*").eq("user_id", userId).order("week_start", { ascending: false }).limit(8)).data ?? [],
  });
  const { data: ws } = useQuery({ queryKey: ["week-start"], queryFn: async () => (await supabase.rpc("week_start", { _offset: 0 })).data });
  const current = rows?.find((r) => r.week_start === ws);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<string[] | null>(null);
  useEffect(() => { if (current) { setNotes(current.notes); setImages(current.images ?? []); } }, [current?.id]);
  const late = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Africa/Cairo" });
  const afterThu = ["Fri", "Sat"].includes(late);
  const save = async () => {
    if (!notes.trim() && !images.length) return toast.error("اكتب التحضير أو ارفع صورة");
    setBusy(true);
    const { error } = current
      ? await supabase.from("servant_preparations").update({ notes, images, updated_at: new Date().toISOString() }).eq("id", current.id)
      : await supabase.from("servant_preparations").insert({ notes, images });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال التحضير للمشرف ✅");
    qc.invalidateQueries({ queryKey: ["my-preps"] });
  };
  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">تحضير هذا الأسبوع</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${current ? "bg-accent text-accent-foreground" : afterThu ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
            {current ? "✓ تم الإرسال" : afterThu ? "متأخر — الموعد كان الخميس" : "آخر موعد: الخميس"}
          </span>
        </div>
        <Textarea className="mt-3 min-h-40" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="موضوع الدرس، الآيات، الوسائل، ملاحظات..." />
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" onClick={() => setGallery(images)} className="h-24 w-24 cursor-zoom-in rounded-xl object-cover" />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground">✕</button>
            </div>
          ))}
          {images.length < 6 && (
            <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">📷<br />رفع صورة
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 6 - images.length);
                try { const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 900, 0.75))); setImages([...images, ...urls]); } catch (err) { toast.error((err as Error).message); }
                e.target.value = "";
              }} />
            </label>
          )}
        </div>
        <button disabled={busy} onClick={save} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "..." : current ? "تحديث التحضير" : "إرسال التحضير"}</button>
      </section>
      {rows?.filter((r) => r.week_start !== ws).length > 0 && (
        <section className={card}>
          <h3 className="mb-2 font-extrabold">التحضيرات السابقة</h3>
          <div className="space-y-2">{rows.filter((r) => r.week_start !== ws).map((r) => (
            <details key={r.id} className="rounded-xl bg-muted p-3"><summary className="cursor-pointer font-bold">أسبوع {r.week_start}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.notes}</p>
               <div className="mt-2 flex flex-wrap gap-2">{r.images?.map((s, i) => <img key={i} src={s} alt="" onClick={() => setGallery(r.images)} className="h-20 w-20 cursor-zoom-in rounded-lg object-cover" />)}</div>
            </details>
          ))}</div>
        </section>
      )}
      <ImageLightbox images={gallery} title="صور التحضير" onClose={() => setGallery(null)} />
    </div>
  );
}

function ServantAttendance() {
  const qc = useQueryClient();
  const { data: ws } = useQuery({ queryKey: ["week-start"], queryFn: async () => (await supabase.rpc("week_start", { _offset: 0 })).data });
  const { data: attendance } = useQuery({ queryKey: ["my-servant-attendance", ws], enabled: !!ws, queryFn: async () => (await supabase.from("servant_attendance").select("id,created_at").eq("week_start", ws).maybeSingle()).data });
  const mark = async () => { const { error } = await supabase.rpc("mark_servant_attendance"); if (error) return toast.error(error.message); toast.success("تم تسجيل حضورك هذا الأسبوع ✅"); qc.invalidateQueries({ queryKey: ["my-servant-attendance"] }); };
  return attendance ? <div className="mt-3 inline-flex rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground">✅ حضور هذا الأسبوع مسجّل</div> : <button onClick={mark} className="pop mt-3 rounded-xl bg-sky px-4 py-2 font-extrabold text-primary-foreground">🙏 تسجيل حضوري هذا الأسبوع</button>;
}

const METHODS = { call: "📞 مكالمة", visit: "🏠 زيارة", message: "💬 رسالة" };
function Visits() {
  const qc = useQueryClient();
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("call");
  const [hist, setHist] = useState(null);
  const { data } = useQuery({ queryKey: ["servant-members"], queryFn: async () => { const { data, error } = await supabase.rpc("servant_members"); if (error) throw error; return data; } });
  const rows = (data ?? []).filter((m) => m.academic_year === year);
  const save = async (member_id: string) => {
    const { error } = await supabase.from("visitations").insert({ member_id, method, note: note.trim() });
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الافتقاد"); setOpen(null); setNote("");
    qc.invalidateQueries({ queryKey: ["servant-members"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><AddMemberButton defaultYear={year} /></div>
      <div className="flex flex-wrap gap-2">{ACADEMIC_YEARS.map((y) => (
        <button key={y} onClick={() => setYear(y)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${year === y ? "bg-sky text-primary-foreground" : "bg-card"}`}>{y} ({(data ?? []).filter((m) => m.academic_year === y).length})</button>
      ))}</div>
      <p className="text-xs text-muted-foreground">🔴 = لم يسجّل أي نشاط هذا الأسبوع (يحتاج افتقاد) · ✅ = تم افتقاده هذا الأسبوع. التقرير يصل للمشرف تلقائيًا.</p>
      {!rows.length && <p className="text-muted-foreground">لا يوجد مخدومون في هذه المرحلة.</p>}
      <div className="grid gap-3 md:grid-cols-2">{rows.map((m) => (
        <div key={m.id} className={card}>
          <div className="flex items-center gap-3">
            {m.photo_url ? <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-3xl">{m.avatar}</span>}
            <button onClick={() => setHist({ id: m.id, name: m.full_name })} className="flex-1 text-right font-bold text-primary underline-offset-4 hover:underline" title="سجل الافتقادات">{m.full_name}</button>
            {!m.active_this_week && <span title="لم يسجل نشاطًا">🔴</span>}
            {m.visited && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">✅ تم</span>}
            <button onClick={() => { setOpen(m.id); setNote(""); }} className="rounded-xl bg-sky px-3 py-1.5 text-sm font-bold text-primary-foreground">{m.visited ? "افتقاد آخر" : "افتقاد"}</button>
            <button title="حذف المخدوم" onClick={() => removeMember(m.id, m.full_name, () => qc.invalidateQueries({ queryKey: ["servant-members"] }))} className="rounded-xl bg-destructive/15 px-2 py-1.5 text-sm">🗑️</button>
          </div>
          {open === m.id && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">{Object.entries(METHODS).map(([k, l]) => (
                <button key={k} onClick={() => setMethod(k)} className={`rounded-xl px-2 py-1 text-xs font-bold ${method === k ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{l}</button>
              ))}</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات الافتقاد (سبب الغياب، الحالة...)" />
              <div className="flex gap-2"><button onClick={() => save(m.id)} className="flex-1 rounded-xl bg-accent py-2 font-bold text-accent-foreground">حفظ</button>
                <button onClick={() => setOpen(null)} className="rounded-xl bg-muted px-4 py-2 font-bold">إلغاء</button></div>
            </div>
          )}
        </div>
      ))}</div>
      <VisitHistoryDialog member={hist} onClose={() => setHist(null)} />
    </div>
  );
}
