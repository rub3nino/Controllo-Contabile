/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#1A1A1A",
        muted: "#6B6B6B",
        line: "#E8E8E4",
        paper: "#F6F6F3",
        card: "#FFFFFF",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,20,0.04), 0 8px 24px rgba(20,20,20,0.04)",
      },
    },
  },
  plugins: [],
};
