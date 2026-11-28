import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      // السماح بالدخول إذا وُجد حساب مسجل في الكاش المحلي مسبقاً أثناء غياب الإنترنت
      try {
        const cached = localStorage.getItem("offline_cached_me");
        if (cached && JSON.parse(cached)?.user) {
          return { user: JSON.parse(cached).user };
        }
      } catch {}
      throw redirect({ to: "/auth" });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
