# Roadmap
- [x] Database: profiles/approval, roles, activities, badges, gifts, redemptions, point adjustments log, notifications
- [x] Auth (email + Google) with admin approval gate
- [x] Kid app: weekly tracker, verse, points, levels, badges, gift catalog, leaderboard
- [x] Admin: approvals, activity review, adjustments log, notifications, gifts/badges, redemptions
- [x] Weekly summary, ranking, archive, CSV, contact access + audit
- [x] Streaks, calendar, AI coach, forgot password, admin login entry
- [x] Announcements board + six-item mobile bottom navigation
- [x] Sign up for trips/activities from announcements + registrant list for admin
- [x] Member alert on new announcement, opens it directly
- [x] Admin adds new activities with points
- [x] Photos: member profile photo + announcement image
- [x] Signup requires all basic data + admin approval
- [x] Weekly summary clickable cards, أهلا يا بطل, remove header links, CSV, contact audit
- [x] Weekly competitions graded with points, no past-week edits
- [x] Separate admin notification icons, split weekly absence, member home reorder
- [x] Quiz badge, five-person leaderboards, name effects
- [x] توحيد مسميات المخدومين + إعادة بناء الملخص الأسبوعي + مستعرض صور

## حزمة التحضيرات والمسابقات والحضور — مكتملة
- [x] قاعدة البيانات: service_years + حالة اعتماد المسابقات + RPCs + حاوية servant-media + دورة الأسبوع الجمعة→الخميس (week_start / is_current_week / weekly_leaderboard) + سياسة قراءة الاقتراحات العامة
- [x] تبويب تحضير الخادم: صور متعددة + رفع/تسجيل فويس + فيديو + استعراض تحضيرات باقي الخدام + حفظ دائم في الأرشيف
- [x] تبويب الاقتراحات: صور متعددة + فويس (رفع/تسجيل) + فيديو + تحديد النشر (خاص بالخدام / للجميع)
- [x] توليد المسابقات بالذكاء الاصطناعي الحقيقي (نص/صورة/صوت/فيديو/شاهد كتابي) + مراجعة كل الأسئلة + إرسال لاعتماد المشرف + قائمة مسابقاتي
- [x] لوحة المشرف: قسم اعتماد المسابقات (اعتماد/رفض) + زر إعادة نشر كدفعة جديدة دون حذف السجل + استبدال كارت الملخص التجريبي بالملخص الفعلي
- [x] الحضور: عدادات داخل الأزرار بنطاق السنة الخدمية + تأمين الأزرار + زر اعتماد الجمعة (من لم يُرصد غائب) + تنبيه الغياب المتتالي عبر RPC الحقيقي
- [x] لوحة المشرف: بطاقة السنة الخدمية + زر ترقية المراحل بتأكيد مزدوج + زر تنبيه غياب الخدام (جمعتين متتاليتين) + حذف AbsenceTab الميت
- [x] أسبوع الأنشطة من الجمعة إلى الخميس في صفحة المشترك مع تمييز الأسبوع الحالي + الشاشة الافتتاحية ثانيتين
- [ ] اختبار حقيقي للتوليد بالذكاء الاصطناعي داخل التطبيق ومراجعة بصرية للتدفقات الجديدة
