/**
 * Card — Contenitore con bordo hairline, nessuna ombra.
 * Per contenuti strutturati: tabelle, metriche, sezioni.
 */

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Se true, usa sfondo sidebar invece di bianco */
  recessed?: boolean;
  /** Padding interno (default: base = 16px) */
  padding?: "none" | "sm" | "base" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-sm",
  base: "p-base",
  lg: "p-lg",
};

export function Card({
  children,
  className = "",
  recessed = false,
  padding = "base",
}: CardProps) {
  return (
    <div
      className={`
        rounded-lg border border-border-subtle
        ${recessed ? "bg-surface-sidebar" : "bg-surface-card"}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  /** Elemento a destra (badge, azione) */
  trailing?: ReactNode;
  className?: string;
}

export function CardHeader({ children, trailing, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`
        flex items-center justify-between gap-base
        pb-md mb-md border-b border-border-muted
        ${className}
      `}
    >
      <h3 className="text-headline-sm text-ink-primary">{children}</h3>
      {trailing && <div className="flex items-center gap-sm">{trailing}</div>}
    </div>
  );
}

interface CalloutProps {
  children: ReactNode;
  variant?: "default" | "info" | "warning" | "success";
  className?: string;
}

const calloutVariants = {
  default: "bg-surface-recessed border-border-muted",
  info: "bg-tint-blue-bg border-tint-blue-bg",
  warning: "bg-tint-yellow-bg border-tint-yellow-bg",
  success: "bg-tint-green-bg border-tint-green-bg",
};

export function Callout({ children, variant = "default", className = "" }: CalloutProps) {
  return (
    <div
      className={`
        rounded-lg border p-md
        ${calloutVariants[variant]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
