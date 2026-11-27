/**
 * قوالب وأدوات إرسال رسائل الواتساب
 * أسرة إعدادي بنين - كنيسة الملاك ميخائيل
 */

export const WHATSAPP_TEMPLATES = {
  // 1. قالب عيد الميلاد
  birthday: (name: string) =>
    `كل سنة وانت طيب يا ${name} سنة سعيدة عليك كلها خير وبركة ربنا يحفظك ويرعاك (اسرة اعدادي بنين كنيسة الملاك ميخائيل)`,

  // 2. قالب تذكير الخدمة (الخميس)
  serviceReminder: (name: string) =>
    `عامل ايه يا ${name} بنفكرك بكرة بميعاد خدمتنا هنستناك وجودك يفرق معانا (اسرة اعدادي بنين كنيسة الملاك ميخائيل)`,

  // 3. قالب الافتقاد للغائبين (الجمعة)
  absence: (name: string) =>
    `ازيك يا ${name} ايه اخبارك محضرتش ليه الخدمة انهاردة كنا في انتظارك هنستناك المرة اللي جاية متنساش (أسرة اعدادي بنين كنيسة الملاك ميخائيل)`,
};

/**
 * تجهيز رابط واتساب يفتح محادثة مباشرة بنص القالب المحدد
 */
export function buildWhatsAppUrl(phone?: string | null, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // تحويل الرقم المصري (01xxxxxxxxx) إلى الدولي (201xxxxxxxxx)
  const intl = digits.startsWith("0")
    ? "2" + digits
    : digits.startsWith("2")
      ? digits
      : "20" + digits;

  const base = `https://wa.me/${intl}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
