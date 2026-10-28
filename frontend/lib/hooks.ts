"use client";

import { useEffect, useState } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { fetcher } from "./api";

/** Charge une ressource de l'API (avec cache et revalidation). `null` = ne rien charger. */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, { revalidateOnFocus: false, ...config });
}

/** Retarde la mise à jour d'une valeur (recherche en direct). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
