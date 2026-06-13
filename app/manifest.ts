import type { MetadataRoute } from "next";

// Web app manifest so Tru Hyre is installable (PWA). Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tru Hyre",
    short_name: "Tru Hyre",
    description: "An Allianz HR Platform",
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
