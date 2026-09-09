/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // ─────────────────────────────────────────────────────────────────────
        // Atelier Document System — Token colore
        // ─────────────────────────────────────────────────────────────────────

        // Superfici
        "surface": "#faf9f6",
        "surface-sidebar": "#f7f6f3",
        "surface-card": "#ffffff",
        "surface-hover": "#f1f1ef",
        "surface-recessed": "#eaeae8",
        "surface-sidebar-hover": "#ebebea",

        // Bordi
        "border-subtle": "#e5e5e3",
        "border-muted": "#eaeae8",

        // Inchiostro / testo
        "ink-primary": "#232321",
        "ink-secondary": "#5f5e5b",
        "ink-tertiary": "#9b9a97",

        // Accenti funzionali tenui (fill + testo abbinato)
        "tint-blue-bg": "#edf5f8",
        "tint-blue-text": "#2b5966",
        "tint-green-bg": "#edf3ec",
        "tint-green-text": "#2b593f",
        "tint-yellow-bg": "#fbf3db",
        "tint-yellow-text": "#785e07",
        "tint-orange-bg": "#faece3",
        "tint-orange-text": "#8f471a",
        "tint-red-bg": "#fdebec",
        "tint-red-text": "#933038",
        "tint-gray-bg": "#efefed",
        "tint-gray-text": "#454443",

        // Badge di stato prominenti
        "status-green-bg": "#e6f4ea",
        "status-green-text": "#137333",
        "status-red-bg": "#fce8e6",
        "status-red-text": "#c5221f",
        "status-yellow-bg": "#fef7e0",
        "status-yellow-text": "#b06000",

        // ─────────────────────────────────────────────────────────────────────
        // Legacy tokens (deprecati, da rimuovere dopo migrazione completa)
        // ─────────────────────────────────────────────────────────────────────
        ink: "#1A1A1A",
        muted: "#6B6B6B",
        line: "#E8E8E4",
        paper: "#F6F6F3",
        card: "#FFFFFF",
      },
      spacing: {
        // Scala spaziatura 8px
        "xxs": "0.125rem",  // 2px
        "xs": "0.25rem",    // 4px
        "sm": "0.5rem",     // 8px
        "md": "0.75rem",    // 12px
        "base": "1rem",     // 16px
        "lg": "1.5rem",     // 24px
        "xl": "2rem",       // 32px
        "2xl": "3rem",      // 48px
        "3xl": "4.5rem",    // 72px

        // Larghezze layout
        "sidebar-expanded": "16.25rem",  // 260px
        "sidebar-collapsed": "3.5rem",   // 56px
        "content-narrow": "44rem",       // 704px
        "content-standard": "56rem",     // 896px
        "content-wide": "72rem",         // 1152px
      },
      borderRadius: {
        "sm": "0.125rem",   // 2px
        "DEFAULT": "0.25rem", // 4px
        "md": "0.375rem",   // 6px
        "lg": "0.5rem",     // 8px
        "xl": "0.75rem",    // 12px
        "full": "9999px",
      },
      boxShadow: {
        // Unica ombra ammessa: dropdown/menu contestuali (livello 3)
        "dropdown": "0 1px 2px rgba(15,15,15,.04), 0 4px 12px rgba(15,15,15,.06)",
        // Legacy (da rimuovere)
        "card": "0 1px 2px rgba(20,20,20,0.04), 0 8px 24px rgba(20,20,20,0.04)",
      },
      fontSize: {
        // Scala tipografica Atelier Document System
        "display": ["2.5rem", { lineHeight: "3rem", letterSpacing: "-0.03em", fontWeight: "700" }],
        "headline-lg": ["1.875rem", { lineHeight: "2.375rem", letterSpacing: "-0.025em", fontWeight: "600" }],
        "headline-md": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.018em", fontWeight: "600" }],
        "headline-sm": ["1.0625rem", { lineHeight: "1.5rem", letterSpacing: "-0.012em", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.625rem", letterSpacing: "-0.011em", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.375rem", letterSpacing: "-0.006em", fontWeight: "400" }],
        "body-sm": ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0em", fontWeight: "400" }],
        "label-md": ["0.8125rem", { lineHeight: "1.125rem", letterSpacing: "-0.005em", fontWeight: "500" }],
        "label-sm": ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.01em", fontWeight: "500" }],
        "code": ["0.78125rem", { lineHeight: "1.125rem", letterSpacing: "0em", fontWeight: "400" }],
      },
      backdropBlur: {
        "modal": "2px",
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out",
        "toast-out": "toast-out 0.15s ease-in forwards",
        "dropdown-in": "dropdown-in 0.15s ease-out",
        "modal-in": "modal-in 0.2s ease-out",
        "command-palette-in": "command-palette-in 0.15s ease-out",
        "tooltip-in": "tooltip-in 0.2s ease-out",
        "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(100%)" },
        },
        "dropdown-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "command-palette-in": {
          "0%": { opacity: "0", transform: "scale(0.98) translateY(-8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "tooltip-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};
