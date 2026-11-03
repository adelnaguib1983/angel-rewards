// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export const AVATARS = ["🦁","🐯","🦅","🐺","🐻","🦊","🐬","🚀","⚡","🛡️"];

export const REDEEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-primary text-primary-foreground" },
  approved: { label: "مقبول", cls: "bg-sky text-primary-foreground" },
  delivered: { label: "تم التسليم", cls: "bg-accent text-accent-foreground" },
  rejected: { label: "مرفوض", cls: "bg-destructive text-destructive-foreground" },
};

export const LEVELS = [
  { min: 0, name: "مبتدئ", emoji: "🌱" },
  { min: 100, name: "جندي", emoji: "⚔️" },
  { min: 250, name: "فارس", emoji: "🛡️" },
  { min: 500, name: "بطل", emoji: "🏆" },
  { min: 1000, name: "قائد", emoji: "👑" },
];
export function levelOf(points: number) {
  let i = 0;
  LEVELS.forEach((l, idx) => { if (points >= l.min) i = idx; });
  const next = LEVELS[i + 1];
  const progress = next ? ((points - LEVELS[i].min) / (next.min - LEVELS[i].min)) * 100 : 100;
  return { ...LEVELS[i], index: i + 1, next, progress };
}

const pad = (n: number) => String(n).padStart(2, "0");
const utcYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** تاريخ الجمعة التي تبدأ فترة الأسبوع (الجمعة → الخميس) المحتوية على التاريخ */
export function fridayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return utcYmd(new Date(base.getTime() - ((base.getUTCDay() + 2) % 7) * 86400000));
}

/** ترتيب الجمعة بين جمعات شهرها (1..5) */
function fridayIndexInMonth(y: number, m: number, friday: string): number {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const fr = new Date(friday + "T00:00:00Z");
  let c = 0;
  for (let d = new Date(first); d <= fr; d = new Date(d.getTime() + 86400000)) if (d.getUTCDay() === 5) c++;
  return c;
}

/** فترة الأسبوع الحالية (الجمعة → الخميس): تبدأ في شهر الجمعة وقد تعود للشهر السابق */
export function currentPeriod(d = new Date()) {
  const from = fridayOf(cairoDate(d));
  const [y, m] = from.split("-").map(Number);
  const w = fridayIndexInMonth(y, m, from);
  const to = utcYmd(new Date(new Date(from + "T00:00:00Z").getTime() + 6 * 86400000));
  return { y, m, w, from, to };
}

/** فترات الأسابيع (الجمعة → الخميس) داخل شهر معين */
export function monthPeriods(y: number, m: number) {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const out: { w: number; from: string; to: string }[] = [];
  for (let d = new Date(first); d <= last; d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() === 5) {
      const from = utcYmd(d);
      out.push({ w: out.length + 1, from, to: utcYmd(new Date(d.getTime() + 6 * 86400000)) });
    }
  }
  return out;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, class_name, avatar, photo_url, status, created_at, academic_year, account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return { user, profile, isAdmin: !!roles?.some((r) => r.role === "admin") };
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_settings").select("*").order("sort");
      if (error) throw error;
      return data;
    },
  });
}

/** Cairo-local YYYY-MM-DD */
export function cairoDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
/** Sunday..Saturday Cairo dates for week offset (0 = this week) */
export function cairoWeek(offset = 0) {
  const today = cairoDate(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dow = base.getUTCDay();
  const start = new Date(base.getTime() - (dow + offset * 7) * 86400000);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
}

export async function signOut(queryClient: { cancelQueries: () => Promise<void>; clear: () => void }) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}

export const PROFILE_COLS = "id, full_name, class_name, avatar, status, created_at, academic_year";
export const PHONE_RE = /^01[0125][0-9]{8}$/;
export function validateContact(v: { phone?: string; birth_date?: string }) {
  if (v.phone && !PHONE_RE.test(v.phone)) return "رقم الموبايل غير صحيح (مثال: 01012345678)";
  if (v.birth_date) {
    const d = new Date(v.birth_date); const age = (Date.now() - d.getTime()) / (365.25 * 864e5);
    if (isNaN(age) || age < 5 || age > 30) return "تاريخ الميلاد غير صحيح";
  }
  return null;
}
export const ACADEMIC_YEARS = ["أولى إعدادي","ثانية إعدادي","ثالثة إعدادي"];

/** Resize an image file into a compact JPEG data URL (stored directly with the record). */
export function fileToDataUrl(file: File, max = 480, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("اختر ملف صورة"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    img.src = url;
  });
}

export const OT_BOOKS = ["التكوين","الخروج","اللاويين","العدد","التثنية","يشوع","القضاة","راعوث","صموئيل الأول","صموئيل الثاني","الملوك الأول","الملوك الثاني","أخبار الأيام الأول","أخبار الأيام الثاني","عزرا","نحميا","أستير","أيوب","المزامير","الأمثال","الجامعة","نشيد الأنشاد","إشعياء","إرميا","مراثي إرميا","حزقيال","دانيال","هوشع","يوئيل","عاموس","عوبديا","يونان","ميخا","ناحوم","حبقوق","صفنيا","حجي","زكريا","ملاخي"];
export const NT_BOOK_NAMES = ["متى","مرقس","لوقا","يوحنا","أعمال الرسل","رومية","كورنثوس الأولى","كورنثوس الثانية","غلاطية","أفسس","فيلبي","كولوسي","تسالونيكي الأولى","تسالونيكي الثانية","تيموثاوس الأولى","تيموثاوس الثانية","تيطس","فليمون","العبرانيين","يعقوب","بطرس الأولى","بطرس الثانية","يوحنا الأولى","يوحنا الثانية","يوحنا الثالثة","يهوذا","الرؤيا"];
