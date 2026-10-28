import clsx, { type ClassValue } from "clsx";

/** Combine des classes CSS conditionnelles. */
export function cn(...values: ClassValue[]) {
  return clsx(values);
}
