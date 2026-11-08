/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          // Ember-orange-to-black theme
          bg: "#080706",
          surface: "#120e0b",
          surfaceElevated: "#1a1410",
          surfaceHighlight: "#241b14",
          border: "#33251a",
          borderHover: "#523824",
          borderActive: "#f97316",
          // Primary accent: #F97316
          ember: "#f97316",
          emberLight: "#fdba74",
          emberDark: "#c2410c",
          emberMuted: "rgba(249, 115, 22, 0.14)",
          emberGlow: "rgba(249, 115, 22, 0.22)",
          // Backward compatibility mappings
          gold: "#f97316",
          goldLight: "#fdba74",
          goldDark: "#c2410c",
          goldMuted: "rgba(249, 115, 22, 0.14)",
          goldGlow: "rgba(249, 115, 22, 0.22)",
          // High-contrast readable neutrals
          textPrimary: "#fdfaf7",
          textSecondary: "#e2dad0",
          textMuted: "#b5aca0",
          textDim: "#998f82",
          error: "#f87171",
          errorBg: "rgba(239, 68, 68, 0.12)",
          errorBorder: "rgba(239, 68, 68, 0.35)",
          badgeBg: "rgba(249, 115, 22, 0.12)",
          badgeBorder: "rgba(249, 115, 22, 0.32)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
        mono: [
          "'SF Mono'",
          "Consolas",
          "'Liberation Mono'",
          "Menlo",
          "Courier",
          "monospace",
        ],
      },
      boxShadow: {
        emberGlow: "0 0 25px -5px rgba(249, 115, 22, 0.20)",
        card: "0 10px 30px -10px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
