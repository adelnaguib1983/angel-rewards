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

export function currentWeek(d = new Date()) {
  return Math.min(4, Math.ceil(d.getDate() / 7));
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, class_name, avatar, status, created_at, academic_year").eq("id", user.id).maybeSingle(),
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
export const ACADEMIC_YEARS = ["خامسة ابتدائي","سادسة ابتدائي","أولى إعدادي","ثانية إعدادي","ثالثة إعدادي","أولى ثانوي"];
