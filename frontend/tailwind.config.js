/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bcd3ff",
          300: "#8fb5ff",
          400: "#5c8dff",
          500: "#3566f6",
          600: "#2049e3",
          700: "#193ac0",
          800: "#19339b",
          900: "#1a307b",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dfe3ea",
          300: "#c3cad6",
          400: "#8d97a8",
          500: "#667085",
          600: "#4b5464",
          700: "#3a4150",
          800: "#262b36",
          900: "#141821",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.12)",
        raised: "0 2px 6px rgba(16,24,40,0.06), 0 20px 40px -20px rgba(16,24,40,0.2)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "pulse-soft": "pulseSoft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
