"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { COVER_COLORS, LEVELS } from "@/lib/constants";
import { useApi } from "@/lib/hooks";
import type { Category } from "@/lib/types";

import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/form";

export interface CourseFormValues {
  title: string;
  subtitle: string;
  description: string;
  category: number | "";
  level: string;
  tags: string[];
  learning_outcomes: string[];
  prerequisites: string;
  cover_color: string;
}

export const EMPTY_COURSE: CourseFormValues = {
  title: "",
  subtitle: "",
  description: "",
  category: "",
  level: "beginner",
  tags: [],
  learning_outcomes: [""],
  prerequisites: "",
  cover_color: COVER_COLORS[0],
};

/** Formulaire des informations générales d'un cours (création et modification). */
export function CourseForm({
  initial,
  onSubmit,
  submitLabel,
  error,
  saving,
}: {
  initial: CourseFormValues;
  onSubmit: (values: CourseFormValues) => void;
  submitLabel: string;
  error: ApiError | null;
  saving: boolean;
}) {
  const { data: categories } = useApi<Category[]>("/api/categories/");
  const [values, setValues] = useState<CourseFormValues>(initial);
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  function addTag() {
    const name = tagInput.trim().replace(/,$/, "");
    if (name && !values.tags.some((t) => t.toLowerCase() === name.toLowerCase()) && values.tags.length < 15) set("tags", [...values.tags, name]);
    setTagInput("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({ ...values, learning_outcomes: values.learning_outcomes.filter((o) => o.trim()) });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && !Object.keys(error.errors).length && <p className="rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">{error.message}</p>}
      <Input label="Titre du cours" required value={values.title} onChange={(e) => set("title", e.target.value)} error={error?.field("title")} placeholder="Ex. : Pandas : manipuler des données" />
      <Input label="Sous-titre" value={values.subtitle} onChange={(e) => set("subtitle", e.target.value)} error={error?.field("subtitle")} placeholder="Une phrase qui donne envie de suivre le cours" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Catégorie"
          required
          placeholder="Choisir…"
          value={values.category}
          onChange={(e) => set("category", e.target.value ? Number(e.target.value) : "")}
          options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
          error={error?.field("category")}
        />
        <Select label="Niveau" value={values.level} onChange={(e) => set("level", e.target.value)} options={LEVELS} error={error?.field("level")} />
      </div>
      <Textarea
        label="Description"
        rows={5}
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        error={error?.field("description")}
        hint={`${values.description.trim().length} caractères · 80 minimum pour la publication. La description sert aussi à calculer l'embedding du cours.`}
      />
      <div>
        <p className="mb-1.5 text-[13px] font-medium">Mots-clés</p>
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-white p-2">
          {values.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1.5 pl-3 text-sm font-medium text-brand-700">
              {tag}
              <button type="button" onClick={() => set("tags", values.tags.filter((t) => t !== tag))} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={`Retirer ${tag}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder={values.tags.length ? "Ajouter…" : "Tape un mot-clé puis Entrée"}
            className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            aria-label="Ajouter un mot-clé"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">Au moins 3 mots-clés : ils aident le système à trouver les cours similaires.</p>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium">Ce que l&apos;on va apprendre</p>
        <div className="space-y-2">
          {values.learning_outcomes.map((outcome, index) => (
            <div key={index} className="flex gap-2">
              <Input
                containerClassName="flex-1"
                value={outcome}
                onChange={(e) => set("learning_outcomes", values.learning_outcomes.map((o, i) => (i === index ? e.target.value : o)))}
                placeholder={`Objectif ${index + 1}`}
                aria-label={`Objectif ${index + 1}`}
              />
              <Button
                variant="ghost"
                aria-label="Supprimer cet objectif"
                onClick={() => set("learning_outcomes", values.learning_outcomes.filter((_, i) => i !== index))}
                disabled={values.learning_outcomes.length <= 1}
                className="h-11 px-3"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => set("learning_outcomes", [...values.learning_outcomes, ""])} disabled={values.learning_outcomes.length >= 12}>
          Ajouter un objectif
        </Button>
      </div>
      <Input label="Prérequis (facultatif)" value={values.prerequisites} onChange={(e) => set("prerequisites", e.target.value)} placeholder="Ex. : avoir suivi Introduction à Python" />
      <div>
        <p className="mb-2 text-[13px] font-medium">Couleur de la vignette</p>
        <div className="flex flex-wrap gap-2">
          {COVER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Couleur ${color}`}
              aria-pressed={values.cover_color === color}
              onClick={() => set("cover_color", color)}
              className={cn("size-9 rounded-lg border border-line", values.cover_color === color && "ring-2 ring-brand-600 ring-offset-2")}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <Button type="submit" loading={saving} disabled={!values.title.trim() || !values.category}>
        {submitLabel}
      </Button>
    </form>
  );
}
