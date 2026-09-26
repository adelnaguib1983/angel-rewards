import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name, class_name: cls } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pop w-full max-w-md rounded-3xl border-2 border-border bg-card p-7">
        <Link to="/" className="text-sm text-muted-foreground">← الرئيسية</Link>
        <h1 className="mt-2 text-3xl font-extrabold">{mode === "in" ? "أهلاً يا بطل 👋" : "انضم للأبطال ⚡"}</h1>
        {sent ? (
          <div className="mt-6 rounded-2xl bg-muted p-5 text-center">
            <div className="text-5xl">📬</div>
            <p className="mt-3 font-bold">افتح بريدك واضغط رابط التأكيد.</p>
            <p className="mt-2 text-sm text-muted-foreground">بعدها ينتظر حسابك موافقة الخادم قبل التفعيل.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "up" && (
              <>
                <div><Label>الاسم</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>الفصل / المرحلة</Label><Input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="مثال: أولى إعدادي" /></div>
              </>
            )}
            <div><Label>البريد الإلكتروني</Label><Input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>كلمة المرور</Label><Input type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button disabled={busy} className="pop w-full rounded-2xl bg-primary py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">
              {busy ? "..." : mode === "in" ? "دخول" : "إرسال طلب التسجيل"}
            </button>
            <button type="button" onClick={google} className="w-full rounded-2xl border-2 border-border py-3 font-bold hover:bg-muted">
              المتابعة بحساب Google
            </button>
          </form>
        )}
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }} className="mt-5 w-full text-center text-sm font-bold text-primary">
          {mode === "in" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ ادخل"}
        </button>
      </div>
    </main>
  );
}
