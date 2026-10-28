"use client";

import { ArrowRight, BellRing, BookOpen, BrainCircuit, ChartLine, Sparkles, Target, UserCheck } from "lucide-react";
import Link from "next/link";

import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { homeFor, useAuth } from "@/lib/auth";
import { formatNumber, formatPercent } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Category, CourseSummary, Paginated } from "@/lib/types";

const STEPS = [
  {
    icon: UserCheck,
    title: "Crée ton profil",
    text: "Tu indiques ton objectif, ton niveau et ton temps disponible. Le système te connaît dès le premier jour.",
  },
  {
    icon: Sparkles,
    title: "Reçois tes recommandations",
    text: "Un modèle hybride compare ton parcours à celui des autres apprenants et au contenu des cours pour te proposer les plus adaptés.",
  },
  {
    icon: BellRing,
    title: "Progresse avec un suivi",
    text: "Si ton rythme baisse, la plateforme le détecte et ton formateur peut t'aider avant que tu décroches.",
  },
];

const PATHS = [
  { icon: ChartLine, title: "Data analyst", text: "Python, statistiques, Pandas, SQL et visualisation.", slug: "data-science" },
  { icon: BrainCircuit, title: "Intelligence artificielle", text: "Des bases de l'IA au machine learning et au NLP.", slug: "intelligence-artificielle" },
  { icon: BookOpen, title: "Programmation", text: "Python, Git, JavaScript et API web.", slug: "programmation" },
  { icon: Target, title: "Gestion de projet", text: "Agile, planification, communication.", slug: "gestion-de-projet" },
];

const PREVIEW = [
  { title: "Pandas : manipuler des données", meta: "Intermédiaire · 5 h", match: 0.88, color: "#FFF4DE" },
  { title: "Statistiques pour la data", meta: "Débutant · 2 h 30", match: 0.91, color: "#E7F6EC" },
  { title: "SQL pour l'analyse", meta: "Débutant · 1 h 45", match: 0.84, color: "#E0F2FE" },
];

export default function HomePage() {
  const { user } = useAuth();
  const { data: stats } = useApi<{ learners: number; courses: number; completion_rate: number }>("/api/stats/");
  const { data: popular, isLoading } = useApi<Paginated<CourseSummary>>("/api/courses/?sort=popular&page_size=4");
  const { data: categories } = useApi<Category[]>("/api/categories/");
  const countFor = (slug: string) => categories?.find((c) => c.slug === slug)?.course_count;

  return (
    <>
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-24">
        <div>
          <Badge tone="brand" icon={<Sparkles className="size-3.5" />}>
            Apprentissage personnalisé par l&apos;IA
          </Badge>
          <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-ink sm:text-5xl lg:text-[56px]">
            Apprends ce qui compte pour toi, à ton rythme.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Learning Data analyse ton profil et ta progression pour te proposer les bons cours au bon moment, et
            t&apos;accompagne jusqu&apos;au bout de ta formation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <LinkButton href={homeFor(user)} size="lg" icon={<ArrowRight className="size-4" />}>
                Aller à mon espace
              </LinkButton>
            ) : (
              <LinkButton href="/inscription" size="lg">
                Commencer gratuitement
              </LinkButton>
            )}
            <LinkButton href="/catalogue" size="lg" variant="secondary">
              Voir le catalogue
            </LinkButton>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            {[
              { value: stats ? formatNumber(stats.learners) : "—", label: "apprenants" },
              { value: stats ? formatNumber(stats.courses) : "—", label: "cours" },
              { value: stats ? formatPercent(stats.completion_rate) : "—", label: "terminent leur cours" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="sr-only">{item.label}</dt>
                <dd className="text-[28px] font-bold">{item.value}</dd>
                <dd className="text-sm text-muted">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5 shadow-pop sm:p-7" aria-label="Exemple de recommandations">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-warning-500" />
            <p className="text-lg font-semibold">Recommandé pour toi</p>
          </div>
          <p className="mt-1 text-sm text-muted">Exemple pour un profil « data analyst » qui a suivi Python</p>
          <ul className="mt-5 space-y-3">
            {PREVIEW.map((item) => (
              <li key={item.title} className="flex items-center gap-3.5 rounded-xl bg-canvas p-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: item.color }}>
                  <BookOpen className="size-5 text-brand-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{item.title}</span>
                  <span className="text-[13px] text-muted">{item.meta}</span>
                </span>
                <Badge tone="success">{formatPercent(item.match)}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Objectif de la semaine</span>
              <span className="text-muted">4 / 6 leçons</span>
            </div>
            <Progress value={0.66} label="Objectif de la semaine" />
          </div>
        </div>
      </section>

      <section id="fonctionnement" className="scroll-mt-20 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight">Comment ça marche</h2>
          <p className="mt-2 max-w-2xl text-muted">Trois étapes, et des données qui travaillent pour toi plutôt que contre toi.</p>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-line p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-600">{index + 1}</span>
                  <step.icon className="size-5 text-muted" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="parcours" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-3xl font-bold tracking-tight">Des parcours pour chaque objectif</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map((path) => (
            <Link
              key={path.title}
              href={`/catalogue?category=${path.slug}`}
              className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <path.icon className="size-6 text-brand-600" />
              <h3 className="mt-3 font-semibold group-hover:text-brand-700">{path.title}</h3>
              <p className="mt-1 text-sm text-muted">{path.text}</p>
              {countFor(path.slug) !== undefined && <p className="mt-3 text-xs font-semibold text-brand-600">{countFor(path.slug)} cours →</p>}
            </Link>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tight">Cours populaires</h2>
          <LinkButton href="/catalogue" variant="secondary">
            Tout voir
          </LinkButton>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading || !popular
            ? Array.from({ length: 4 }, (_, i) => <CourseCardSkeleton key={i} />)
            : popular.results.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      </section>
    </>
  );
}
