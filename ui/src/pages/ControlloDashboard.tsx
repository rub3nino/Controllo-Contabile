/**
 * ControlloDashboard — Vista principale Controllo Contabile
 * Allineata al mockup Atelier: header pratica, KPI, tabella carte di lavoro.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { AppState, Catalog, UserFacingError } from "../api";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { ALL_SECTIONS, sectionHelp } from "../sectionHelp";

type TableFilter = "all" | "critical" | "ok";

export interface ControlloDashboardProps {
  state: AppState | null;
  catalog: Catalog | null;
  form: {
    client: string;
    period: string;
    done_by: string;
    reviewed_by: string;
    request_date: string;
    activity_date: string;
  };
  patchForm: (patch: Partial<ControlloDashboardProps["form"]>) => void;
  linkDir: string;
  setLinkDir: (v: string) => void;
  setFolderFiles: (files: File[]) => void;
  busy: boolean;
  working: boolean;
  shownError: UserFacingError | null;
  scan: () => Promise<void>;
  run: () => Promise<void>;
  hasFolder: boolean;
  scanned: boolean;
  k: { files: number; classified: number; missing: number; sections_done: number };
  onOpenSection: (id: string) => void;
  onOpenDocs: () => void;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatSync(iso: string | null | undefined) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  return {
    date: d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}

type RowKind = "ok" | "alert" | "pending" | "idle";

function rowKind(status: string, hasMissing: boolean, hasAnomaly: boolean): RowKind {
  const s = (status || "").toLowerCase();
  if (hasAnomaly || s === "✗" || s === "error" || s.includes("anomalia")) return "alert";
  if (hasMissing || s === "wip" || s === "pending" || s.includes("mancante")) return "pending";
  if (s === "✓" || s === "done" || s === "completed" || s === "conforme") return "ok";
  return "idle";
}

export function ControlloDashboard({
  state,
  catalog,
  form,
  patchForm,
  linkDir,
  setLinkDir,
  setFolderFiles,
  busy,
  working,
  shownError,
  scan,
  run,
  hasFolder,
  scanned,
  k,
  onOpenSection,
  onOpenDocs,
}: ControlloDashboardProps) {
  const [filter, setFilter] = useState<TableFilter>("all");
  const [showSetup, setShowSetup] = useState(() => !form.client.trim());

  const clientName = form.client.trim() || state?.pratica?.client || "Nuova verifica";
  const period = form.period || state?.pratica?.period || "";
  const praticaId = state?.pratica?.pratica_id || "—";
  const organo = form.reviewed_by || "Collegio Sindacale";
  const docsCount = (state?.documents || []).length || k.files;
  const sync = formatSync(state?.pratica?.activity_date || form.activity_date || null);

  const rows = useMemo(() => {
    const missingBySection = new Map<string, string[]>();
    for (const m of state?.missing || []) {
      const sid = (m.id || "").charAt(0).toUpperCase();
      const list = missingBySection.get(sid) || [];
      list.push(m.need || m.label || m.id);
      missingBySection.set(sid, list);
    }

    return ALL_SECTIONS.map((id) => {
      const section = state?.sections.find((s) => s.id === id);
      const meta = sectionHelp(id, catalog);
      const missing = missingBySection.get(id) || [];
      const docs = (state?.documents || []).filter(
        (d) => (d.item_id || "").toUpperCase().startsWith(id)
      );
      const kind = rowKind(section?.status || "", missing.length > 0, false);
      const source = docs[0];
      return {
        id,
        title: meta.title,
        blurb: meta.blurb,
        status: section?.status || "—",
        note: section?.note || meta.blurb,
        missing,
        kind,
        sourceName: source?.name || (kind === "idle" ? "—" : "Nessun documento collegato"),
        sourceMeta: source?.item_label || meta.look_for,
      };
    });
  }, [state, catalog]);

  const alerts = rows.filter((r) => r.kind === "alert").length;
  const pending = rows.filter((r) => r.kind === "pending").length;
  const ok = rows.filter((r) => r.kind === "ok").length;
  const done = k.sections_done || ok;
  const pct = Math.round((done / 9) * 100);

  const visible = rows.filter((r) => {
    if (filter === "critical") return r.kind === "alert" || r.kind === "pending";
    if (filter === "ok") return r.kind === "ok";
    return true;
  });

  const nextStep = !form.client.trim()
    ? "Inserisci il nome del cliente per iniziare."
    : !hasFolder
      ? "Seleziona la cartella dei documenti."
      : !scanned
        ? "Premi Scansiona per leggere i file."
        : "Controlla le carte, poi premi Avvia per compilare.";

  return (
    <div className="space-y-6">
      {shownError && (
        <div className="rounded-lg border border-status-red-bg bg-status-red-bg/40 px-4 py-3">
          <div className="flex items-start gap-3">
            <Icon name="error" size="md" className="text-status-red-text mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-status-red-text">{shownError.title}</p>
              {shownError.detail && (
                <p className="mt-1 text-[12px] text-status-red-text/80">{shownError.detail}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="w-10 h-10 rounded-lg bg-surface-card border border-border-subtle flex items-center justify-center mb-3">
            <Icon name="description" size="lg" className="text-ink-secondary" />
          </div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-tight text-ink-primary">
            {clientName}
            <span className="text-ink-secondary font-medium"> — Verifica ex art. 2409-ter c.c.</span>
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-secondary">
            <StatusBadge variant={working ? "warning" : done >= 9 ? "success" : "warning"}>
              {working ? "Elaborazione in corso" : `In corso · ${done}/9 sezioni completate`}
            </StatusBadge>
            <span>
              Codice Pratica:{" "}
              <span className="font-mono text-ink-primary">{praticaId === "—" ? "—" : truncate(praticaId, 28)}</span>
            </span>
            <span>
              Periodo: <span className="text-ink-primary">{period || "—"}</span>
            </span>
            <span>
              Organo: <span className="text-ink-primary">{organo}</span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenDocs}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border-subtle bg-surface-card text-[13px] font-medium text-ink-primary hover:bg-surface-hover"
            >
              <Icon name="folder_open" size="sm" />
              Storico Documenti ({docsCount} file)
            </button>
            <a
              href="/api/export/xlsx"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border-subtle bg-surface-card text-[13px] font-medium text-ink-primary hover:bg-surface-hover"
            >
              <Icon name="download" size="sm" />
              Esporta in Excel (.xlsx)
            </a>
            <button
              type="button"
              onClick={() => setShowSetup((v) => !v)}
              data-onboarding="folder"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-ink-primary text-[13px] font-medium text-white hover:bg-ink-primary/90"
            >
              <Icon name="add" size="sm" />
              Nuova Verifica
            </button>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
          <span className="inline-flex items-center h-6 px-2 rounded bg-tint-gray-bg text-[11px] text-tint-gray-text">
            Rif. SA Italia 250B
          </span>
          <span className="inline-flex items-center h-6 px-2 rounded bg-tint-gray-bg text-[11px] text-tint-gray-text">
            D.Lgs. 39/2010
          </span>
        </div>
      </div>

      {/* Setup panel */}
      {showSetup && (
        <Card padding="lg">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-primary">Configurazione pratica</h2>
              <p className="text-[13px] text-ink-secondary mt-0.5">{nextStep}</p>
            </div>
            {form.client.trim() && (
              <button
                type="button"
                onClick={() => setShowSetup(false)}
                className="p-1 rounded hover:bg-surface-hover text-ink-tertiary"
              >
                <Icon name="close" size="sm" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12px] text-ink-secondary mb-1">Cliente</span>
              <input
                value={form.client}
                onChange={(e) => patchForm({ client: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-[14px] text-ink-primary outline-none focus:border-ink-secondary"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] text-ink-secondary mb-1">Periodo</span>
              <input
                value={form.period}
                onChange={(e) => patchForm({ period: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-[14px] text-ink-primary outline-none focus:border-ink-secondary"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[12px] text-ink-secondary mb-1">Cartella documenti</span>
              <input
                value={linkDir}
                onChange={(e) => {
                  setLinkDir(e.target.value);
                  if (e.target.value) setFolderFiles([]);
                }}
                placeholder="/Volumes/…/documenti"
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-[14px] text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={scan}
              disabled={busy || !hasFolder || !form.client.trim()}
              data-onboarding="scan"
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border border-border-subtle bg-surface-card text-[13px] font-medium text-ink-primary hover:bg-surface-hover disabled:opacity-50"
            >
              <Icon name="document_scanner" size="sm" />
              Scansiona
            </button>
            <button
              type="button"
              onClick={run}
              disabled={busy || state?.running || !scanned}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-ink-primary text-[13px] font-medium text-white hover:bg-ink-primary/90 disabled:opacity-50"
            >
              <Icon name="play_arrow" size="sm" />
              {state?.running || busy ? "In corso…" : "Avvia compilazione"}
            </button>
          </div>
        </Card>
      )}

      {working && (
        <Card padding="base">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-[13px] font-medium text-ink-primary">{state?.job_label || "Elaborazione…"}</div>
              <div className="text-[12px] text-ink-secondary">
                {state?.job_step && state?.job_total ? `Passo ${state.job_step} di ${state.job_total}` : ""}
              </div>
            </div>
            <div className="text-[13px] font-mono text-ink-secondary">{Math.round(state?.progress || 0)}%</div>
          </div>
          <div className="h-1.5 rounded-full bg-surface-recessed overflow-hidden">
            <div
              className="h-full bg-ink-primary rounded-full work-bar-fill"
              style={{ width: `${Math.max(4, state?.progress || 0)}%` }}
            />
          </div>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Carte verificate"
          value={`${done} / 9`}
          hint={done === 9 ? "Nessun rilievo bloccante." : `${9 - done} sezioni ancora aperte.`}
          icon="check_circle"
          iconWrap="bg-tint-green-bg text-tint-green-text"
          badge={`${pct}%`}
          badgeClass="bg-status-green-bg text-status-green-text"
        />
        <KpiCard
          label="Anomalie rilevate"
          value={String(alerts)}
          hint={alerts ? "Richiede ispezione sulla carta evidenziata." : "Nessuna anomalia in evidenza."}
          icon="error"
          iconWrap="bg-status-red-bg text-status-red-text"
          badge={alerts ? "Riconciliazione" : "Ok"}
          badgeClass={alerts ? "bg-status-red-bg text-status-red-text" : "bg-status-green-bg text-status-green-text"}
          valueClass={alerts ? "text-status-red-text" : undefined}
        />
        <KpiCard
          label="In sospeso"
          value={String(pending || k.missing)}
          hint={pending || k.missing ? "Documentazione o valorizzazioni in attesa." : "Niente in coda."}
          icon="schedule"
          iconWrap="bg-status-yellow-bg text-status-yellow-text"
          badge={pending || k.missing ? "In attesa" : "Completo"}
          badgeClass="bg-status-yellow-bg text-status-yellow-text"
        />
        <KpiCard
          label="Ultima sincronia"
          value={sync.date}
          hint={sync.time ? `Ore ${sync.time}` : "Nessuna sincronizzazione recente."}
          icon="sync"
          iconWrap="bg-tint-blue-bg text-tint-blue-text"
        />
      </div>

      {/* Workpapers table */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border-muted">
          <h2 className="text-[15px] font-semibold text-ink-primary">Carte di Lavoro Programmate</h2>
          <div className="flex items-center gap-1">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              Tutte ({rows.length})
            </FilterTab>
            <FilterTab active={filter === "critical"} onClick={() => setFilter("critical")}>
              Critiche ({alerts + pending})
            </FilterTab>
            <FilterTab active={filter === "ok"} onClick={() => setFilter("ok")}>
              Conformi ({ok})
            </FilterTab>
            <span className="w-px h-4 bg-border-subtle mx-1" />
            <button type="button" className="p-1.5 rounded hover:bg-surface-hover text-ink-tertiary" title="Filtra">
              <Icon name="filter_list" size="sm" />
            </button>
            <button type="button" className="p-1.5 rounded hover:bg-surface-hover text-ink-tertiary" title="Ordina">
              <Icon name="swap_vert" size="sm" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-muted">
                <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary w-16">Sez.</th>
                <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Ambito di Controllo Contabile</th>
                <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Esito &amp; Note di Revisione</th>
                <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Fonte Documentale Collegata</th>
                <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary text-right">€ Scostamento</th>
                <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={`
                    border-b border-border-muted last:border-b-0
                    ${row.kind === "alert" ? "bg-status-red-bg/40" : "bg-surface-card"}
                  `}
                >
                  <td className="px-5 py-4 align-top">
                    <span className="text-[13px] font-semibold text-ink-primary">{row.id}</span>
                  </td>
                  <td className="px-3 py-4 align-top min-w-[220px]">
                    <div className="text-[13px] font-medium text-ink-primary">{row.title}</div>
                    <div className="text-[12px] text-ink-tertiary mt-0.5 line-clamp-1">{row.blurb}</div>
                  </td>
                  <td className="px-3 py-4 align-top min-w-[240px]">
                    <OutcomeBadge kind={row.kind} status={row.status} missing={row.missing} />
                    <div className={`text-[12px] mt-1.5 line-clamp-2 ${row.kind === "alert" ? "text-status-red-text" : "text-ink-secondary"}`}>
                      {row.missing[0] || row.note || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top min-w-[200px]">
                    <div className="flex items-start gap-2">
                      <Icon name="description" size="sm" className="text-ink-tertiary mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[13px] text-ink-primary truncate">{row.sourceName}</div>
                        <div className="text-[11px] text-ink-tertiary truncate">{row.sourceMeta}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top text-right">
                    <span className={`text-[13px] font-medium ${row.kind === "alert" ? "text-status-red-text" : "text-ink-tertiary"}`}>
                      {row.kind === "alert" ? "Da ispezionare" : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top text-right">
                    {row.kind === "alert" ? (
                      <button
                        type="button"
                        onClick={() => onOpenSection(row.id)}
                        className="inline-flex items-center h-8 px-3 rounded-md bg-status-red-bg text-[12px] font-medium text-status-red-text hover:bg-status-red-bg/80"
                      >
                        Ispeziona
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenSection(row.id)}
                        className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary"
                      >
                        Apri
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        h-8 px-2.5 rounded-md text-[12px] font-medium transition-colors
        ${active ? "bg-surface-hover text-ink-primary" : "text-ink-secondary hover:bg-surface-hover"}
      `}
    >
      {children}
    </button>
  );
}

function OutcomeBadge({
  kind,
  status,
  missing,
}: {
  kind: RowKind;
  status: string;
  missing: string[];
}) {
  if (kind === "alert") {
    return <StatusBadge variant="error">Anomalia{missing[0] ? `: ${truncate(missing[0], 28)}` : ""}</StatusBadge>;
  }
  if (kind === "pending") {
    return <StatusBadge variant="warning">In attesa</StatusBadge>;
  }
  if (kind === "ok") {
    return <StatusBadge variant="success">Conforme</StatusBadge>;
  }
  return <StatusBadge variant="neutral">{status === "—" ? "Da avviare" : status}</StatusBadge>;
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  iconWrap,
  badge,
  badgeClass,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  iconWrap: string;
  badge?: string;
  badgeClass?: string;
  valueClass?: string;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">{label}</div>
          <div className={`mt-1 text-[26px] leading-8 font-semibold tracking-tight ${valueClass || "text-ink-primary"}`}>
            {value}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge && (
            <span className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${badgeClass}`}>
              {badge}
            </span>
          )}
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${iconWrap}`}>
            <Icon name={icon} size="sm" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-secondary">{hint}</p>
    </Card>
  );
}
