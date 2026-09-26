import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/lib/app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أبطال الإيمان | تطبيق تحفيزي لمدارس الأحد" },
      { name: "description", content: "سجّل القداس والتناول والاعتراف وقراءة الكتاب والعطاء، واجمع النقاط والأوسمة والهدايا." },
      { property: "og:title", content: "أبطال الإيمان" },
      { property: "og:description", content: "تطبيق تحفيزي للفتيان في مدارس الأحد: نقاط وأوسمة وهدايا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const items = [
  ["⛪", "القداس"], ["📖", "مدارس الأحد"], ["🍞", "التناول"],
  ["🕊️", "الاعتراف"], ["📜", "الكتاب المقدس"], ["🎁", "العطاء"],
];

function Index() {
  const { data } = useMe();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">للفتيان ١١–١٤ سنة</div>
      <h1 className="text-5xl font-extrabold leading-tight md:text-7xl">
        أبطال <span className="text-primary">الإيمان</span> ⚡
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        كل أسبوع مغامرة جديدة! سجّل إنجازاتك الروحية، اجمع النقاط، افتح الأوسمة، واستبدلها بهدايا حقيقية.
      </p>
      <div className="mt-10 grid w-full max-w-2xl grid-cols-3 gap-3 md:grid-cols-6">
        {items.map(([e, l], i) => (
          <div key={l} className="pop rounded-2xl border-2 border-border bg-card p-3 transition-transform hover:-translate-y-1" style={{ rotate: `${(i % 2 ? 1 : -1) * 3}deg` }}>
            <div className="text-4xl">{e}</div>
            <div className="mt-1 text-xs font-bold">{l}</div>
          </div>
        ))}
      </div>
      <Link
        to={data ? "/home" : "/auth"}
        className="pop mt-12 rounded-2xl bg-primary px-10 py-4 text-xl font-extrabold text-primary-foreground transition-transform hover:-translate-y-1 active:translate-y-1"
      >
        {data ? "ادخل إلى لوحتك 🚀" : "ابدأ المغامرة 🚀"}
      </Link>
    </main>
  );
}
