/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bbe0ff",
          300: "#8ccbff",
          400: "#56acff",
          500: "#2f8bff",
          600: "#186bf5",
          700: "#1455e1",
          800: "#1746b6",
          900: "#193e8f",
        },
      },
    },
  },
  plugins: [],
};
