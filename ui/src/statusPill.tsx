/**
 * statusPill.tsx — Legacy pill renderer (migrato ad Atelier Document System)
 *
 * Mantiene la funzione `pill()` per compatibilità con codice esistente,
 * ma usa internamente i nuovi StatusBadge.
 */

import { StatusBadge, mapStatusToVariant } from "./components";

/**
 * Renderizza un badge di stato inline.
 * Usare StatusBadge direttamente per nuovo codice.
 */
export function pill(status: string) {
  if (!status) return null;

  const variant = mapStatusToVariant(status);
  const label = formatStatusLabel(status);

  return (
    <StatusBadge variant={variant} showDot={true}>
      {label}
    </StatusBadge>
  );
}

function formatStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "✓" || s === "done" || s === "completed") return "OK";
  if (s === "✗" || s === "skip" || s === "skipped") return "Skip";
  if (s === "wip" || s === "pending") return "wip";
  if (s === "n/a") return "N/A";
  return status;
}
