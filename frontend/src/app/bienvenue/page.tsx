"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoalPicker, InterestsPicker, LevelHoursPicker } from "@/components/learning/preferences-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { Tag } from "@/lib/types";

const STEPS = [
  { title: "Quel est ton objectif principal ?", subtitle: "Il oriente les parcours que l'on te propose." },
  { title: "Ton niveau et ton temps disponible", subtitle: "Pour te proposer des cours adaptés à ton rythme." },
  { title: "Les sujets qui t'intéressent", subtitle: "Choisis-en au moins trois : ils servent à te recommander des cours dès le premier jour." },
];

export default function WelcomePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data: tags } = useApi<Tag[]>("/api/tags/?popular=1");
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("beginner");
  const [hours, setHours] = useState("");
  const [interests, setInterests] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const canContinue = [Boolean(goal), Boolean(level && hours), interests.length >= 3][step];

  async function finish() {
    setSaving(true);
    try {
      await api("/api/auth/me/profile/", {
        method: "PUT",
        body: { goal, level, weekly_hours: hours, interest_ids: interests },
      });
      await refresh();
      toast.success("C'est prêt ! Voici les cours choisis pour toi.");
      router.replace("/apprenant/recommandations");
    } catch (err) {
      toast.error((err as ApiError).message);
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between text-sm">
        <span className="font-medium text-muted">
          Étape {step + 1} sur {STEPS.length}
        </span>
        <Link href="/apprenant" className="text-muted hover:text-ink">
          Passer pour le moment
        </Link>
      </div>
      <Card className="p-6 shadow-pop sm:p-10">
        <Progress value={(step + 1) / STEPS.length} size="sm" label="Avancement du questionnaire" />
        {step === 0 && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
            <Sparkles className="size-4" /> Bienvenue {user?.first_name} !
          </p>
        )}
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{STEPS[step].title}</h1>
        <p className="mt-2 text-muted">{STEPS[step].subtitle}</p>

        <div className="mt-8">
          {step === 0 && <GoalPicker value={goal} onChange={setGoal} />}
          {step === 1 && <LevelHoursPicker level={level} hours={hours} onLevel={setLevel} onHours={setHours} />}
          {step === 2 &&
            (tags ? (
              <>
                <InterestsPicker tags={tags} value={interests} onChange={setInterests} />
                <p className="mt-4 text-sm text-muted">{interests.length} sélectionné{interests.length > 1 ? "s" : ""}</p>
              </>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {Array.from({ length: 12 }, (_, i) => (
                  <Skeleton key={i} className="h-9 w-24 rounded-full" />
                ))}
              </div>
            ))}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0} icon={<ArrowLeft className="size-4" />}>
            Retour
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continuer <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={saving} disabled={!canContinue}>
              Voir mes recommandations
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
