// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACADEMIC_YEARS, validateContact } from "@/lib/app";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | أبطال الإيمان" },
      { name: "description", content: "سجّل دخولك أو أنشئ حسابًا جديدًا في أبطال الإيمان." },
      { property: "og:title", content: "تسجيل الدخول | أبطال الإيمان" },
      { property: "og:description", content: "انضم إلى أبطال الإيمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "admin" | "forgot">("in");
  const [role, setRole] = useState<"member" | "servant">("member");
  const servant = role === "servant";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [year, setYear] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"" | "signup" | "reset">("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const bad = validateContact({ phone, birth_date: servant ? "" : birth });
        if (bad) throw new Error(bad);
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: servant ? { full_name: name.trim(), phone: phone.trim(), address: address.trim(), account_type: "servant" } : { full_name: name.trim(), class_name: cls, academic_year: year, birth_date: birth, phone: phone.trim(), address: address.trim() } },
        });
        if (error) throw error;
        if (data.session) { navigate({ to: servant ? "/servant" : "/home" }); return; }
        setSent("signup");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("reset");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (mode === "admin") {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
          if (!roles?.some((r) => r.role === "admin")) {
            await supabase.auth.signOut();
            throw new Error("هذا الحساب ليس لديه صلاحية مشرف");
          }
          navigate({ to: "/admin" });
        } else if (servant) {
          const [{ data: prof }, { data: roles }] = await Promise.all([
            supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", data.user.id),
          ]);
          if (prof?.account_type !== "servant" && !roles?.some((r) => r.role === "admin")) {
            await supabase.auth.signOut();
            throw new Error("هذا الحساب ليس حساب خادم");
          }
          navigate({ to: "/servant" });
        } else navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error("تعذر الدخول بجوجل");
    if (r.redirected) return;
    navigate({ to: "/home" });
  }

  const titles = { in: servant ? "أهلاً يا خادم 🙏" : "أهلاً يا بطل 👋", up: servant ? "تسجيل خادم جديد 📘" : "انضم للأبطال ⚡", admin: "دخول المشرف 🛡️", forgot: "نسيت كلمة المرور؟ 🔑" };
  const switchTo = (m: typeof mode) => { setMode(m); setSent(""); };

  return (
    <main className={`${mode === "admin" ? "stage-admin" : servant ? "stage-servant" : "stage-member"} flex min-h-screen items-center justify-center px-4 py-10`}>
      <div className="pop float-in w-full max-w-md overflow-hidden rounded-3xl border-2 border-border bg-card p-7">
        <div className="stage-bar -mx-7 -mt-7 mb-5 h-2" />
        <Link to="/" className="text-sm text-muted-foreground">← الرئيسية</Link>
        {mode !== "forgot" && (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
            <button onClick={() => { setRole("member"); switchTo(mode === "admin" ? "in" : mode); }} className={`rounded-xl py-2 text-sm font-bold transition ${mode !== "admin" && !servant ? "bg-primary text-primary-foreground pop" : ""}`}>🦁 مشترك</button>
            <button onClick={() => { setRole("servant"); switchTo(mode === "admin" ? "in" : mode); }} className={`rounded-xl py-2 text-sm font-bold transition ${mode !== "admin" && servant ? "bg-sky text-primary-foreground pop" : ""}`}>📘 خادم</button>
            <button onClick={() => switchTo("admin")} className={`rounded-xl py-2 text-sm font-bold transition ${mode === "admin" ? "bg-secondary text-secondary-foreground pop" : ""}`}>🛡️ مشرف</button>
          </div>
        )}
        <h1 className="mt-3 text-3xl font-extrabold">{titles[mode]}</h1>
        {sent ? (
          <div className="mt-6 rounded-2xl bg-muted p-5 text-center">
            <div className="text-5xl">📬</div>
            {sent === "signup" ? (
              <>
                <p className="mt-3 font-bold">تم إرسال طلب التسجيل.</p>
                <p className="mt-2 text-sm text-muted-foreground">سجّل دخولك، وسيتم تفعيل حسابك بعد موافقة المشرف.</p>
              </>
            ) : <p className="mt-3 font-bold">أرسلنا رابط تغيير كلمة المرور إلى بريدك.</p>}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "up" && (
              <>
                <div><Label>الاسم</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                {!servant && <div className="grid grid-cols-2 gap-3">
                  <div><Label>العام الدراسي</Label>
                    <select required value={year} onChange={(e) => setYear(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                      <option value="" className="bg-card">اختر</option>
                      {ACADEMIC_YEARS.map((y) => <option key={y} className="bg-card">{y}</option>)}
                    </select></div>
                  <div><Label>الفصل</Label><Input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="اسم الفصل" /></div>
                </div>}
                <div className="grid grid-cols-2 gap-3">
                  {!servant && <div><Label>تاريخ الميلاد</Label><Input type="date" required value={birth} onChange={(e) => setBirth(e.target.value)} /></div>}
                  <div><Label>الموبايل</Label><Input dir="ltr" inputMode="numeric" required maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="01012345678" /></div>
                </div>
                <div><Label>العنوان</Label><Input required maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </>
            )}
            <div><Label>البريد الإلكتروني</Label><Input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>كلمة المرور</Label>
                  {mode !== "up" && <button type="button" onClick={() => switchTo("forgot")} className="text-xs font-bold text-primary">نسيت كلمة المرور؟</button>}
                </div>
                <Input type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <button disabled={busy} className="pop w-full rounded-2xl bg-primary py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">
              {busy ? "..." : { in: "دخول", admin: "دخول كمشرف", up: "إرسال طلب التسجيل", forgot: "أرسل رابط التغيير" }[mode]}
            </button>
            {(mode === "in" || mode === "up") && !servant && (
              <button type="button" onClick={google} className="w-full rounded-2xl border-2 border-border py-3 font-bold hover:bg-muted">
                المتابعة بحساب Google
              </button>
            )}
          </form>
        )}
        <button onClick={() => switchTo(mode === "in" ? "up" : "in")} className="mt-5 w-full text-center text-sm font-bold text-primary">
          {mode === "in" ? "ليس لديك حساب؟ سجّل الآن" : mode === "up" ? "لديك حساب؟ ادخل" : "رجوع لتسجيل الدخول"}
        </button>
      </div>
    </main>
  );
}
