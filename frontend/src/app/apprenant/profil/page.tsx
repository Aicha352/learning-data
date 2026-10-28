"use client";

import { useState } from "react";

import { AccountSettings } from "@/components/layout/account-settings";
import { GoalPicker, InterestsPicker, LevelHoursPicker } from "@/components/learning/preferences-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { LearnerProfile, Tag } from "@/lib/types";

function PreferencesCard({ profile, tags, onSaved }: { profile: LearnerProfile; tags: Tag[]; onSaved: () => void }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [goal, setGoal] = useState(profile.goal);
  const [level, setLevel] = useState(profile.level);
  const [hours, setHours] = useState(profile.weekly_hours);
  const [interests, setInterests] = useState(profile.interests.map((t) => t.id));
  const [saving, setSaving] = useState(false);

  // Les centres d'intérêt déjà choisis restent visibles même s'ils ne sont pas parmi les plus populaires.
  const allTags = [...tags, ...profile.interests.filter((t) => !tags.some((tag) => tag.id === t.id))];

  async function save() {
    setSaving(true);
    try {
      await api("/api/auth/me/profile/", { method: "PUT", body: { goal, level, weekly_hours: hours, interest_ids: interests } });
      await refresh();
      toast.success("Préférences enregistrées : tes recommandations ont été mises à jour.");
      onSaved();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-8">
        <CardHeader title="Mes préférences d'apprentissage" subtitle="Elles servent à personnaliser tes recommandations." />
        <div>
          <p className="mb-3 text-[15px] font-semibold">Objectif principal</p>
          <GoalPicker value={goal} onChange={setGoal} />
        </div>
        <LevelHoursPicker level={level} hours={hours} onLevel={(v) => setLevel(v as LearnerProfile["level"])} onHours={setHours} />
        <div>
          <p className="mb-3 text-[15px] font-semibold">Centres d&apos;intérêt</p>
          <InterestsPicker tags={allTags} value={interests} onChange={setInterests} />
        </div>
        <Button onClick={save} loading={saving} disabled={!goal || !hours}>
          Enregistrer mes préférences
        </Button>
      </CardBody>
    </Card>
  );
}

export default function LearnerProfilePage() {
  const { data: profile, mutate } = useApi<LearnerProfile>("/api/auth/me/profile/");
  const { data: tags } = useApi<Tag[]>("/api/tags/?popular=1");

  return (
    <>
      <PageHeader title="Mon profil" subtitle="Tes informations personnelles et tes préférences d'apprentissage." />
      <div className="space-y-6">
        <AccountSettings />
        {profile && tags ? <PreferencesCard key={profile.goal + profile.level} profile={profile} tags={tags} onSaved={() => mutate()} /> : <Skeleton className="h-96 rounded-2xl" />}
      </div>
    </>
  );
}
