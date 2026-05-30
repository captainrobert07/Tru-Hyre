import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-instrument-serif)", "Instrument Serif", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        attention: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        ink: {
          DEFAULT: "#0b1220",
          soft: "#475569",
          muted: "#94a3b8",
        },
        hairline: "#e6ebf2",
        surface: "#ffffff",
        canvas: "#f4f5f7",
        ink_inverted: "#0a0d12",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
        pop: "0 12px 40px rgba(15,23,42,0.10)",
        pill: "0 1px 0 rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
      },
      borderRadius: {
        xl2: "16px",
        xl3: "22px",
        xl4: "28px",
      },
      fontSize: {
        display: ["clamp(2.75rem, 5.5vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        hero: ["clamp(3.5rem, 8vw, 6.5rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
};

export default config;
