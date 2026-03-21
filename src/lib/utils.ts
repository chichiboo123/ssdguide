import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Canonical copy format for an achievement standard: [코드] 내용 */
export function formatStandard(s: { 코드: string; 내용: string }): string {
  return `[${s.코드}] ${s.내용}`
}
