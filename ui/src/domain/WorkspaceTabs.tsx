export function WorkspaceTabs({ active, onChange }: { active: "excel" | "domain"; onChange: (value: "excel" | "domain") => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-xl border border-line bg-paper p-1" role="tablist" aria-label="Vista di lavoro">
      <button type="button" role="tab" aria-selected={active === "excel"} onClick={() => onChange("excel")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${active === "excel" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
        Flusso Excel
      </button>
      <button type="button" role="tab" aria-selected={active === "domain"} onClick={() => onChange("domain")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${active === "domain" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
        Dashboard verifiche
      </button>
    </div>
  );
}
