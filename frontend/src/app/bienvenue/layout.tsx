import { Logo } from "@/components/layout/logo";
import { RequireRole } from "@/components/layout/require-role";

export const metadata = { title: "Bienvenue" };

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["learner"]}>
      <div className="min-h-screen bg-canvas">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
            <Logo href="/apprenant" />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      </div>
    </RequireRole>
  );
}
