import type { MetadataRoute } from "next";
import { isFeatureEnabled } from "@/lib/features";

// Web app manifest so Tru Hyre is installable (PWA). Served at /manifest.webmanifest.
// Honors the `pwa` feature flag: when disabled, returns a minimal manifest with
// no installability metadata (no start_url/display), so browsers won't offer to
// install the app.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  if (!(await isFeatureEnabled("pwa"))) {
    return { name: "Tru Hyre", short_name: "Tru Hyre" };
  }
  return {
    name: "Tru Hyre",
    short_name: "Tru Hyre",
    description: "An internal hiring platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#10b981",
    icons: [
      // Uses the existing favicon as a baseline icon. Replace with dedicated
      // PNG icons (192/512) when brand assets are ready.
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
