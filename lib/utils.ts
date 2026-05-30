import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre";
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || "An Allianz HR Platform — Project by Kris";
