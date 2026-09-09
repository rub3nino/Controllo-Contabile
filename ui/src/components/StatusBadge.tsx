/**
 * StatusBadge — Badge di stato con varianti semantiche.
 * Usato per indicare lo stato di carte di lavoro, documenti, sezioni.
 */

type BadgeVariant = "success" | "warning" | "error" | "neutral" | "info";

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-status-green-bg text-status-green-text",
  warning: "bg-status-yellow-bg text-status-yellow-text",
  error: "bg-status-red-bg text-status-red-text",
  neutral: "bg-tint-gray-bg text-tint-gray-text",
  info: "bg-tint-blue-bg text-tint-blue-text",
};

const dotColors: Record<BadgeVariant, string> = {
  success: "bg-status-green-text",
  warning: "bg-status-yellow-text",
  error: "bg-status-red-text",
  neutral: "bg-tint-gray-text",
  info: "bg-tint-blue-text",
};

export function StatusBadge({
  variant,
  children,
  showDot = true,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-xs px-sm py-xxs
        rounded text-label-sm font-medium
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {showDot && (
        <span
          className={`w-[6px] h-[6px] rounded-full ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/**
 * Mappa lo status esistente dell'app ai variant del badge.
 */
export function mapStatusToVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === "✓" || s === "done" || s === "completed" || s === "conforme") {
    return "success";
  }
  if (s === "wip" || s === "pending" || s === "mancante" || s === "in sospeso") {
    return "warning";
  }
  if (s === "✗" || s === "error" || s === "anomalia" || s === "errore") {
    return "error";
  }
  if (s === "n/a" || s === "skip" || s === "skipped") {
    return "neutral";
  }
  return "neutral";
}
