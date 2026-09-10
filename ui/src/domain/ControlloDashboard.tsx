/**
 * ControlloDashboard — Superficie di lavoro: titolo, proprietà, tabella A–I.
 */

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AppState, Catalog, UserFacingError } from "../api";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { GhostButton, PageHeader, PrimaryButton, ToolButton } from "../shell/PageHeader";
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

const SECTION_ICONS: Record<string, string> = {
  A: "account_tree",
  B: "menu_book",
  C: "payments",
  D: "account_balance",
  E: "account_balance_wallet",
  F: "gavel",
  G: "analytics",
  H: "forum",
  I: "event_note",
};

function fileIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return { icon: "picture_as_pdf", className: "text-[#e05252]" };
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return { icon: "table_view", className: "text-[#0f9d58]" };
  if (n.endsWith(".zip")) return { icon: "folder_zip", className: "text-[#d97706]" };
  return { icon: "description", className: "text-[#4285f4]" };
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
  const [showDocs, setShowDocs] = useState(false);

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

  const openRow = (id: string) => onOpenSection(id);

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openRow(id);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full flex-1 min-h-0">
      {shownError && (
        <div className="rounded-md border border-status-red-bg bg-[#fff7f6] px-4 py-3" role="alert">
          <div className="flex items-start gap-3">
            <Icon name="error" size="md" className="text-status-red-text mt-0.5" />
            <div>
              <p className="text-sm font-medium text-status-red-text">{shownError.title}</p>
              {shownError.detail && (
                <p className="mt-1 text-xs text-status-red-text/80">{shownError.detail}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <PageHeader
        icon="assignment"
        tags={["SA Italia 250B", "D.Lgs. 39/2010"]}
        title={
          <>
            {clientName}
            <span className="font-semibold"> — Verifica ex art. 2409-ter c.c.</span>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${working ? "bg-amber-600" : done >= 9 ? "bg-emerald-600" : "bg-amber-600"}`}
              />
              {working ? "Elaborazione" : `${done}/9 sezioni`}
            </span>
            <span className="text-ink-tertiary">·</span>
            <span>
              Periodo <strong className="font-medium text-ink-body">{period || "—"}</strong>
            </span>
            <span className="text-ink-tertiary">·</span>
            <span>
              Organo <strong className="font-medium text-ink-body">{organo}</strong>
            </span>
            <span className="text-ink-tertiary">·</span>
            <span className="font-mono" title={praticaId}>
              {praticaId}
            </span>
          </>
        }
        toolbar={
          <>
            <GhostButton icon="tune" onClick={() => setShowSetup((v) => !v)}>
              {showSetup ? "Chiudi setup" : "Configura"}
            </GhostButton>
            <ToolButton
              icon="folder_open"
              onClick={() => {
                setShowDocs((v) => !v);
              }}
            >
              Documenti ({docsCount})
            </ToolButton>
            <ToolButton icon="file_download" href="/api/export/xlsx">
              Esporta Excel
            </ToolButton>
          </>
        }
        primaryAction={
          <PrimaryButton
            icon="play_arrow"
            onClick={() => void run()}
            disabled={busy || state?.running || !scanned}
            title={!scanned ? "Scansiona prima la cartella documenti" : undefined}
          >
            {state?.running || busy ? "In corso…" : "Avvia compilazione"}
          </PrimaryButton>
        }
      />

      {showSetup && (
        <Card padding="base">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">Configurazione pratica</h2>
              <p className="text-xs text-ink-secondary mt-0.5">{nextStep}</p>
            </div>
            {form.client.trim() && (
              <button
                type="button"
                onClick={() => setShowSetup(false)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-surface-hover text-ink-secondary"
                aria-label="Chiudi configurazione"
              >
                <Icon name="close" size="sm" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs text-ink-secondary mb-1">Cliente</span>
              <input
                value={form.client}
                onChange={(e) => patchForm({ client: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-sm text-ink-primary outline-none focus:border-ink-secondary"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-ink-secondary mb-1">Periodo</span>
              <input
                value={form.period}
                onChange={(e) => patchForm({ period: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-sm text-ink-primary outline-none focus:border-ink-secondary"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-ink-secondary mb-1">Cartella documenti</span>
              <input
                value={linkDir}
                onChange={(e) => {
                  setLinkDir(e.target.value);
                  if (e.target.value) setFolderFiles([]);
                }}
                placeholder="/Volumes/…/documenti"
                className="w-full h-10 px-3 rounded-md border border-border-subtle bg-surface text-sm text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={scan}
              disabled={busy || !hasFolder || !form.client.trim()}
              data-onboarding="scan"
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border border-border-subtle bg-surface-card text-sm font-medium text-ink-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="document_scanner" size="sm" />
              Scansiona
            </button>
          </div>
        </Card>
      )}

      {working && (
        <Card padding="sm">
          <div className="flex items-center justify-between gap-3 mb-2 px-1 pt-1">
            <div>
              <div className="text-sm font-medium text-ink-primary">{state?.job_label || "Elaborazione…"}</div>
              <div className="text-xs text-ink-secondary">
                {state?.job_step && state?.job_total ? `Passo ${state.job_step} di ${state.job_total}` : ""}
              </div>
            </div>
            <div className="text-sm font-mono tabular-nums text-ink-secondary">{Math.round(state?.progress || 0)}%</div>
          </div>
          <div className="h-1.5 rounded-full bg-surface-recessed overflow-hidden mx-1 mb-1">
            <div
              className="h-full bg-ink-primary rounded-full work-bar-fill"
              style={{ width: `${Math.max(4, state?.progress || 0)}%` }}
            />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-stretch gap-px rounded-md border border-border-subtle bg-border-subtle overflow-hidden">
        <KpiChip
          icon="task_alt"
          label="Carte"
          value={`${done}/9`}
          hint={`${pct}%`}
          tone="ok"
        />
        <KpiChip
          icon="warning"
          label="Anomalie"
          value={String(alerts)}
          hint={alerts ? "Da ispezionare" : "Nessuna"}
          tone={alerts ? "alert" : "ok"}
        />
        <KpiChip
          icon="pending"
          label="Sospesi"
          value={String(pending || k.missing)}
          hint={pending || k.missing ? "In attesa" : "Niente in coda"}
          tone="pending"
        />
        <KpiChip
          icon="sync"
          label="Sincronia"
          value={sync.date}
          hint={sync.time ? `${sync.time}` : "Mai"}
        />
      </div>

      <section
        className="flex flex-col flex-1 min-h-0 bg-surface-card rounded-lg border border-border-subtle overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 bg-surface-sidebar shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="table_chart" size="sm" className="text-ink-secondary" />
            <h2 className="text-sm font-semibold text-ink-primary">Carte di lavoro A–I</h2>
            <span className="text-xs text-ink-secondary hidden lg:inline">
              Click sulla riga per aprire la sezione
            </span>
          </div>
          <div className="flex items-center bg-surface-hover p-0.5 rounded border border-border-subtle">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              Tutte ({rows.length})
            </FilterTab>
            <FilterTab active={filter === "critical"} onClick={() => setFilter("critical")}>
              Critiche ({alerts + pending})
            </FilterTab>
            <FilterTab active={filter === "ok"} onClick={() => setFilter("ok")}>
              Conformi ({ok})
            </FilterTab>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left text-sm leading-5 notion-table">
            <thead>
              <tr className="text-ink-secondary font-medium">
                <th className="py-2 px-3 w-12 text-center font-mono uppercase tracking-wider text-xs">Sez.</th>
                <th className="py-2 px-3 min-w-[240px] font-medium">Ambito</th>
                <th className="py-2 px-3 min-w-[220px] font-medium">Esito e note</th>
                <th className="py-2 px-3 font-medium">Fonte documentale</th>
                <th className="py-2 px-3 w-32 text-right font-medium">Scostamento</th>
                <th className="py-2 px-3 w-8" aria-hidden />
              </tr>
            </thead>
            <tbody className="text-ink-primary">
              {visible.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Apri sezione ${row.id}: ${row.title}`}
                  onClick={() => openRow(row.id)}
                  onKeyDown={(e) => onRowKey(e, row.id)}
                  className={
                    row.kind === "alert"
                      ? "bg-[#fff9f9]"
                      : row.kind === "pending"
                        ? "bg-[#fffdf7]"
                        : undefined
                  }
                >
                  <td
                    className={`py-2.5 px-3 text-center font-mono tabular-nums ${
                      row.kind === "alert"
                        ? "font-semibold text-status-red-text"
                        : row.kind === "pending"
                          ? "font-medium text-status-yellow-text"
                          : "font-medium text-ink-secondary"
                    }`}
                  >
                    {row.id}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-ink-primary flex items-center gap-1.5">
                      <Icon
                        name={SECTION_ICONS[row.id] || "description"}
                        size="sm"
                        className={
                          row.kind === "alert"
                            ? "text-status-red-text"
                            : row.kind === "pending"
                              ? "text-status-yellow-text"
                              : "text-ink-secondary"
                        }
                      />
                      <span>{row.title}</span>
                    </div>
                    <div className="text-xs leading-4 text-ink-secondary pl-6">{row.blurb}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <OutcomeBadge kind={row.kind} status={row.status} missing={row.missing} />
                    {(row.missing[0] || row.note) && (
                      <div
                        className={`text-xs mt-0.5 ${
                          row.kind === "alert" ? "text-status-red-text" : "text-ink-secondary"
                        }`}
                      >
                        {row.missing[0] || row.note}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-ink-body">{row.sourceName}</div>
                    <div className="text-xs text-ink-secondary font-mono">{row.sourceMeta}</div>
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                      row.kind === "alert" ? "font-semibold text-status-red-text" : "font-medium text-ink-body"
                    }`}
                  >
                    {row.kind === "alert" ? "Da ispezionare" : "—"}
                  </td>
                  <td className="py-2.5 px-2 text-ink-tertiary">
                    <Icon name="chevron_right" size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 bg-surface-sidebar/60 border-t border-border-subtle flex items-center justify-between text-xs text-ink-secondary shrink-0">
          <span>
            {visible.length} visibili · {rows.length} sezioni
          </span>
          <span className="font-mono tabular-nums">{pct}%</span>
        </div>
      </section>

      {showDocs && (
        <section
          id="docs-drawer"
          className="flex flex-col bg-surface-card rounded-lg border border-border-subtle p-3 shrink-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Icon name="folder_shared" size="sm" className="text-ink-secondary" />
              <h3 className="text-sm font-semibold text-ink-primary">Documenti ({docsCount})</h3>
            </div>
            <button
              type="button"
              onClick={onOpenDocs}
              className="h-9 px-3 text-sm text-ink-secondary hover:text-ink-primary rounded-md hover:bg-surface-hover"
            >
              Elenco completo
            </button>
          </div>
          {(state?.documents || []).length === 0 ? (
            <p className="text-sm text-ink-secondary py-2">Nessun documento. Configura e scansiona la cartella.</p>
          ) : (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full border-collapse text-left text-sm notion-table">
                <thead>
                  <tr className="text-ink-secondary font-medium">
                    <th className="py-2 px-3 font-medium">Nome file</th>
                    <th className="py-2 px-3 font-medium">Tipologia</th>
                    <th className="py-2 px-3 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {(state?.documents || []).slice(0, 12).map((doc) => {
                    const fi = fileIcon(doc.name);
                    return (
                      <tr key={doc.id}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2 font-medium text-ink-primary">
                            <Icon name={fi.icon} size="sm" className={fi.className} />
                            <span>{doc.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-surface-hover text-ink-secondary border border-border-subtle">
                            {doc.item_label || doc.item_id || doc.ext || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 text-xs text-status-green-text">
                            <Icon name="check" size="sm" />
                            {doc.skip ? "Saltato" : "Classificato"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
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
        h-8 px-2.5 rounded text-xs transition-colors
        ${active ? "bg-surface-card text-ink-primary font-medium" : "text-ink-secondary hover:text-ink-primary"}
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
    return (
      <StatusBadge variant="error">
        Anomalia{missing[0] ? `: ${missing[0]}` : ""}
      </StatusBadge>
    );
  }
  if (kind === "pending") {
    return <StatusBadge variant="warning">In attesa</StatusBadge>;
  }
  if (kind === "ok") {
    return <StatusBadge variant="success">Conforme</StatusBadge>;
  }
  return <StatusBadge variant="neutral">{status === "—" ? "Da avviare" : status}</StatusBadge>;
}

function KpiChip({
  icon,
  label,
  value,
  hint,
  tone = "ok",
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "alert" | "pending";
}) {
  const color =
    tone === "alert"
      ? "text-status-red-text"
      : tone === "pending"
        ? "text-status-yellow-text"
        : "text-ink-primary";
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-[140px] px-3 py-2 bg-surface-card">
      <Icon name={icon} size="sm" className={color} />
      <div className="min-w-0">
        <div className="text-xs text-ink-secondary leading-4">{label}</div>
        <div className={`text-sm font-semibold font-mono tabular-nums leading-5 ${color}`}>
          {value}
          <span className="ml-1.5 font-sans font-normal text-xs text-ink-secondary">{hint}</span>
        </div>
      </div>
    </div>
  );
}
