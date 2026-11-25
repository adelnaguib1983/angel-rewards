import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingAttendance {
  person_id: string;
  attendance_date: string;
  status: "present" | "absent";
  saved_at: string;
}

const STORAGE_KEY = "offline_pending_attendance";
const CACHED_PROFILES_KEY = "offline_cached_profiles";

// 1. حفظ سجل الحضور محلياً عند انقطاع النت
export function savePendingAttendanceLocally(record: Omit<PendingAttendance, "saved_at">) {
  const current = getPendingAttendanceList();
  // إزالة أي سجل سابق لنفس الشخص ونفس التاريخ وتحديثه بالجديد
  const filtered = current.filter(
    (item) => !(item.person_id === record.person_id && item.attendance_date === record.attendance_date)
  );
  filtered.push({ ...record, saved_at: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 2. قراءة كل السجلات المعلقة محلياً
export function getPendingAttendanceList(): PendingAttendance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// 3. مسح شخص من السجلات المعلقة (عند التراجع عن الرصد)
export function removePendingAttendanceLocally(personId: string, date: string) {
  const current = getPendingAttendanceList();
  const filtered = current.filter(
    (item) => !(item.person_id === personId && item.attendance_date === date)
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 4. حفظ نسخة من المخدومين والخدام للعمل بدون نت
export function cacheProfilesLocally(profiles: any[]) {
  try {
    if (profiles && profiles.length > 0) {
      localStorage.setItem(CACHED_PROFILES_KEY, JSON.stringify(profiles));
    }
  } catch (e) {
    console.error("فشل حفظ نسخة محلية من القوائم", e);
  }
}

// 5. جلب النسخة المخبأة من المخدومين والخدام
export function getCachedProfilesLocally(): any[] {
  try {
    const raw = localStorage.getItem(CACHED_PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// 6. مزامنة السجلات المعلقة ورفعها لقاعدة البيانات فور توفر الإنترنت
export async function syncPendingAttendanceToServer(onSuccess?: () => void) {
  if (!navigator.onLine) return;

  const pending = getPendingAttendanceList();
  if (pending.length === 0) return;

  const toastId = toast.loading(`جاري مزامنة ${pending.length} سجل حضور تم تسجيلها بدون نت...`);

  try {
    const recordsToUpsert = pending.map((p) => ({
      person_id: p.person_id,
      attendance_date: p.attendance_date,
      status: p.status,
    }));

    const { error } = await supabase
      .from("daily_attendance")
      .upsert(recordsToUpsert, { onConflict: "person_id,attendance_date" });

    if (error) {
      toast.error(`تعذرت المزامنة: ${error.message}`, { id: toastId });
      return;
    }

    // تفريغ القائمة المحلية بعد نجاح الرفع
    localStorage.removeItem(STORAGE_KEY);
    toast.success(`تمت مزامنة ${recordsToUpsert.length} سجل حضور بنجاح! ✅`, { id: toastId });
    if (onSuccess) onSuccess();
  } catch (err: any) {
    toast.error("حدث خطأ أثناء مزامنة البيانات", { id: toastId });
  }
}
