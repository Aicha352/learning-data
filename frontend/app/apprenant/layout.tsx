import { AppShell } from "@/components/layout/app-shell";
import { RequireRole } from "@/components/layout/require-role";

export const metadata = { title: { default: "Espace apprenant", template: "%s · Learning Data" } };

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["learner"]}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
