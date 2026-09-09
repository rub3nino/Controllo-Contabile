/**
 * ThemeToggle.tsx — Componente per switch tema dark/light
 * 
 * Utilizzo:
 * <ThemeToggle />
 */

import { useState } from "react";
import { Icon } from "./Icon";
import { useDarkMode, type Theme } from "../hooks/useDarkMode";

// ─────────────────────────────────────────────────────────────────────────────
// Simple Toggle Button
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, toggleTheme } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-lg hover:bg-surface-hover transition-colors ${className}`}
      title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      aria-label={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
    >
      <Icon
        name={isDark ? "light_mode" : "dark_mode"}
        size="sm"
        className="text-ink-secondary"
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Selector (with system option)
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Chiaro", icon: "light_mode" },
    { value: "dark", label: "Scuro", icon: "dark_mode" },
    { value: "system", label: "Sistema", icon: "devices" },
  ];

  const current = options.find((o) => o.value === theme) || options[2];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
      >
        <Icon name={current.icon} size="sm" className="text-ink-secondary" />
        <span className="text-label-sm text-ink-primary">{current.label}</span>
        <Icon name="expand_more" size="sm" className="text-ink-tertiary" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-40 bg-surface-card rounded-lg border border-border-subtle shadow-dropdown z-50 overflow-hidden animate-dropdown-in">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 text-left
                  ${theme === opt.value ? "bg-surface-hover" : "hover:bg-surface-hover"}
                  transition-colors
                `}
              >
                <Icon name={opt.icon} size="sm" className="text-ink-tertiary" />
                <span className="text-label-sm text-ink-primary">{opt.label}</span>
                {theme === opt.value && (
                  <Icon name="check" size="sm" className="ml-auto text-ink-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
