/**
 * App.tsx — Shell principale Quadra con sidebar Atelier Document System
 *
 * Mantiene tutta la logica applicativa esistente (fetch, stato, pratiche)
 * ma usa la nuova struttura visiva con sidebar fissa.
 */

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import {
  ApiError,
  api,
  asUserError,
  parseErrorBody,
  type AppState,
  type Catalog,
  type ProvenanceRow,
  type UserFacingError,
} from "./api";
import {
  Sidebar,
  PlaceholderSection,
  Icon,
  StatusBadge,
  Card,
  CardHeader,
  mapStatusToVariant,
  // Nuovi componenti
  ToastProvider,
  useToast,
  CommandPaletteProvider,
  useCommandPalette,
  OnboardingProvider,
  OnboardingTooltips,
  ShortcutsModal,
  ThemeToggle,
  ConnectionStatus,
  ConnectionBanner,
  EmptyDocuments,
  Skeleton,
  SkeletonCard,
  type Command,
} from "./components";
import type { SectionId } from "./components/Sidebar";
import { DomainDashboard } from "./domain/DomainDashboard";
import { JetPage } from "./pages";
import { ALL_SECTIONS, sectionHelp } from "./sectionHelp";
import { useKeyboardShortcuts } from "./hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

function buildNav(catalog: Catalog | null) {
  return [
    { id: "overview", label: "Panoramica" },
    { id: "docs", label: "Documenti" },
    { id: "richiesta", label: "Richiesta doc" },
    ...ALL_SECTIONS.map((id) => ({ id, label: `${id}  ${sectionHelp(id, catalog).title}` })),
    { id: "mancanti", label: "Mancanti" },
    { id: "prov", label: "Provenienza" },
  ];
}

const QUARTER_OPTS = [
  { id: "q1", label: "Gennaio - Marzo" },
  { id: "q2", label: "Aprile - Giugno" },
  { id: "q3", label: "Luglio - Settembre" },
  { id: "q4", label: "Ottobre - Dicembre" },
];

function composePeriod(q: string, year: string) {
  const lab = QUARTER_OPTS.find((x) => x.id === q)?.label || QUARTER_OPTS[1].label;
  return `${lab} ${year || new Date().getFullYear()}`;
}

function splitPeriod(period: string): { q: string; year: string } {
  const year = period.match(/20\d{2}/)?.[0] || String(new Date().getFullYear());
  const p = period.toLowerCase();
  if (/\biii\b|3°|luglio/.test(p)) return { q: "q3", year };
  if (/\biv\b|4°|ottobre/.test(p)) return { q: "q4", year };
  if (/\bii\b|2°|aprile|giugno/.test(p)) return { q: "q2", year };
  if (/gennaio|\bi\b\s*trim|1°/.test(p)) return { q: "q1", year };
  return { q: "q2", year };
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb mapping
// ─────────────────────────────────────────────────────────────────────────────

function getBreadcrumb(section: SectionId, clientName?: string): string[] {
  const base = clientName ? ["Clienti", clientName] : ["Quadra"];

  switch (section) {
    case "controllo-contabile":
      return [...base, "Controllo Contabile"];
    case "jet":
      return [...base, "JET (ISA 240)"];
    case "sezione-3":
      return [...base, "Sezione 3"];
    case "sezione-4":
      return [...base, "Sezione 4"];
    case "sezione-5":
      return [...base, "Sezione 5"];
    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App Component (wrapped with providers)
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <CommandPaletteProvider>
        <OnboardingProvider autoStart={true}>
          <AppContent />
          <OnboardingTooltips />
          <ConnectionBanner />
        </OnboardingProvider>
      </CommandPaletteProvider>
    </ToastProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App Content (main application logic)
// ─────────────────────────────────────────────────────────────────────────────

function AppContent() {
  // ─── Hooks from providers ───
  const { toast } = useToast();
  const { registerCommands, open: openCommandPalette } = useCommandPalette();

  // ─── Shortcuts modal ───
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ─── Sidebar state ───
  const [activeSection, setActiveSection] = useState<SectionId>("controllo-contabile");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("quadra-sidebar-collapsed") === "true";
  });

  // Sync sidebar collapsed state
  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStorage.getItem("quadra-sidebar-collapsed") === "true";
      if (current !== sidebarCollapsed) setSidebarCollapsed(current);
    }, 200);
    return () => clearInterval(interval);
  }, [sidebarCollapsed]);

  // ─── App state (from existing App.tsx) ───
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [view, setView] = useState("overview");
  const [form, setForm] = useState({
    client: "",
    period: "Aprile - Giugno 2026",
    done_by: "",
    reviewed_by: "",
    request_date: "",
    activity_date: "",
    skip_sections: [] as string[],
  });
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [linkDir, setLinkDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<UserFacingError | null>(null);
  const [picked, setPicked] = useState<ProvenanceRow | null>(null);

  // ─── Error handling ───
  function fail(e: unknown) {
    setErr(asUserError(e));
    setState((prev) =>
      prev
        ? {
            ...prev,
            running: false,
            progress: 0,
            job_step: 0,
            job_total: 0,
            job_label: "",
          }
        : prev
    );
    setView("overview");
  }

  function readyError(action: "scan" | "run"): UserFacingError | null {
    if (!form.client.trim()) {
      return {
        title: "Manca il nome del cliente",
        detail: "Senza il cliente Quadra non sa come intestare il foglio INDICE. Scrivilo nel campo Cliente.",
        missing: ["Campo Cliente"],
      };
    }
    const hasFolder = folderFiles.length > 0 || Boolean(linkDir.trim()) || Boolean(state?.pratica?.documents_dir);
    if (action === "scan" && !hasFolder) {
      return {
        title: "Nessuna cartella documenti",
        detail: "Non hai ancora scelto i file. Usa «Scegli cartella» oppure collega un percorso.",
        missing: ["Cartella documenti"],
      };
    }
    if (action === "run" && !(state?.documents || []).length) {
      return {
        title: "Non posso compilare: manca la scansione",
        detail: "Prima scegli la cartella e premi Scansiona.",
        missing: ["Scansiona"],
      };
    }
    return null;
  }

  // ─── Data fetching ───
  async function refresh() {
    const s = await api.state();
    setState(s);
    if (s.pratica) {
      setForm({
        client: s.pratica.client,
        period: s.pratica.period,
        done_by: s.pratica.done_by,
        reviewed_by: s.pratica.reviewed_by,
        request_date: s.pratica.request_date || "",
        activity_date: s.pratica.activity_date || "",
        skip_sections: s.pratica.skip_sections || [],
      });
    }
  }

  useEffect(() => {
    api.catalog().then(setCatalog).catch(fail);
    refresh().catch(fail);
  }, []);

  async function savePratica() {
    setErr(null);
    const s = await api.pratica({
      ...form,
      request_date: form.request_date || null,
      activity_date: form.activity_date || null,
      pratica_id: state?.pratica?.pratica_id || "",
      skip_items: state?.pratica?.skip_items || [],
      na_items: state?.pratica?.na_items || [],
      skip_sections: form.skip_sections || [],
    });
    setState(s);
    return s;
  }

  async function ingestIfNeeded() {
    if (linkDir.trim()) {
      return api.ingestLink(linkDir.trim());
    }
    if (folderFiles.length) {
      return api.ingest(folderFiles);
    }
    return null;
  }

  async function scan() {
    const local = readyError("scan");
    if (local) {
      setErr(local);
      setView("overview");
      return;
    }
    setErr(null);
    setBusy(true);
    setView("overview");
    setState((prev) =>
      prev
        ? {
            ...prev,
            running: true,
            current_section: "Documenti",
            job_step: 1,
            job_total: 2,
            job_label: "Lettura nomi e cartelle",
            progress: 8,
          }
        : prev
    );
    try {
      await savePratica();
      const ingested = await ingestIfNeeded();
      if (ingested) {
        setState({
          ...ingested,
          running: true,
          job_label: "Lettura nomi e cartelle",
          progress: 18,
        });
      }
      const scanned = await api.scan();
      setState(scanned);
      setView("docs");
      toast.success(
        "Scansione completata",
        `${scanned.documents?.length || 0} documenti trovati`
      );
    } catch (e) {
      fail(e);
      toast.error("Scansione fallita", "Controlla i dettagli dell'errore");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    const local = readyError("run");
    if (local) {
      setErr(local);
      setView("overview");
      return;
    }
    setErr(null);
    setBusy(true);
    setView("overview");
    setState((prev) =>
      prev
        ? {
            ...prev,
            running: true,
            current_section: "INDICE",
            job_step: 1,
            job_total: 7,
            job_label: "Avvio compilazione",
            progress: 4,
          }
        : prev
    );
    try {
      await savePratica();
      const ingested = await ingestIfNeeded();
      if (ingested) {
        setState({ ...ingested, running: true, progress: 6, job_label: "Avvio compilazione" });
      }
      const res = await fetch("/api/run", { method: "POST" });
      if (!res.ok || !res.body) {
        throw new ApiError(parseErrorBody(await res.text(), res.statusText || "Compilazione non partita"));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.state) setState(ev.state);
          if (ev.kind === "error") {
            setErr({
              title: ev.message || "Compilazione interrotta",
              detail: ev.detail || "",
              missing: Array.isArray(ev.missing) ? ev.missing : [],
            });
          }
        }
      }
      await refresh();
      toast.success("Compilazione completata", "La verifica è stata compilata con successo");
    } catch (e) {
      fail(e);
      toast.error("Compilazione fallita", "Controlla i dettagli dell'errore");
    } finally {
      setBusy(false);
    }
  }

  // ─── Derived state ───
  const filteredDocs = useMemo(() => {
    const docs = state?.documents || [];
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.item_id || "").toLowerCase().includes(s) ||
        (d.item_label || "").toLowerCase().includes(s)
    );
  }, [state, q]);

  const k = state?.kpis || { files: 0, classified: 0, missing: 0, sections_done: 0 };
  const working = Boolean(busy || state?.running);
  const shownError =
    err ||
    (state?.error
      ? {
          title: state.error,
          detail: state.error_detail || "",
          missing: state.error_missing || [],
        }
      : null);
  const nav = buildNav(catalog);
  const hasFolder = folderFiles.length > 0 || Boolean(linkDir.trim()) || Boolean(state?.pratica?.documents_dir);
  const scanned = (state?.documents || []).length > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────────────

  const toggleSidebar = useCallback(() => {
    const newValue = !sidebarCollapsed;
    localStorage.setItem("quadra-sidebar-collapsed", String(newValue));
    setSidebarCollapsed(newValue);
  }, [sidebarCollapsed]);

  useKeyboardShortcuts({
    "cmd+k": openCommandPalette,
    "cmd+/": () => setShowShortcuts(true),
    "1": () => setActiveSection("controllo-contabile"),
    "2": () => setActiveSection("jet"),
    "3": () => setActiveSection("sezione-3"),
    "4": () => setActiveSection("sezione-4"),
    "5": () => setActiveSection("sezione-5"),
    "[": toggleSidebar,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Command Palette Commands
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const commands: Command[] = [
      // Navigation
      {
        id: "nav-controllo",
        title: "Controllo Contabile",
        subtitle: "Vai alla sezione principale",
        icon: "fact_check",
        shortcut: "1",
        section: "Navigazione",
        onSelect: () => setActiveSection("controllo-contabile"),
      },
      {
        id: "nav-jet",
        title: "JET (ISA 240)",
        subtitle: "Analisi Journal Entry Testing",
        icon: "analytics",
        shortcut: "2",
        section: "Navigazione",
        onSelect: () => setActiveSection("jet"),
      },
      {
        id: "nav-sezione3",
        title: "Sezione 3",
        icon: "article",
        shortcut: "3",
        section: "Navigazione",
        onSelect: () => setActiveSection("sezione-3"),
      },
      {
        id: "nav-sezione4",
        title: "Sezione 4",
        icon: "article",
        shortcut: "4",
        section: "Navigazione",
        onSelect: () => setActiveSection("sezione-4"),
      },
      {
        id: "nav-sezione5",
        title: "Sezione 5",
        icon: "article",
        shortcut: "5",
        section: "Navigazione",
        onSelect: () => setActiveSection("sezione-5"),
      },
      // Actions
      {
        id: "action-scan",
        title: "Avvia scansione",
        subtitle: "Analizza i documenti nella cartella",
        icon: "document_scanner",
        shortcut: "⌘↵",
        section: "Azioni",
        onSelect: () => {
          if (!busy && hasFolder) scan();
        },
      },
      {
        id: "action-compile",
        title: "Compila verifica",
        subtitle: "Esegui la compilazione automatica",
        icon: "play_arrow",
        section: "Azioni",
        onSelect: () => {
          if (!busy && scanned) run();
        },
      },
      {
        id: "action-shortcuts",
        title: "Mostra scorciatoie",
        subtitle: "Visualizza le scorciatoie da tastiera",
        icon: "keyboard",
        shortcut: "⌘/",
        section: "Aiuto",
        onSelect: () => setShowShortcuts(true),
      },
      {
        id: "action-toggle-sidebar",
        title: "Comprimi/espandi sidebar",
        icon: "view_sidebar",
        shortcut: "[",
        section: "Interfaccia",
        onSelect: toggleSidebar,
      },
    ];

    // Add client-specific commands if we have a client
    if (state?.pratica?.client) {
      commands.push({
        id: "client-current",
        title: state.pratica.client,
        subtitle: "Cliente corrente",
        icon: "business",
        section: "Cliente",
        onSelect: () => setView("overview"),
      });
    }

    return registerCommands(commands);
  }, [registerCommands, busy, hasFolder, scanned, state?.pratica?.client, toggleSidebar]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const breadcrumb = getBreadcrumb(activeSection, state?.pratica?.client);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-surface">
      {/* ─── Sidebar ─── */}
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* ─── Main content area ─── */}
      <main
        className={`
          flex-1 flex flex-col min-h-0 min-w-0
          transition-[margin] duration-200 ease-out
          ${sidebarCollapsed ? "ml-sidebar-collapsed" : "ml-sidebar-expanded"}
        `}
      >
        {/* ─── Top bar with breadcrumb ─── */}
        <header className="h-11 flex items-center justify-between px-lg border-b border-border-muted bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <nav className="flex items-center gap-xs text-body-sm">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-xs">
                {index > 0 && <span className="text-ink-tertiary">/</span>}
                <span className={index === breadcrumb.length - 1 ? "text-ink-primary" : "text-ink-secondary"}>
                  {item}
                </span>
              </span>
            ))}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              type="button"
              onClick={openCommandPalette}
              data-onboarding="search"
              className="flex items-center gap-2 h-8 px-3 rounded-md border border-border-subtle bg-surface-card hover:bg-surface-hover transition-colors text-body-sm text-ink-tertiary"
            >
              <Icon name="search" size="sm" />
              <span className="hidden sm:inline">Cerca...</span>
              <kbd className="hidden sm:inline-flex ml-2 px-1.5 py-0.5 rounded bg-surface-recessed text-caption">⌘K</kbd>
            </button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Connection status */}
            <ConnectionStatus compact className="ml-1" />
          </div>
        </header>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto dot-pattern">
          <div className="max-w-content-wide mx-auto px-2xl py-lg">
            {activeSection === "controllo-contabile" && (
              <ControlloContabileSection
                state={state}
                setState={setState}
                catalog={catalog}
                form={form}
                setForm={setForm}
                folderFiles={folderFiles}
                setFolderFiles={setFolderFiles}
                linkDir={linkDir}
                setLinkDir={setLinkDir}
                busy={busy}
                working={working}
                shownError={shownError}
                scan={scan}
                run={run}
                hasFolder={hasFolder}
                scanned={scanned}
                view={view}
                setView={setView}
                nav={nav}
                filteredDocs={filteredDocs}
                q={q}
                setQ={setQ}
                k={k}
                picked={picked}
                setPicked={setPicked}
              />
            )}

            {activeSection === "jet" && <JetPage />}

            {activeSection === "sezione-3" && (
              <PlaceholderSection
                title="Sezione 3"
                icon="inventory_2"
                description="Questa sezione sarà dedicata a procedure di audit aggiuntive. Il contenuto sarà definito nelle prossime versioni."
              />
            )}

            {activeSection === "sezione-4" && (
              <PlaceholderSection
                title="Sezione 4"
                icon="folder_supervised"
                description="Area riservata a controlli documentali avanzati. Funzionalità in fase di definizione."
              />
            )}

            {activeSection === "sezione-5" && (
              <PlaceholderSection
                title="Sezione 5"
                icon="history_edu"
                description="Storico e archivio delle pratiche completate. Sarà disponibile in una versione futura."
              />
            )}
          </div>
        </div>
      </main>

      {/* ─── Provenance detail panel ─── */}
      {picked && (
        <ProvenancePanel picked={picked} onClose={() => setPicked(null)} />
      )}

      {/* ─── Shortcuts modal ─── */}
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllo Contabile Section (migrated from original App.tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface PraticaForm {
  client: string;
  period: string;
  done_by: string;
  reviewed_by: string;
  request_date: string;
  activity_date: string;
  skip_sections: string[];
}

interface ControlloContabileSectionProps {
  state: AppState | null;
  setState: React.Dispatch<React.SetStateAction<AppState | null>>;
  catalog: Catalog | null;
  form: PraticaForm;
  setForm: React.Dispatch<React.SetStateAction<PraticaForm>>;
  folderFiles: File[];
  setFolderFiles: React.Dispatch<React.SetStateAction<File[]>>;
  linkDir: string;
  setLinkDir: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean;
  working: boolean;
  shownError: UserFacingError | null;
  scan: () => Promise<void>;
  run: () => Promise<void>;
  hasFolder: boolean;
  scanned: boolean;
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  nav: { id: string; label: string }[];
  filteredDocs: AppState["documents"];
  q: string;
  setQ: React.Dispatch<React.SetStateAction<string>>;
  k: { files: number; classified: number; missing: number; sections_done: number };
  picked: ProvenanceRow | null;
  setPicked: React.Dispatch<React.SetStateAction<ProvenanceRow | null>>;
}

function ControlloContabileSection(props: ControlloContabileSectionProps) {
  const {
    state,
    setState,
    catalog,
    form,
    setForm,
    folderFiles,
    setFolderFiles,
    linkDir,
    setLinkDir,
    busy,
    working,
    shownError,
    scan,
    run,
    hasFolder,
    scanned,
    view,
    setView,
    nav,
    filteredDocs,
    q,
    setQ,
    k,
    setPicked,
  } = props;

  const activeSection = ALL_SECTIONS.includes(view) ? sectionHelp(view, catalog) : null;
  const nextStep = !form.client.trim()
    ? "Inserisci il nome del cliente per iniziare."
    : !hasFolder
      ? "Seleziona la cartella dei documenti."
      : !scanned
        ? "Premi Scansiona per leggere i file."
        : "Controlla i documenti, poi premi Avvia per compilare.";

  return (
    <div className="space-y-lg">
      {/* ─── Header ─── */}
      <header className="flex items-start justify-between gap-lg">
        <div>
          <h1 className="text-headline-lg text-ink-primary">Controllo Contabile</h1>
          <p className="mt-xs text-body-md text-ink-secondary">
            SA Italia 250B · Verifica art. 2409-ter c.c.
          </p>
        </div>
        <a
          href="/api/export/xlsx"
          className="inline-flex items-center gap-sm px-base py-sm rounded bg-ink-primary text-white text-label-md hover:bg-ink-primary/90 transition-colors-fast"
        >
          <Icon name="download" size="sm" />
          Esporta Excel
        </a>
      </header>

      {/* ─── Error banner ─── */}
      {shownError && <ErrorBanner err={shownError} />}

      {/* ─── Setup form + KPIs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-base">
        {/* Form card */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader>Configurazione pratica</CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Cliente" value={form.client} onChange={(v) => setForm({ ...form, client: v })} />
            <PeriodSelect period={form.period} onChange={(v) => setForm({ ...form, period: v })} />
            <Field
              label="Cartella documenti"
              value={linkDir}
              onChange={(v) => {
                setLinkDir(v);
                if (v) setFolderFiles([]);
              }}
              placeholder="/Volumes/…/documenti"
              className="sm:col-span-2"
            />
          </div>

          <div className="mt-md pt-md border-t border-border-muted">
            <p className="text-body-sm text-ink-secondary mb-md">{nextStep}</p>
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={scan}
                disabled={busy || !hasFolder || !form.client.trim()}
                className="flex-1 inline-flex items-center justify-center gap-sm px-base py-sm rounded border border-border-subtle bg-surface-card text-label-md text-ink-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors-fast"
              >
                <Icon name="document_scanner" size="sm" />
                Scansiona
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy || state?.running || !scanned}
                className="flex-1 inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors-fast"
              >
                <Icon name="play_arrow" size="sm" />
                {state?.running || busy ? "In corso…" : "Avvia"}
              </button>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="space-y-sm">
          <KpiCard title="File in cartella" value={k.files} />
          <KpiCard title="Classificati" value={k.classified} />
          <KpiCard title="Mancanti" value={k.missing} variant={k.missing > 0 ? "warning" : "default"} />
          <KpiCard title="Sezioni chiuse" value={`${k.sections_done}/9`} />
        </div>
      </div>

      {/* ─── Progress indicator ─── */}
      {working && (
        <Card padding="base">
          <div className="flex items-center justify-between gap-md mb-sm">
            <div>
              <div className="text-label-md text-ink-primary">{state?.job_label || "Elaborazione..."}</div>
              <div className="text-body-sm text-ink-secondary">
                {state?.job_step && state?.job_total
                  ? `Passo ${state.job_step} di ${state.job_total}`
                  : ""}
              </div>
            </div>
            <div className="text-label-md text-ink-secondary font-mono">
              {Math.round(state?.progress || 0)}%
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-surface-recessed overflow-hidden">
            <div
              className="h-full bg-ink-primary rounded-full work-bar-fill"
              style={{ width: `${Math.max(4, state?.progress || 0)}%` }}
            />
          </div>
        </Card>
      )}

      {/* ─── Sub-navigation tabs ─── */}
      <div className="flex items-center gap-xs border-b border-border-muted overflow-x-auto pb-px">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setView(n.id)}
            className={`
              px-md py-sm text-label-md whitespace-nowrap rounded-t transition-colors-fast
              ${
                view === n.id
                  ? "text-ink-primary bg-surface-card border border-border-subtle border-b-surface-card -mb-px"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-surface-hover"
              }
            `}
          >
            {n.label}
            {n.id.length === 1 && state?.sections.find((s) => s.id === n.id)?.status && (
              <span className="ml-sm">
                <StatusBadge
                  variant={mapStatusToVariant(state.sections.find((s) => s.id === n.id)!.status)}
                  showDot={false}
                >
                  {state.sections.find((s) => s.id === n.id)!.status}
                </StatusBadge>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Content based on view ─── */}
      <div className="bg-surface-card rounded-lg border border-border-subtle">
        {view === "overview" && (
          <OverviewContent state={state} catalog={catalog} working={working} setView={setView} />
        )}

        {view === "docs" && (
          <DocsContent
            filteredDocs={filteredDocs}
            catalog={catalog}
            state={state}
            setState={setState}
            q={q}
            setQ={setQ}
          />
        )}

        {view === "richiesta" && (
          <RichiestaContent catalog={catalog} state={state} setState={setState} />
        )}

        {activeSection && (
          <SectionContent
            view={view}
            activeSection={activeSection}
            state={state}
            setPicked={setPicked}
          />
        )}

        {view === "mancanti" && <MancantiContent state={state} />}

        {view === "prov" && <ProvenanceContent state={state} setPicked={setPicked} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({ err }: { err: UserFacingError }) {
  return (
    <div className="rounded-lg border border-status-red-bg bg-status-red-bg/30 px-base py-md">
      <div className="flex items-start gap-md">
        <Icon name="error" size="md" className="text-status-red-text flex-shrink-0 mt-xxs" />
        <div>
          <p className="text-label-md text-status-red-text font-medium">{err.title}</p>
          {err.detail && <p className="mt-xs text-body-sm text-status-red-text/80">{err.detail}</p>}
          {err.missing.length > 0 && (
            <ul className="mt-sm space-y-xs">
              {err.missing.map((item) => (
                <li key={item} className="text-body-sm text-status-red-text/80">• {item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  variant = "default",
}: {
  title: string;
  value: number | string;
  variant?: "default" | "warning";
}) {
  return (
    <Card padding="base">
      <div className="text-body-sm text-ink-secondary">{title}</div>
      <div
        className={`text-headline-md font-mono mt-xxs ${
          variant === "warning" && typeof value === "number" && value > 0
            ? "text-status-yellow-text"
            : "text-ink-primary"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-label-sm text-ink-secondary mb-xs">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary transition-colors"
      />
    </label>
  );
}

function PeriodSelect({ period, onChange }: { period: string; onChange: (v: string) => void }) {
  const { q, year } = splitPeriod(period || "Aprile - Giugno 2026");
  return (
    <div className="grid grid-cols-3 gap-sm">
      <label className="col-span-2 block">
        <span className="block text-label-sm text-ink-secondary mb-xs">Trimestre</span>
        <select
          value={q}
          onChange={(e) => onChange(composePeriod(e.target.value, year))}
          className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
        >
          {QUARTER_OPTS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-label-sm text-ink-secondary mb-xs">Anno</span>
        <input
          value={year}
          onChange={(e) => onChange(composePeriod(q, e.target.value.replace(/\D/g, "").slice(0, 4)))}
          inputMode="numeric"
          className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
        />
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Views
// ─────────────────────────────────────────────────────────────────────────────

function OverviewContent({
  state,
  catalog,
  working,
  setView,
}: {
  state: AppState | null;
  catalog: Catalog | null;
  working: boolean;
  setView: (v: string) => void;
}) {
  return (
    <div className="p-lg">
      <h3 className="text-headline-sm text-ink-primary mb-md">Carte di lavoro A–I</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm">
        {(state?.sections || []).map((s) => {
          const meta = sectionHelp(s.id, catalog);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setView(s.id)}
              className="flex items-start justify-between gap-md p-md rounded-lg border border-border-muted hover:bg-surface-hover transition-colors-fast text-left"
            >
              <div className="min-w-0">
                <div className="text-label-md text-ink-primary font-medium">
                  {s.id} — {meta.title}
                </div>
                <div className="text-body-sm text-ink-secondary mt-xxs line-clamp-2">
                  {meta.blurb}
                </div>
              </div>
              <StatusBadge variant={mapStatusToVariant(s.status)}>{s.status}</StatusBadge>
            </button>
          );
        })}
      </div>

      {(state?.missing || []).length > 0 && !working && (
        <div className="mt-lg p-md rounded-lg bg-status-yellow-bg/30 border border-status-yellow-bg">
          <div className="flex items-center gap-sm mb-sm">
            <Icon name="warning" size="sm" className="text-status-yellow-text" />
            <span className="text-label-md text-status-yellow-text font-medium">Documenti mancanti</span>
          </div>
          <ul className="space-y-xs">
            {(state?.missing || []).slice(0, 4).map((m) => (
              <li key={m.id} className="text-body-sm text-status-yellow-text">
                <span className="font-medium">{m.id}</span> — {m.need || m.label}
              </li>
            ))}
          </ul>
          {(state?.missing || []).length > 4 && (
            <button
              type="button"
              onClick={() => setView("mancanti")}
              className="mt-sm text-body-sm text-status-yellow-text underline"
            >
              Vedi tutti i {(state?.missing || []).length} mancanti
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DocsContent({
  filteredDocs,
  catalog,
  state,
  setState,
  q,
  setQ,
}: {
  filteredDocs: AppState["documents"];
  catalog: Catalog | null;
  state: AppState | null;
  setState: React.Dispatch<React.SetStateAction<AppState | null>>;
  q: string;
  setQ: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <div>
      <div className="p-md border-b border-border-muted">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca documenti…"
          className="w-full max-w-md h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "35%" }}>File</th>
              <th style={{ width: "30%" }}>Voce</th>
              <th style={{ width: "10%" }}>Conf.</th>
              <th style={{ width: "12%" }}>Stato</th>
              <th style={{ width: "13%" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-ink-tertiary py-lg">
                  Nessun documento.
                </td>
              </tr>
            ) : (
              filteredDocs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="text-ink-primary font-medium truncate">{d.name}</div>
                    {d.rel && <div className="text-body-sm text-ink-tertiary truncate mt-xxs">{d.rel}</div>}
                  </td>
                  <td>
                    <select
                      value={d.item_id || ""}
                      onChange={async (e) => setState(await api.patchDoc(d.id, { item_id: e.target.value }))}
                      className="w-full h-9 px-sm rounded border border-border-subtle bg-surface text-body-sm"
                    >
                      <option value="">—</option>
                      {(catalog?.items || []).map((it) => (
                        <option key={it.id} value={it.id}>{it.id} {it.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="font-mono text-body-sm">
                    {d.confidence ? `${Math.round(d.confidence * 100)}%` : "—"}
                  </td>
                  <td>
                    <StatusBadge variant={mapStatusToVariant(d.skip ? "✗" : d.item_id ? "✓" : "wip")}>
                      {d.skip ? "Skip" : d.item_id ? "OK" : "wip"}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={async () => setState(await api.patchDoc(d.id, { skip: !d.skip }))}
                      className="text-body-sm text-ink-secondary hover:text-ink-primary underline"
                    >
                      {d.skip ? "Reincludi" : "Skip"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RichiestaContent({
  catalog,
  state,
  setState,
}: {
  catalog: Catalog | null;
  state: AppState | null;
  setState: React.Dispatch<React.SetStateAction<AppState | null>>;
}) {
  function itemOverride(st: AppState | null, id: string): "✗" | "N/A" | "" {
    if (st?.pratica?.skip_items.includes(id)) return "✗";
    if (st?.pratica?.na_items.includes(id)) return "N/A";
    return "";
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: "10%" }}>Voce</th>
            <th style={{ width: "38%" }}>Descrizione</th>
            <th style={{ width: "12%" }}>Status</th>
            <th style={{ width: "15%" }}>Override</th>
            <th style={{ width: "25%" }}>File</th>
          </tr>
        </thead>
        <tbody>
          {(catalog?.items || []).map((it) => {
            const st = state?.checklist[it.id] || "";
            const files = (state?.documents || []).filter((d) => d.item_id === it.id);
            const override = itemOverride(state, it.id);
            return (
              <tr key={it.id}>
                <td className="font-medium font-mono">{it.id}</td>
                <td>
                  <div>{it.label}</div>
                  {it.need && (st === "wip" || st === "") && (
                    <div className="text-body-sm text-status-yellow-text mt-xxs">{it.need}</div>
                  )}
                </td>
                <td>
                  <StatusBadge variant={mapStatusToVariant(st || "wip")}>{st || "wip"}</StatusBadge>
                </td>
                <td>
                  <select
                    value={override}
                    onChange={async (e) => setState(await api.patchItem(it.id, e.target.value as "✗" | "N/A" | ""))}
                    className="w-full h-9 px-sm rounded border border-border-subtle bg-surface text-body-sm"
                  >
                    <option value="">Automatico</option>
                    <option value="✗">Skip (✗)</option>
                    <option value="N/A">N/A</option>
                  </select>
                </td>
                <td className="text-body-sm text-ink-tertiary truncate">
                  {files.map((f) => f.name).join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectionContent({
  view,
  activeSection,
  state,
  setPicked,
}: {
  view: string;
  activeSection: { title: string; blurb: string; look_for?: string };
  state: AppState | null;
  setPicked: React.Dispatch<React.SetStateAction<ProvenanceRow | null>>;
}) {
  const rows = (state?.provenance || []).filter((r) => r.sheet === view || (view === "A" && r.sheet === "A"));

  return (
    <div className="p-lg">
      <div className="flex items-start justify-between gap-md mb-lg">
        <div>
          <h3 className="text-headline-sm text-ink-primary">{view} — {activeSection.title}</h3>
          <p className="text-body-md text-ink-secondary mt-xs">{activeSection.blurb}</p>
          {activeSection.look_for && (
            <p className="text-body-sm text-ink-tertiary mt-xs">Cosa cerchiamo: {activeSection.look_for}</p>
          )}
        </div>
        {state?.sections.find((s) => s.id === view)?.status && (
          <StatusBadge variant={mapStatusToVariant(state.sections.find((s) => s.id === view)!.status)}>
            {state.sections.find((s) => s.id === view)!.status}
          </StatusBadge>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-body-md text-ink-tertiary">Nessun dato scritto in questa sezione.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>Cella</th>
                <th style={{ width: "35%" }}>Valore</th>
                <th style={{ width: "30%" }}>Fonte</th>
                <th style={{ width: "20%" }}>Metodo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setPicked(r)}>
                  <td className="font-mono">{r.sheet}!{r.cell}</td>
                  <td className="truncate">{r.value}</td>
                  <td className="text-ink-tertiary truncate">{r.source_name}</td>
                  <td>{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MancantiContent({ state }: { state: AppState | null }) {
  return (
    <div className="p-lg">
      <h3 className="text-headline-sm text-ink-primary mb-md">Documenti mancanti</h3>
      {(state?.missing || []).length === 0 ? (
        <p className="text-body-md text-ink-tertiary">
          Nessun mancante, oppure la compilazione non è ancora partita.
        </p>
      ) : (
        <ul className="space-y-sm">
          {(state?.missing || []).map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-md p-md rounded-lg border border-border-muted">
              <div>
                <span className="text-label-md text-ink-primary font-medium">{m.id}</span>
                <span className="text-body-md text-ink-secondary ml-sm">{m.label}</span>
                {m.need && <p className="text-body-sm text-ink-tertiary mt-xs">{m.need}</p>}
              </div>
              <StatusBadge variant="warning">wip</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProvenanceContent({
  state,
  setPicked,
}: {
  state: AppState | null;
  setPicked: React.Dispatch<React.SetStateAction<ProvenanceRow | null>>;
}) {
  const rows = state?.provenance || [];

  return (
    <div className="p-lg">
      <h3 className="text-headline-sm text-ink-primary mb-md">Master provenienza</h3>
      {rows.length === 0 ? (
        <p className="text-body-md text-ink-tertiary">Nessun dato disponibile.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>Cella</th>
                <th style={{ width: "35%" }}>Valore</th>
                <th style={{ width: "30%" }}>Fonte</th>
                <th style={{ width: "20%" }}>Metodo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setPicked(r)}>
                  <td className="font-mono">{r.sheet}!{r.cell}</td>
                  <td className="truncate">{r.value}</td>
                  <td className="text-ink-tertiary truncate">{r.source_name}</td>
                  <td>{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProvenancePanel({
  picked,
  onClose,
}: {
  picked: ProvenanceRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-primary/18 backdrop-blur-modal" />
      <aside
        className="relative h-full w-full max-w-md bg-surface-card border-l border-border-subtle p-lg overflow-y-auto shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-md mb-lg">
          <h3 className="text-headline-sm text-ink-primary">Fonte del dato</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-sm rounded hover:bg-surface-hover transition-colors-fast"
          >
            <Icon name="close" size="md" className="text-ink-secondary" />
          </button>
        </div>

        <dl className="space-y-md">
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Cella</dt>
            <dd className="text-body-md text-ink-primary font-mono mt-xxs">{picked.sheet}!{picked.cell}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Valore</dt>
            <dd className="text-body-md text-ink-primary mt-xxs">{picked.value}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Voce</dt>
            <dd className="text-body-md text-ink-primary mt-xxs">{picked.item_id || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">File</dt>
            <dd className="text-body-md text-ink-primary mt-xxs break-all">{picked.source_name}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Percorso</dt>
            <dd className="text-body-md text-ink-primary mt-xxs break-all">{picked.source_rel || picked.source_path || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Pagina</dt>
            <dd className="text-body-md text-ink-primary mt-xxs">{picked.page || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Metodo</dt>
            <dd className="text-body-md text-ink-primary mt-xxs">{picked.method}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Confidenza</dt>
            <dd className="text-body-md text-ink-primary mt-xxs">{Math.round(picked.confidence * 100)}%</dd>
          </div>
          {picked.excerpt && (
            <div>
              <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Stralcio</dt>
              <dd className="text-body-md text-ink-primary mt-xxs">{picked.excerpt}</dd>
            </div>
          )}
          <div>
            <dt className="text-label-sm text-ink-tertiary uppercase tracking-wide">Timestamp</dt>
            <dd className="text-body-md text-ink-primary font-mono mt-xxs">{picked.ts}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
