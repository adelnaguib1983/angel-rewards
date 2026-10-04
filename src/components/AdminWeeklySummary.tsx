// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_YEARS, MONTHS, cairoDate, cairoWeek, useSettings } from "@/lib/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/ImageLightbox";

const cards = [
  ["sent", "📘", "خدام أرسلوا التحضير"], ["missing", "⏰", "خدام لم يرسلوا التحضير"],
  ["present", "✅", "المخدومون الحاضرون"], ["servants", "🙏", "الخدام الحاضرون"], ["servantAbsent", "🚷", "غياب الخدام"],
  ["absent", "🚫", "غياب المخدومين"], ["quiz", "🧠", "أوائل المسابقات"], ["birthdays", "🎂", "أعياد الميلاد هذا الشهر"],
] as const;
const Box = ({ children }) => <div className="rounded-xl bg-muted p-3">{children}</div>;
export function AdminWeeklySummary({ initialOffset = 0 }: { initialOffset?: number }) {
  const [offset, setOffset] = useState(initialOffset), [year, setYear] = useState(""), [detail, setDetail] = useState<string | null>(null), [q, setQ] = useState(""), [gallery, setGallery] = useState<string[] | null>(null);
  const qc = useQueryClient(); const days = cairoWeek(offset); const month = new Date().getMonth() + 1; const { data: settings } = useSettings();
  const { data: members = [] } = useQuery({ queryKey:["summary-members"], queryFn: async()=>{const {data,error}=await supabase.rpc("admin_members"); if(error) throw error; return data ?? [];} });
  const names = Object.fromEntries(members.map(m=>[m.id,m]));
  const { data: logs=[] } = useQuery({ queryKey:["summary-logs",offset], queryFn: async()=>{const from=new Date(new Date(days[0]).getTime()-86400000).toISOString(),to=new Date(new Date(days[6]).getTime()+2*86400000).toISOString(); const {data,error}=await supabase.from("activity_logs").select("*").gte("created_at",from).lt("created_at",to).eq("status","approved");if(error)throw error;return (data??[]).filter(l=>days.includes(cairoDate(l.created_at)));} });
  const { data: preps=[] } = useQuery({ queryKey:["summary-preps",offset], queryFn:async()=>{const {data,error}=await supabase.rpc("admin_prep_status",{_offset:offset});if(error)throw error;return data??[];} });
  const { data: attendance=[] } = useQuery({ queryKey:["summary-servant-attendance",offset], queryFn:async()=>{const {data,error}=await supabase.rpc("admin_servant_attendance",{_offset:offset});if(error)throw error;return data??[];} });
  const { data: absent=[] } = useQuery({ queryKey:["summary-absence",offset], queryFn:async()=>{const {data,error}=await supabase.rpc("admin_absence_by_type",{_offset:offset,_type:"member"});if(error)throw error;return data??[];} });
  const { data: league=[] } = useQuery({ queryKey:["summary-quiz-league"], queryFn:async()=> (await supabase.rpc("quiz_league")).data??[] });
  const { data: birthdays=[] } = useQuery({ queryKey:["summary-birthdays",month], queryFn:async()=> (await supabase.rpc("birthdays",{_month:month})).data??[] });
  const filteredLogs = logs.filter(l=>!year||names[l.user_id]?.academic_year===year); const presentIds=[...new Set(filteredLogs.map(l=>l.user_id))];
  const counts={sent:preps.filter(p=>p.submitted).length,missing:preps.filter(p=>!p.submitted).length,present:presentIds.length,servants:attendance.filter(a=>a.attended).length,servantAbsent:attendance.filter(a=>!a.attended).length,absent:absent.filter(a=>!year||a.academic_year===year).length,quiz:league.length,birthdays:birthdays.length};
  const search=(s="")=>!q||s.includes(q); const notify=async()=>{const {data,error}=await supabase.rpc("notify_missing_preparations",{_offset:offset});if(error)return toast.error(error.message);toast.success(`تم تنبيه ${data} خادم`);qc.invalidateQueries({queryKey:["myNotifs"]});};
  const render=()=>{
    if(detail==="sent") return preps.filter(p=>p.submitted&&search(p.full_name)).map(p=><Box key={p.user_id}><b>{p.full_name}</b><div className="text-xs text-muted-foreground">{p.submitted_at?new Date(p.submitted_at).toLocaleString("ar-EG"):""}</div><p className="my-2 whitespace-pre-wrap">{p.notes||"بدون نص"}</p>{!!p.images?.length&&<button onClick={()=>setGallery(p.images)} className="font-bold text-primary">🖼️ فتح {p.images.length} صورة</button>}</Box>);
    if(detail==="missing") return <><button onClick={notify} className="mb-3 w-full rounded-xl bg-secondary py-2 font-bold text-secondary-foreground">🔔 تنبيه كل المتأخرين</button>{preps.filter(p=>!p.submitted&&search(p.full_name)).map(p=><Box key={p.user_id}><b>{p.full_name}</b></Box>)}</>;
    if(detail==="present") return presentIds.filter(id=>search(names[id]?.full_name)).map(id=><Box key={id}><b>{names[id]?.full_name}</b><div className="mt-1 text-sm">{filteredLogs.filter(l=>l.user_id===id).map(l=>settings?.find(s=>s.key===l.activity)?.label??l.activity).join(" · ")}</div></Box>);
    if(detail==="servants") return attendance.filter(a=>a.attended&&search(a.full_name)).map(a=><Box key={a.user_id}><b>{a.full_name}</b><div className="text-xs text-muted-foreground">{new Date(a.attended_at).toLocaleString("ar-EG")}</div></Box>);
    if(detail==="servantAbsent") return attendance.filter(a=>!a.attended&&search(a.full_name)).map(a=><Box key={a.user_id}><b>{a.full_name}</b><div className="text-xs text-muted-foreground">لم يسجّل حضوره أسبوع {days[0]}</div></Box>);
    if(detail==="absent") return absent.filter(a=>(!year||a.academic_year===year)&&search(a.full_name)).map(a=><Box key={a.id}><b>{a.full_name}</b><div className="text-xs">{a.academic_year??"بدون مرحلة"} · {a.visited?"تم افتقاده":"بدون افتقاد"}</div></Box>);
    if(detail==="quiz") return league.filter(r=>search(r.full_name)).map((r,i)=><Box key={r.id}><div className="flex justify-between"><b>{i+1}. {r.full_name}</b><span>{r.points} نقطة · {r.quizzes} مسابقة</span></div></Box>);
    return birthdays.filter(b=>search(b.full_name)).map(b=><Box key={b.id}><div className="flex items-center gap-3">{b.photo_url?<img src={b.photo_url} alt="" className="h-12 w-12 rounded-full object-cover"/>:<span className="text-3xl">{b.avatar}</span>}<b className="flex-1">{b.full_name}</b><span>{b.day} {MONTHS[month-1]}</span></div></Box>);
  };
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-2"><button onClick={()=>setOffset(offset+1)} className="rounded-xl bg-card px-3 py-2 font-bold">→ السابق</button><b>من الأحد {days[0]} إلى السبت {days[6]}</b><button disabled={!offset} onClick={()=>setOffset(offset-1)} className="rounded-xl bg-card px-3 py-2 font-bold disabled:opacity-40">التالي ←</button><select value={year} onChange={e=>setYear(e.target.value)} className="h-10 rounded-xl border border-input bg-card px-2"><option value="">كل المراحل</option>{ACADEMIC_YEARS.map(y=><option key={y}>{y}</option>)}</select></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([k,icon,label])=><button key={k} onClick={()=>{setDetail(k);setQ("")}} className="pop min-h-36 rounded-2xl border-2 border-border bg-card p-4 text-right hover:border-primary"><span className="text-4xl">{icon}</span><span className="mt-3 block font-extrabold">{label}</span><span className="text-3xl font-extrabold text-primary">{counts[k]}</span><span className="block text-xs text-muted-foreground">اضغط للتفاصيل والأرشيف</span></button>)}</div>
    <Dialog open={!!detail} onOpenChange={o=>!o&&setDetail(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{cards.find(c=>c[0]===detail)?.[1]} {cards.find(c=>c[0]===detail)?.[2]}</DialogTitle></DialogHeader><input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالاسم" className="rounded-xl border-2 border-border bg-background px-3 py-2"/><div className="max-h-[65vh] space-y-2 overflow-y-auto">{render()}{detail&&counts[detail]===0&&<p className="text-muted-foreground">لا توجد بيانات في هذه الفترة.</p>}</div></DialogContent></Dialog><ImageLightbox images={gallery} onClose={()=>setGallery(null)}/></div>;
}
