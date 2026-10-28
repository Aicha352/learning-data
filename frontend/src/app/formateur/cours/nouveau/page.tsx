"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CourseForm, EMPTY_COURSE, type CourseFormValues } from "@/components/course/course-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import type { InstructorCourseDetail } from "@/lib/types";

export default function NewCoursePage() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(values: CourseFormValues) {
    setSaving(true);
    setError(null);
    try {
      const course = await api<InstructorCourseDetail>("/api/instructor/courses/", { method: "POST", body: values });
      toast.success("Cours créé. Ajoute maintenant tes modules et tes leçons.");
      router.push(`/formateur/cours/${course.id}?onglet=programme`);
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/formateur/cours" className="hover:text-ink">
            ← Gestion des cours
          </Link>
        }
        title="Nouveau cours"
        subtitle="Commence par les informations générales. Tu ajouteras ensuite les modules, leçons et quiz."
      />
      <Card className="max-w-3xl">
        <CardBody>
          <CourseForm initial={EMPTY_COURSE} onSubmit={create} submitLabel="Créer le cours" error={error} saving={saving} />
        </CardBody>
      </Card>
    </>
  );
}
