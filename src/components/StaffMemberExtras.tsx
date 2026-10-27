export function AddMemberButton({ defaultYear }: { defaultYear?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", year: defaultYear ?? YEARS3[0], birth: "", phone: "", address: "", phone2: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const inp = "w-full rounded-xl border-2 border-border bg-background px-3 py-2";

  const save = async () => {
    if (!f.name.trim()) return toast.error("الاسم بالكامل مطلوب");
    if (!f.birth) return toast.error("تاريخ الميلاد مطلوب");
    if (!f.phone.trim()) return toast.error("رقم الموبايل مطلوب");
    if (!/^01[0125][0-9]{8}$/.test(f.phone.trim())) return toast.error("رقم الموبايل الرئيسي غير صحيح");
    if (!f.address.trim()) return toast.error("العنوان مطلوب");
    if (f.phone2 && !/^0[0-9]{8,10}$/.test(f.phone2.trim())) return toast.error("الرقم الإضافي غير صحيح");

    setBusy(true);
    const { data: id, error } = await supabase.rpc("staff_add_member", { 
      _name: f.name.trim(), 
      _year: f.year, 
      _birth: f.birth, 
      _phone: f.phone.trim(), 
      _address: f.address.trim() 
    });
    
    if (!error && id && (f.phone2 || f.notes)) {
      await supabase.rpc("staff_set_extra", { _id: id, _phone2: f.phone2.trim(), _notes: f.notes.trim() });
    }
    setBusy(false);
    
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة المخدوم بنجاح ✅");
    setOpen(false); 
    setF({ name: "", year: f.year, birth: "", phone: "", address: "", phone2: "", notes: "" });
    qc.invalidateQueries();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="pop rounded-xl bg-primary px-4 py-2 font-extrabold text-primary-foreground">+ إضافة مخدوم جديد</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>➕ إضافة مخدوم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-bold">الاسم بالكامل *<input className={inp} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="block text-sm font-bold">المرحلة الدراسية *<select className={inp} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>{YEARS3.map((y) => <option key={y}>{y}</option>)}</select></label>
            
            {/* تاريخ الميلاد مع السماح بالسنوات القديمة (مثلاً بدءاً من 1950) */}
            <label className="block text-sm font-bold">تاريخ الميلاد *
              <input type="date" min="1950-01-01" max="2026-12-31" className={inp} value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} />
            </label>

            <label className="block text-sm font-bold">رقم الهاتف *<input className={inp} inputMode="tel" placeholder="01012345678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label className="block text-sm font-bold">العنوان *<input className={inp} maxLength={200} placeholder="اسم الشارع / المنطقة" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
            <label className="block text-sm font-bold">رقم إضافي / ولي الأمر (اختياري)<input className={inp} inputMode="tel" value={f.phone2} onChange={(e) => setF({ ...f, phone2: e.target.value })} /></label>
            <label className="block text-sm font-bold">ملاحظات (اختياري)<textarea className={inp} rows={3} maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            <button disabled={busy} onClick={save} className="pop w-full rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "جاري الحفظ..." : "حفظ المخدوم"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
