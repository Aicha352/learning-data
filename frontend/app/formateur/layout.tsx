import { AppShell } from "@/components/layout/app-shell";
import { RequireRole } from "@/components/layout/require-role";

export const metadata = { title: { default: "Espace formateur", template: "%s · Learning Data" } };

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["instructor", "admin"]}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
