/**
 * WorkspaceTabs — Selezione vista (migrato ad Atelier Document System)
 * NOTA: Questo componente non è più usato nella nuova UI con sidebar.
 * Mantenuto per compatibilità.
 */

export function WorkspaceTabs({
  active,
  onChange,
}: {
  active: "excel" | "domain";
  onChange: (value: "excel" | "domain") => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border-subtle bg-surface-sidebar p-xxs"
      role="tablist"
      aria-label="Vista di lavoro"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === "excel"}
        onClick={() => onChange("excel")}
        className={`min-h-9 rounded px-md text-label-sm font-medium transition-colors-fast ${
          active === "excel"
            ? "bg-surface-card text-ink-primary"
            : "text-ink-secondary hover:text-ink-primary"
        }`}
      >
        Flusso Excel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "domain"}
        onClick={() => onChange("domain")}
        className={`min-h-9 rounded px-md text-label-sm font-medium transition-colors-fast ${
          active === "domain"
            ? "bg-surface-card text-ink-primary"
            : "text-ink-secondary hover:text-ink-primary"
        }`}
      >
        Dashboard verifiche
      </button>
    </div>
  );
}
