import { AccountSettings } from "@/components/layout/account-settings";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Mon compte" };

export default function InstructorProfilePage() {
  return (
    <>
      <PageHeader title="Mon compte" subtitle="Tes informations personnelles et ton mot de passe." />
      <AccountSettings />
    </>
  );
}
