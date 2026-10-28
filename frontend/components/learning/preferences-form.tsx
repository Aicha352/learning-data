"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { GOALS, LEVELS, WEEKLY_HOURS } from "@/lib/constants";
import type { Tag } from "@/lib/types";

import { Chip } from "../ui/form";

export interface Preferences {
  goal: string;
  level: string;
  weekly_hours: string;
  interest_ids: number[];
}

export function GoalPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Objectif principal">
      {GOALS.map((goal) => {
        const active = value === goal.value;
        return (
          <button
            key={goal.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(goal.value)}
            className={cn(
              "relative rounded-xl border p-4 text-left transition-colors",
              active ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line bg-white hover:border-slate-300",
            )}
          >
            {active && (
              <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                <Check className="size-3.5" />
              </span>
            )}
            <span className={cn("block text-[15px] font-semibold", active && "text-brand-700")}>{goal.label}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{goal.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LevelHoursPicker({
  level,
  hours,
  onLevel,
  onHours,
}: {
  level: string;
  hours: string;
  onLevel: (value: string) => void;
  onHours: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-[15px] font-semibold">Ton niveau actuel</p>
        <div className="flex flex-wrap gap-2.5">
          {LEVELS.map((item) => (
            <Chip key={item.value} active={level === item.value} onClick={() => onLevel(item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-[15px] font-semibold">Temps disponible par semaine</p>
        <div className="flex flex-wrap gap-2.5">
          {WEEKLY_HOURS.map((item) => (
            <Chip key={item.value} active={hours === item.value} onClick={() => onHours(item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InterestsPicker({ tags, value, onChange }: { tags: Tag[]; value: number[]; onChange: (value: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {tags.map((tag) => {
        const active = value.includes(tag.id);
        return (
          <Chip key={tag.id} active={active} onClick={() => onChange(active ? value.filter((id) => id !== tag.id) : [...value, tag.id])}>
            {active && <Check className="size-3.5" />}
            {tag.name}
          </Chip>
        );
      })}
    </div>
  );
}
