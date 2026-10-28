import { Suspense } from "react";

import { CatalogueView } from "@/components/course/catalogue-view";
import { PageLoader } from "@/components/ui/spinner";

export const metadata = { title: "Catalogue des cours" };

export default function CataloguePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Suspense fallback={<PageLoader />}>
        <CatalogueView />
      </Suspense>
    </div>
  );
}
