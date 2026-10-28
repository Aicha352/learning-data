import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-600 p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5" aria-hidden="true" />
        <Logo light className="relative" />
        <div className="relative">
          <h2 className="max-w-md text-4xl leading-tight font-bold">Chaque apprenant a son propre chemin.</h2>
          <p className="mt-4 max-w-md text-lg text-white/85">
            Crée ton compte : en deux minutes, tu reçois tes premières recommandations de cours.
          </p>
        </div>
        <figure className="relative max-w-md rounded-2xl bg-white/12 p-6 backdrop-blur-sm">
          <blockquote className="text-[15px] leading-relaxed">
            « Le système m&apos;a proposé exactement les cours qu&apos;il me fallait. J&apos;ai terminé ma formation en trois mois. »
          </blockquote>
          <figcaption className="mt-3 text-sm font-semibold text-white/80">Salif Zongo · Data analyst junior</figcaption>
        </figure>
      </aside>
      <main className="flex flex-col bg-white">
        <div className="p-5 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
