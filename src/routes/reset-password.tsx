import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | أبطال الإيمان" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في أبطال الإيمان." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة | أبطال الإيمان" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("انتهت صلاحية الرابط، اطلب رابطًا جديدًا");
    toast.success("تم تغيير كلمة المرور");
    navigate({ to: "/home" });
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="pop w-full max-w-md space-y-4 rounded-3xl border-2 border-border bg-card p-7">
        <h1 className="text-3xl font-extrabold">🔑 كلمة مرور جديدة</h1>
        <div><Label>كلمة المرور الجديدة</Label><Input type="password" dir="ltr" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label>تأكيد كلمة المرور</Label><Input type="password" dir="ltr" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <button disabled={busy} className="pop w-full rounded-2xl bg-primary py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "..." : "حفظ"}</button>
      </form>
    </main>
  );
}
