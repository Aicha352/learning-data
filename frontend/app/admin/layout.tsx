import { AppShell } from "@/components/layout/app-shell";
import { RequireRole } from "@/components/layout/require-role";

export const metadata = { title: { default: "Administration", template: "%s · Learning Data" } };

const ADMIN_ONLY = ["admin"] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={[...ADMIN_ONLY]}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
