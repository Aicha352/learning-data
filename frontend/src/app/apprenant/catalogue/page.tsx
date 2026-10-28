import { Suspense } from "react";

import { CatalogueView } from "@/components/course/catalogue-view";
import { PageLoader } from "@/components/ui/spinner";

export const metadata = { title: "Catalogue" };

export default function LearnerCataloguePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CatalogueView />
    </Suspense>
  );
}
