function DailyAttendanceSection() {
  const qc = useQueryClient();
  const fridaysList = useMemo(() => getFridayList(), []);
  const [date, setDate] = useState(fridaysList[0] || new Date().toISOString().split("T")[0]);
  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"student" | "servant">("student");
  const [selectedYear, setSelectedYear] = useState("all");
  const [statsDialogType, setStatsDialogType] = useState<"present" | "absent" | "total" | null>(null);
  
  // متغير حماية لمنع التنفيذ المتتالي السريع وتداخل الطلبات
  const [isUpdating, setIsUpdating] = useState(false);

  const filterYear = selectedYear === "all" ? null : selectedYear;

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["profiles-attendance-all-fixed", accountType, date],
    queryFn: async () => {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar, photo_url, academic_year, account_type, status")
        .eq("status", "approved");

      if (profErr) throw profErr;

      const { data: attendanceRecords } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("attendance_date", date);

      const { data: allAttendanceRecords } = await supabase
        .from("daily_attendance")
        .select("person_id, status");

      const countsMap: Record<string, { present: number, absent: number }> = {};
      (allAttendanceRecords || []).forEach((rec: any) => {
        if (!countsMap[rec.person_id]) {
          countsMap[rec.person_id] = { present: 0, absent: 0 };
        }
        if (rec.status === 'present') countsMap[rec.person_id].present++;
        if (rec.status === 'absent') countsMap[rec.person_id].absent++;
      });

      const allProfiles = profiles || [];
      
      const filtered = allProfiles.filter((m: any) => {
        const type = (m.account_type || "").toLowerCase();
        const hasYear = Boolean(m.academic_year && m.academic_year.trim() !== "");

        if (accountType === "servant") {
          return type.includes("servant") || type.includes("admin") || !hasYear;
        } else {
          return hasYear || type.includes("student") || type.includes("member") || type === "";
        }
      });

      const listToUse = filtered.length > 0 ? filtered : allProfiles;

      return listToUse.map((m: any) => {
        const personId = m.id || m.user_id;
        const att = (attendanceRecords || []).find((a: any) => a.person_id === personId);
        const personCounts = countsMap[personId] || { present: 0, absent: 0 };

        return {
          person_id: personId,
          full_name: m.full_name || m.name || m.username || "بدون اسم",
          avatar: m.avatar || "👤",
          photo_url: m.photo_url,
          academic_year: m.academic_year || m.grade || "مرحلة عامة",
          attendance_status: att ? att.status : null,
          present_count: personCounts.present,
          absent_count: personCounts.absent,
          auth_user_id: m.auth_user_id,
          email: m.email,
          registered_externally: m.registered_externally
        };
      });
    },
  });

  const people = profilesData || [];
  const filteredPeople = filterYear ? people.filter((p: any) => p.academic_year === filterYear) : people;

  const handleStatusChange = async (personId: string, status: "present" | "absent") => {
    if (isUpdating) return; // منع التكرار السريع
    setIsUpdating(true);

    try {
      const { error } = await supabase.from("daily_attendance").upsert({
        person_id: personId,
        attendance_date: date,
        status: status
      }, { onConflict: "person_id,attendance_date" });

      if (error) {
        toast.error(error.message);
        return;
      }

      // في حالة تسجيل "غائب"، نتحقق من الغياب لأسبوعين متتاليين
      if (status === "absent") {
        const currentIndex = fridaysList.indexOf(date);
        const previousFriday = currentIndex !== -1 && currentIndex + 1 < fridaysList.length ? fridaysList[currentIndex + 1] : null;

        if (previousFriday) {
          const { data: pastRecord } = await supabase
            .from("daily_attendance")
            .select("status")
            .eq("person_id", personId)
            .eq("attendance_date", previousFriday)
            .maybeSingle();

          // إذا كان غائباً في الأسبوع الماضي وهذا الأسبوع (أسبوعين متتاليين)
          if (pastRecord && pastRecord.status === "absent") {
            const targetCategory = accountType === "servant" ? "الخادم" : "المخدوم";
            
            toast.warning(`⚠️ تنبيه: ${targetCategory} غاب لمدة أسبوعين متتاليين وتم إخطار المشرف!`);
            
            await supabase.from("suggestions_and_notes").insert({
              content: `⚠️ تنبيه غياب متكرر (أسبوعين متتاليين): ${targetCategory} غاب في جمعة ${previousFriday} وجمعة ${date}`,
              target_type: "all_servants",
              status: "pending"
            }).catch(() => {});
          }
        }
      }

      toast.success("تم تحديث حالة الحضور وزيادة العداد بنجاح ✅");
      qc.invalidateQueries({ queryKey: ["profiles-attendance-all-fixed"] });
    } finally {
      setIsUpdating(false);
    }
  };

  const presentCount = filteredPeople.filter((p: any) => p.attendance_status === "present").length;
  const absentCount = filteredPeople.filter((p: any) => p.attendance_status === "absent").length;
  const totalCount = filteredPeople.length;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const absentPeople = filteredPeople.filter((p: any) => p.attendance_status === "absent");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div onClick={() => setStatsDialogType("total")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-muted/50 transition">
          <div className="text-xs text-muted-foreground">إجمالي الأفراد</div>
          <div className="mt-1 text-2xl font-black">{totalCount}</div>
        </div>
        <div onClick={() => setStatsDialogType("present")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-emerald-500/10 transition">
          <div className="text-xs text-muted-foreground">الحاضرون في الجمعة</div>
          <div className="mt-1 text-2xl font-black text-emerald-500">{presentCount}</div>
        </div>
        <div onClick={() => setStatsDialogType("absent")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-destructive/10 transition">
          <div className="text-xs text-muted-foreground">الغائبون في الجمعة</div>
          <div className="mt-1 text-2xl font-black text-destructive">{absentCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">نسبة الحضور</div>
          <div className="mt-1 text-2xl font-black text-sky">{percentage}%</div>
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <label className="text-sm font-extrabold">📅 تاريخ خدمة الجمعة:</label>
          <select 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            className="rounded-xl border-2 border-border bg-background px-3 py-1.5 font-bold text-sm"
          >
            {fridaysList.map((f) => (
              <option key={f} value={f}>
                جمعة {f}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAccountType("student")} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "student" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>المخدومين (الأولاد)</button>
          <button onClick={() => setAccountType("servant")} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>الخدام</button>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-1.5 text-xs font-bold">
            <option value="all">كل المراحل</option>
            {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSubTab("record")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}>📝 تسجيل الحضور والغياب الأسبوعي</button>
        <button onClick={() => setSubTab("absent")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card"}`}>⚠️ كشف الغياب ({absentPeople.length})</button>
      </div>

      {subTab === "record" ? (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : !filteredPeople.length ? (
            <p className="text-center text-muted-foreground py-8">لا توجد بيانات مسجلة للأفراد في هذا القسم.</p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {filteredPeople.map((item: any) => {
                const isExternal = item.auth_user_id || item.email || item.registered_externally;
                const presentCountVal = item.present_count || 0; 
                const absentCountVal = item.absent_count || 0;

                return (
                  <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3.5">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm">{item.full_name}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isExternal ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                            {isExternal ? "🌐 سجل من الخارج" : "➕ أُضيف داخلياً"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(item.person_id, "present")} 
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                          item.attendance_status === "present" 
                            ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400" 
                            : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800"
                        }`}
                      >
                        <span>✓ حاضر</span>
                        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-mono text-white">
                          {presentCountVal}
                        </span>
                      </button>

                      <button 
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(item.person_id, "absent")} 
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                          item.attendance_status === "absent" 
                            ? "bg-destructive text-destructive-foreground shadow-md ring-2 ring-red-400" 
                            : "bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-800"
                        }`}
                      >
                        <span>✕ غائب</span>
                        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-mono text-white">
                          {absentCountVal}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {absentPeople.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد غياب مسجل في خدمة هذا اليوم ✅</p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {absentPeople.map((item: any) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-destructive/30 bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                    <div>
                      <div className="font-extrabold text-sm text-destructive">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}</div>
                    </div>
                  </div>
                  <button 
                    disabled={isUpdating}
                    onClick={() => handleStatusChange(item.person_id, "present")} 
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                  >
                    تعديل إلى حاضر ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {statsDialogType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border-2 border-border bg-card p-6 shadow-2xl max-h-[85vh] flex flex-col pop">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-lg font-extrabold">
                {statsDialogType === "present" && `✅ قائمة الحاضرين (${presentCount})`}
                {statsDialogType === "absent" && `⚠️ قائمة الغائبين (${absentCount})`}
                {statsDialogType === "total" && `👥 إجمالي الأفراد (${totalCount})`}
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  ({accountType === "student" ? "المخدومين - الأولاد" : "الخدام"})
                </span>
              </h3>
              <button onClick={() => setStatsDialogType(null)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold hover:bg-destructive hover:text-white transition">✕ إغلاق</button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {(() => {
                const list = 
                  statsDialogType === "present" ? filteredPeople.filter((p: any) => p.attendance_status === "present") :
                  statsDialogType === "absent" ? filteredPeople.filter((p: any) => p.attendance_status === "absent") :
                  filteredPeople;
                if (list.length === 0) return <p className="text-center text-muted-foreground py-12">لا توجد بيانات مطابقة.</p>;
                return list.map((item: any) => (
                  <div key={item.person_id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                      <div>
                        <div className="font-extrabold text-sm">{item.full_name}</div>
                        <div className="text-xs text-muted-foreground">{item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 text-emerald-600 border border-emerald-500/20">حضر: {item.present_count || 0}</span>
                      <span className="rounded-xl bg-destructive/10 px-2.5 py-1 text-destructive border border-destructive/20">غاب: {item.absent_count || 0}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
