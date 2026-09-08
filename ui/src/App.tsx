import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  api,
  asUserError,
  parseErrorBody,
  type AppState,
  type Catalog,
  type ProvenanceRow,
  type Status,
  type UserFacingError,
} from "./api";
import { Logo } from "./Logo";

const ALL_SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

const SECTION_HELP: Record<string, { title: string; blurb: string; look_for: string }> = {
  A: {
    title: "Sistema di controllo interno",
    blurb: "Come è organizzata l'azienda e se procedure o organigramma sono cambiati.",
    look_for: "Organigramma, mail sulle procedure, cartelle e avvisi, fatti straordinari.",
  },
  B: {
    title: "Libri obbligatori",
    blurb: "Controlla che i libri contabili e fiscali siano aggiornati.",
    look_for: "Libro giornale, libro inventari, registri IVA.",
  },
  C: {
    title: "Adempimenti tributari e previdenziali",
    blurb: "Verifica F24, IVA periodica, fondi e pagamenti del personale.",
    look_for: "Quietanze F24, LIPE, fondi previdenziali, Intrastat, cedolini, bonifico stipendi.",
  },
  D: {
    title: "Test su rilevazioni contabili",
    blurb: "Campiona le registrazioni del giornale. Si può saltare se questo trimestre non serve.",
    look_for: "Libro giornale o mastrini in formato testo.",
  },
  E: {
    title: "Disponibilità liquide",
    blurb: "Confronta i saldi in banca con la contabilità.",
    look_for: "Estratti conto, riconciliazioni bancarie, Centrale Rischi.",
  },
  F: {
    title: "Verbali organi sociali",
    blurb: "Legge i verbali per fatti che impattano i conti.",
    look_for: "Verbali assemblee, CdA, Collegio sindacale, libro soci.",
  },
  G: {
    title: "Analisi situazione contabile",
    blurb: "Analizza il bilancino e il confronto con budget e cashflow.",
    look_for: "Bilancino di verifica, CE vs budget, budget e cashflow.",
  },
  H: {
    title: "Colloqui con la Direzione",
    blurb: "Appunti dei colloqui con l'azienda. Si compila a mano.",
    look_for: "Note o verbali dei colloqui con la Direzione.",
  },
  I: {
    title: "Operazioni particolarmente significative",
    blurb: "Segnala operazioni straordinarie o movimenti anomali.",
    look_for: "Contratti, atti M&A, nuovi prestiti, transazioni extra-business.",
  },
};

function sectionHelp(id: string, catalog: Catalog | null) {
  const api = catalog?.sections.find((s) => s.id === id);
  const local = SECTION_HELP[id];
  return {
    title: api?.title || local?.title || id,
    blurb: api?.blurb || local?.blurb || "",
    look_for: api?.look_for || local?.look_for || "",
  };
}

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

const btn =
  "cursor-pointer rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function pill(status: Status | string) {
  const map: Record<string, string> = {
    "✓": "bg-emerald-100 text-emerald-900",
    wip: "bg-yellow-300 text-yellow-950",
    "✗": "bg-rose-100 text-rose-800",
    "N/A": "bg-neutral-200 text-neutral-600",
    "": "bg-neutral-50 text-neutral-400",
  };
  const label: Record<string, string> = {
    "✓": "Ricevuto",
    wip: "Mancante / WIP",
    "✗": "Skip",
    "N/A": "N/A",
    "": "—",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || map[""]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label[status] || status}
    </span>
  );
}

function IconMenu({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [view, setView] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
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
    go("overview");
  }

  function readyError(action: "scan" | "run"): UserFacingError | null {
    if (!form.client.trim()) {
      return {
        title: "Manca il nome del cliente",
        detail:
          "Senza il cliente Quadra non sa come intestare il foglio INDICE. Scrivilo nel campo Cliente a sinistra.",
        missing: ["Campo Cliente"],
      };
    }
    const hasFolder =
      folderFiles.length > 0 ||
      Boolean(linkDir.trim()) ||
      Boolean(state?.pratica?.documents_dir);
    if (action === "scan" && !hasFolder) {
      return {
        title: "Nessuna cartella documenti",
        detail:
          "Non hai ancora scelto i file. Usa «Scegli cartella» (funziona da Mac e da Windows) oppure collega un percorso che il server può leggere.",
        missing: ["Cartella documenti"],
      };
    }
    if (action === "run" && !(state?.documents || []).length) {
      return {
        title: "Non posso compilare: manca la scansione",
        detail:
          "Prima scegli la cartella e premi 1 · Scansiona. Solo dopo Quadra sa quali F24, e/c e mastrini usare. Avvia è il passo 2.",
        missing: ["1 · Scansiona"],
      };
    }
    return null;
  }

  function go(id: string) {
    setView(id);
    setNavOpen(false);
  }

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
      go("overview");
      return;
    }
    setErr(null);
    setBusy(true);
    go("overview");
    setState((prev) =>
      prev
        ? {
            ...prev,
            running: true,
            current_section: "Documenti",
            job_step: 1,
            job_total: 2,
            job_label: "Lettura nomi e cartelle (senza copia, senza OCR)",
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
          job_label: "Lettura nomi e cartelle (senza copia, senza OCR)",
          progress: 18,
        });
      }
      const scanned = await api.scan();
      setState(scanned);
      go("docs");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    const local = readyError("run");
    if (local) {
      setErr(local);
      go("overview");
      return;
    }
    setErr(null);
    setBusy(true);
    go("overview");
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
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

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
  const viewLabel = nav.find((n) => n.id === view)?.label || view;
  const activeSection = ALL_SECTIONS.includes(view) ? sectionHelp(view, catalog) : null;
  const hasFolder =
    folderFiles.length > 0 || Boolean(linkDir.trim()) || Boolean(state?.pratica?.documents_dir);
  const scanned = (state?.documents || []).length > 0;
  const nextStep = !form.client.trim()
    ? "Prima scrivi il nome del cliente."
    : !hasFolder
      ? "Poi scegli la cartella dei documenti."
      : !scanned
        ? "Adesso premi 1 · Scansiona. Quadra legge i file e li mette sulla voce giusta."
        : "Controlla Documenti, poi premi 2 · Avvia per compilare l’Excel.";

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-paper">
      {navOpen && (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-40 cursor-pointer bg-ink/50 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] shrink-0 flex-col border-r border-line bg-white transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-80 lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo className="h-9 w-9 shrink-0 text-ink" />
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight">Quadra</div>
            <div className="text-xs text-muted">Controllo contabile · SA 250B</div>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Pratica</p>
          <Field label="Cliente" value={form.client} onChange={(v) => setForm({ ...form, client: v })} />
          <PeriodSelect
            period={form.period}
            onChange={(v) => setForm({ ...form, period: v })}
          />
          <Field
            label="Cartella sul Mac (lettura diretta)"
            value={linkDir}
            onChange={(v) => {
              setLinkDir(v);
              if (v) setFolderFiles([]);
            }}
            placeholder="/Volumes/…/II Trimestre 2026"
          />
          <p className="px-1 text-[11px] leading-snug text-muted">
            Quadra gira su questo computer: incolla il percorso e i file restano dove sono. Non si caricano su nessun server.
          </p>
          {state?.pratica?.ingest_kind === "link" ? (
            <p className="break-anywhere px-1 text-[11px] text-emerald-800">{state.pratica.documents_dir}</p>
          ) : null}
          <details className="rounded-lg border border-line bg-paper/60 px-2.5 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-muted">
              Invece copia i file (lento, solo se Quadra è su un altro PC)
            </summary>
            <div className="pt-2">
              <FolderPicker
                count={folderFiles.length}
                ingestKind={state?.pratica?.ingest_kind || ""}
                onPick={(files) => {
                  setFolderFiles(files);
                  if (files.length) setLinkDir("");
                }}
              />
            </div>
          </details>
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted">Sezioni da svolgere (A–I)</p>
            <p className="mb-2 text-[11px] leading-snug text-muted">
              Ogni lettera è una carta del controllo. Lascia spuntate quelle da fare; togli la spunta solo se questo trimestre non servono (andranno ✗ sull’INDICE).
            </p>
            <div className="space-y-0.5">
              {ALL_SECTIONS.map((id) => {
                const on = !form.skip_sections.includes(id);
                const meta = sectionHelp(id, catalog);
                return (
                  <label
                    key={id}
                    className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-paper ${on ? "" : "opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={on}
                      onChange={() =>
                        setForm({
                          ...form,
                          skip_sections: on
                            ? [...form.skip_sections, id]
                            : form.skip_sections.filter((x) => x !== id),
                        })
                      }
                    />
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-1.5">
                        <span className="w-4 shrink-0 font-semibold tabular-nums">{id}</span>
                        <span className="min-w-0 font-medium leading-snug">{meta.title}</span>
                      </span>
                      <span className="mt-0.5 block pl-5 text-[11px] leading-snug text-muted">{meta.blurb}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Fatto da" value={form.done_by} onChange={(v) => setForm({ ...form, done_by: v })} />
            <Field label="Rivisto da" value={form.reviewed_by} onChange={(v) => setForm({ ...form, reviewed_by: v })} />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Invio rich." value={form.request_date} onChange={(v) => setForm({ ...form, request_date: v })} placeholder="YYYY-MM-DD" />
            <Field label="Svolgimento" value={form.activity_date} onChange={(v) => setForm({ ...form, activity_date: v })} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-medium text-muted">Ordine dei due tasti</p>
            <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-muted">
              <li>
                <span className="font-medium text-ink">Scansiona</span> — legge la cartella e classifica i file (F24, estratti, mastrini…). Poi controlla la pagina Documenti.
              </li>
              <li>
                <span className="font-medium text-ink">Avvia</span> — solo dopo la scansione: compila l’Excel. Non schiacciarlo per primo.
              </li>
            </ol>
            <p className="text-[11px] leading-snug text-muted">{nextStep}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={scan}
                disabled={busy || !hasFolder || !form.client.trim()}
                title={
                  !form.client.trim()
                    ? "Scrivi prima il nome del cliente"
                    : !hasFolder
                      ? "Scegli prima la cartella documenti"
                      : "Passo 1: leggi e classifica i file"
                }
                className={`${btn} min-h-11 w-full border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {busy && !state?.running ? "Carico…" : "1 · Scansiona"}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy || state?.running || !scanned}
                title={!scanned ? "Prima premi Scansiona" : "Passo 2: compila l’Excel"}
                className={`${btn} min-h-11 w-full bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {state?.running || busy ? "In corso…" : "2 · Avvia"}
              </button>
            </div>
          </div>
        </div>
        <nav className="max-h-[42%] overflow-y-auto border-t border-line px-3 py-3" aria-label="Sezioni">
          {nav.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => go(n.id)}
              className={`${btn} mb-0.5 flex min-h-11 w-full min-w-0 items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                view === n.id ? "bg-paper font-medium" : "text-muted hover:bg-paper/70"
              }`}
            >
              <span className="min-w-0 break-anywhere">{n.label}</span>
              {n.id.length === 1 && state?.sections.find((s) => s.id === n.id)?.status
                ? pill(state.sections.find((s) => s.id === n.id)!.status)
                : null}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            className={`${btn} inline-flex min-h-11 min-w-11 items-center justify-center border border-line hover:bg-paper lg:hidden`}
            aria-label={navOpen ? "Chiudi menu" : "Apri menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <IconMenu open={navOpen} />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <Logo className="h-7 w-7 shrink-0 text-ink lg:hidden" />
            <div className="min-w-0 text-sm text-muted">
              <span className="font-semibold text-ink">Quadra</span>
              <span className="hidden text-ink/40 sm:inline"> / </span>
              <span className="hidden break-anywhere font-medium text-ink sm:inline">{viewLabel}</span>
            </div>
          </div>
          <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-64">
            <label className="sr-only" htmlFor="doc-search">
              Cerca documenti
            </label>
            <input
              id="doc-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca documenti…"
              className="h-11 w-full min-w-0 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-ink/30"
            />
          </div>
          <a href="/api/export/xlsx" className={`${btn} ml-auto inline-flex min-h-11 shrink-0 items-center bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 sm:ml-0`}>
            Esporta Excel
          </a>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {shownError && <ErrorBanner err={shownError} />}

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="File in cartella" value={k.files} hint="documenti letti" />
            <Kpi title="Classificati" value={k.classified} hint="voci checklist" />
            <Kpi title="Mancanti" value={k.missing} hint="status wip" />
            <Kpi title="Sezioni chiuse" value={`${k.sections_done}/9`} hint="semaforo INDICE" />
          </div>

          {view === "overview" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5 xl:col-span-2">
                <WorkPanel state={state} catalog={catalog} working={working} errored={Boolean(shownError)} />
                {(state?.missing || []).length > 0 && !working && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
                    <p className="text-xs font-semibold text-amber-950">Cosa manca ancora</p>
                    <ul className="mt-2 space-y-2">
                      {(state?.missing || []).slice(0, 4).map((m) => (
                        <li key={m.id} className="text-xs text-amber-950">
                          <span className="font-medium">{m.id}</span> — {m.need || m.label}
                        </li>
                      ))}
                    </ul>
                    {(state?.missing || []).length > 4 ? (
                      <button type="button" className={`${btn} mt-2 text-xs font-medium text-amber-950 underline`} onClick={() => go("mancanti")}>
                        Vedi tutti i {(state?.missing || []).length} mancanti
                      </button>
                    ) : null}
                  </div>
                )}
                <LogList logs={state?.logs || []} working={working} />
              </section>
              <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
                <h2 className="text-sm font-semibold">Carte di lavoro A–I</h2>
                <p className="mt-1 text-[11px] text-muted">Clicca una sezione per vederla. Lo stato è il semaforo dell’INDICE.</p>
                <ul className="mt-3 space-y-3">
                  {(state?.sections || []).map((s) => {
                    const meta = sectionHelp(s.id, catalog);
                    return (
                      <li key={s.id} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                        <button type="button" className={`${btn} min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-paper`} onClick={() => go(s.id)}>
                          <span className="block break-anywhere font-medium">
                            {s.id} — {meta.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted">{meta.blurb}</span>
                        </button>
                        {pill(s.status)}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {view === "docs" && (
            <TableCard title="Documenti classificati">
              <div className="md:hidden">
                {filteredDocs.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nessun documento.</p>}
                {filteredDocs.map((d) => (
                  <article key={d.id} className="space-y-3 border-t border-line px-4 py-4">
                    <div className="min-w-0">
                      <div className="break-anywhere font-medium">{d.name}</div>
                      {d.rel ? <div className="mt-1 break-anywhere text-xs text-muted">{d.rel}</div> : null}
                      {d.excerpt && d.excerpt !== d.rel ? <div className="mt-1 break-anywhere text-xs text-muted">{d.excerpt}</div> : null}
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-muted">Voce</span>
                      <DocSelect
                        value={d.item_id || ""}
                        items={catalog?.items || []}
                        onChange={async (v) => setState(await api.patchDoc(d.id, { item_id: v }))}
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm tabular-nums text-muted">{d.confidence ? `${Math.round(d.confidence * 100)}%` : "—"}</span>
                      {pill(d.skip ? "✗" : d.item_id ? "✓" : "wip")}
                      <button
                        type="button"
                        className={`${btn} min-h-11 rounded-lg border border-line px-3 py-1 text-xs hover:bg-paper`}
                        onClick={async () => setState(await api.patchDoc(d.id, { skip: !d.skip }))}
                      >
                        {d.skip ? "Reincludi" : "Skip"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[32%]" />
                    <col className="w-[30%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <Th>File</Th>
                      <Th>Voce</Th>
                      <Th>Conf.</Th>
                      <Th>Stato</Th>
                      <Th>Azioni</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((d) => (
                      <tr key={d.id} className="border-t border-line">
                        <Td>
                          <div className="break-anywhere font-medium">{d.name}</div>
                          {d.rel ? <div className="mt-0.5 break-anywhere text-xs text-muted">{d.rel}</div> : null}
                        </Td>
                        <Td>
                          <DocSelect
                            value={d.item_id || ""}
                            items={catalog?.items || []}
                            onChange={async (v) => setState(await api.patchDoc(d.id, { item_id: v }))}
                          />
                        </Td>
                        <Td className="tabular-nums">{d.confidence ? `${Math.round(d.confidence * 100)}%` : "—"}</Td>
                        <Td>{pill(d.skip ? "✗" : d.item_id ? "✓" : "wip")}</Td>
                        <Td>
                          <button
                            type="button"
                            className={`${btn} min-h-9 rounded-lg border border-line px-2 py-1 text-xs hover:bg-paper`}
                            onClick={async () => setState(await api.patchDoc(d.id, { skip: !d.skip }))}
                          >
                            {d.skip ? "Reincludi" : "Skip"}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>
          )}

          {view === "richiesta" && (
            <TableCard title="Checklist richiesta documenti">
              <div className="md:hidden">
                {(catalog?.items || []).map((it) => {
                  const st = state?.checklist[it.id] || "";
                  const files = (state?.documents || []).filter((d) => d.item_id === it.id);
                  const override = itemOverride(state, it.id);
                  return (
                    <article key={it.id} className="space-y-3 border-t border-line px-4 py-4">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">{it.id}</div>
                          <div className="mt-1 break-anywhere text-sm">{it.label}</div>
                          {it.need && (st === "wip" || st === "") ? (
                            <div className="mt-1 break-anywhere text-[11px] leading-snug text-amber-900">{it.need}</div>
                          ) : null}
                        </div>
                        {pill(st)}
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-muted">Override</span>
                        <OverrideSelect value={override} onChange={async (v) => setState(await api.patchItem(it.id, v))} />
                      </label>
                      <p className="break-anywhere text-xs text-muted">{files.map((f) => f.name).join(", ") || "—"}</p>
                    </article>
                  );
                })}
              </div>
              <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[36%]" />
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <Th>Voce</Th>
                      <Th>Descrizione</Th>
                      <Th>Status</Th>
                      <Th>Override</Th>
                      <Th>File</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(catalog?.items || []).map((it) => {
                      const st = state?.checklist[it.id] || "";
                      const files = (state?.documents || []).filter((d) => d.item_id === it.id);
                      const override = itemOverride(state, it.id);
                      return (
                        <tr key={it.id} className="border-t border-line">
                          <Td className="font-medium">{it.id}</Td>
                          <Td>
                            <div>{it.label}</div>
                            {it.need && (st === "wip" || st === "") ? (
                              <div className="mt-1 text-[11px] leading-snug text-amber-900">{it.need}</div>
                            ) : null}
                          </Td>
                          <Td>{pill(st)}</Td>
                          <Td>
                            <OverrideSelect value={override} onChange={async (v) => setState(await api.patchItem(it.id, v))} />
                          </Td>
                          <Td className="text-xs text-muted">{files.map((f) => f.name).join(", ") || "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TableCard>
          )}

          {activeSection && (
            <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {view} — {activeSection.title}
                  </h2>
                  <p className="mt-1 max-w-prose text-sm text-muted">{activeSection.blurb}</p>
                  {activeSection.look_for ? (
                    <p className="mt-1 max-w-prose text-[11px] leading-snug text-muted">
                      Cosa cerchiamo: {activeSection.look_for}
                    </p>
                  ) : null}
                </div>
                {pill(state?.sections.find((s) => s.id === view)?.status || "")}
              </div>
              <p className="mb-4 max-w-prose text-sm text-muted">Dati scritti in questa sezione, con fonte. Clicca una riga per il dettaglio.</p>
              <ProvTable
                rows={(state?.provenance || []).filter((r) => r.sheet === view || (view === "A" && r.sheet === "A"))}
                onPick={setPicked}
              />
            </section>
          )}

          {view === "mancanti" && (
            <TableCard title="Documenti mancanti (wip)">
              <ul className="divide-y divide-line text-sm">
                {(state?.missing || []).length === 0 && (
                  <li className="px-4 py-6 text-muted">Nessun mancante, oppure la compilazione non è ancora partita.</li>
                )}
                {(state?.missing || []).map((m) => (
                  <li key={m.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <span className="min-w-0 break-anywhere">
                      <span className="font-medium">{m.id}</span> {m.label}
                      {m.need ? <span className="mt-1 block text-xs leading-snug text-muted">{m.need}</span> : null}
                    </span>
                    {pill("wip")}
                  </li>
                ))}
              </ul>
            </TableCard>
          )}

          {view === "prov" && (
            <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
              <h2 className="mb-3 text-sm font-semibold">Master provenienza</h2>
              <ProvTable rows={state?.provenance || []} onPick={setPicked} />
            </section>
          )}
        </div>
      </main>

      {picked && (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-end bg-ink/50" onClick={() => setPicked(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-card sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Fonte del dato</h3>
              <button type="button" onClick={() => setPicked(null)} className={`${btn} min-h-11 px-3 text-sm text-muted hover:text-ink`}>
                Chiudi
              </button>
            </div>
            <Dl k="Cella" v={`${picked.sheet}!${picked.cell}`} />
            <Dl k="Valore" v={picked.value} />
            <Dl k="Voce" v={picked.item_id || "—"} />
            <Dl k="File" v={picked.source_name} />
            <Dl k="Percorso" v={picked.source_rel || picked.source_path || "—"} />
            <Dl k="Pagina" v={picked.page || "—"} />
            <Dl k="Metodo" v={picked.method} />
            <Dl k="Confidenza" v={`${Math.round(picked.confidence * 100)}%`} />
            <Dl k="Stralcio" v={picked.excerpt || "—"} />
            <Dl k="Timestamp" v={picked.ts} />
          </aside>
        </div>
      )}
    </div>
  );
}

function itemOverride(state: AppState | null, id: string): "✗" | "N/A" | "" {
  if (state?.pratica?.skip_items.includes(id)) return "✗";
  if (state?.pratica?.na_items.includes(id)) return "N/A";
  return "";
}

function PeriodSelect({ period, onChange }: { period: string; onChange: (v: string) => void }) {
  const { q, year } = splitPeriod(period || "Aprile - Giugno 2026");
  return (
    <div className="grid min-w-0 grid-cols-3 gap-2">
      <label className="col-span-2 block min-w-0">
        <span className="mb-1 block text-[11px] font-medium text-muted">Trimestre</span>
        <select
          value={q}
          onChange={(e) => onChange(composePeriod(e.target.value, year))}
          className="h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-2.5 text-sm outline-none focus:border-ink/30"
        >
          {QUARTER_OPTS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[11px] font-medium text-muted">Anno</span>
        <input
          value={year}
          onChange={(e) => onChange(composePeriod(q, e.target.value.replace(/\D/g, "").slice(0, 4)))}
          inputMode="numeric"
          className="h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-2.5 text-sm outline-none focus:border-ink/30"
        />
      </label>
    </div>
  );
}

function FolderPicker({
  count,
  ingestKind,
  onPick,
}: {
  count: number;
  ingestKind: string;
  onPick: (files: File[]) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted">Documenti</span>
      <input
        type="file"
        className="sr-only"
        multiple
        webkitdirectory=""
        directory=""
        onChange={(e) => onPick(Array.from(e.target.files || []))}
      />
      <span className={`${btn} flex h-11 w-full min-w-0 items-center rounded-lg border border-line bg-paper px-2.5 text-sm hover:bg-white`}>
        <span className="min-w-0 truncate">
          {count ? `${count} file da caricare` : "Scegli cartella (Mac o Windows)"}
        </span>
      </span>
      {ingestKind === "upload" ? (
        <span className="mt-1 block text-[11px] text-amber-900">I file verranno copiati. Su questo Mac è inutile: usa il percorso sopra.</span>
      ) : (
        <span className="mt-1 block text-[11px] text-muted">Il browser non può mandare il path /Volumes. Per quello serve il campo percorso.</span>
      )}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-0 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink/30"
      />
    </label>
  );
}

function Kpi({ title, value, hint }: { title: string; value: number | string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="break-anywhere text-xs text-muted">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 break-anywhere text-[11px] text-emerald-700">{hint}</div>
    </div>
  );
}

function ErrorBanner({ err }: { err: UserFacingError }) {
  return (
    <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
      <p className="font-semibold">{err.title}</p>
      {err.detail ? <p className="mt-1 break-anywhere leading-snug text-rose-900">{err.detail}</p> : null}
      {err.missing.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800">Cosa manca</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {err.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function workTime(ts: string) {
  const part = ts.includes("T") ? ts.split("T")[1] : ts;
  return part.replace("Z", "").slice(0, 8);
}

function WorkPanel({
  state,
  catalog,
  working,
  errored,
}: {
  state: AppState | null;
  catalog: Catalog | null;
  working: boolean;
  errored: boolean;
}) {
  const target = Math.max(0, Math.min(100, state?.progress || 0));
  const step = state?.job_step || 0;
  const total = state?.job_total || 0;
  const stopped = errored || Boolean(state?.error);
  const finished = !working && !stopped && target >= 100;
  const remaining = total > 0 ? Math.max(0, total - step) : 0;
  const barPct = working ? Math.max(6, target) : stopped ? 0 : target;

  let subtitle = "Niente in corso. Quando sei pronto: 1 · Scansiona, poi 2 · Avvia.";
  if (working) subtitle = state?.job_label || "Elaborazione in corso";
  else if (stopped) subtitle = "Fermato. Correggi il problema sopra e riprova.";
  else if (finished) {
    subtitle = state?.job_label || "Completato";
    if (state?.current_section && ALL_SECTIONS.includes(state.current_section)) {
      subtitle = `${state.current_section} — ${sectionHelp(state.current_section, catalog).title}`;
    }
  } else if (state?.current_section && state.current_section !== "Documenti") {
    subtitle = ALL_SECTIONS.includes(state.current_section)
      ? `${state.current_section} — ${sectionHelp(state.current_section, catalog).title}`
      : state.current_section;
  }

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Lavoro in corso</h2>
          <p className={`mt-1 max-w-prose text-xs leading-5 ${working ? "text-ink" : "text-muted"}`}>{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm tabular-nums text-muted">{Math.round(barPct)}%</p>
          {working && total > 0 ? (
            <p className="mt-0.5 text-[11px] leading-4 tabular-nums text-muted">
              passo {step}/{total}
              {remaining ? ` · restano ${remaining}` : ""}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
        <div
          className={`h-full rounded-full bg-ink ${working ? "work-bar-fill" : ""}`}
          style={{ width: `${barPct}%`, transition: "width 280ms ease-out" }}
        />
      </div>
    </div>
  );
}

function LogList({ logs, working }: { logs: AppState["logs"]; working?: boolean }) {
  const last = logs.slice(-12).reverse();
  return (
    <ul className="mt-5 min-w-0 divide-y divide-line border-t border-line">
      {last.length === 0 && (
        <li className="pt-3 text-sm leading-5 text-muted">
          {working
            ? "Avvio in corso…"
            : "Ordine: cartella documenti → 1 Scansiona → controlla Documenti → 2 Avvia."}
        </li>
      )}
      {last.map((l, i) => (
        <li key={`${l.ts}-${l.section}-${i}`} className="min-w-0 py-3">
          <div className="flex min-w-0 items-baseline justify-between gap-3 text-[11px] leading-4 text-muted">
            <span className="min-w-0 truncate font-medium" title={l.section || undefined}>
              {l.section || "Attività"}
            </span>
            <span className="shrink-0 tabular-nums">{workTime(l.ts)}</span>
          </div>
          <p
            className={`mt-1 min-w-0 break-anywhere text-sm leading-5 ${
              l.level === "error" ? "text-rose-700" : l.level === "warn" ? "text-amber-800" : "text-ink"
            }`}
          >
            {l.message}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="break-anywhere border-b border-line px-4 py-3 text-sm font-semibold sm:px-5">{title}</div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="cell px-3 py-2 font-medium sm:px-4">{children}</th>;
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`cell break-anywhere px-3 py-2.5 sm:px-4 ${className}`}>{children}</td>;
}

function selectClass() {
  return "h-11 w-full min-w-0 max-w-full rounded-lg border border-line bg-paper px-2 py-1 text-xs";
}

function DocSelect({
  value,
  items,
  onChange,
}: {
  value: string;
  items: { id: string; label: string }[];
  onChange: (v: string) => void | Promise<void>;
}) {
  return (
    <select className={selectClass()} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {items.map((it) => (
        <option key={it.id} value={it.id}>
          {it.id} {it.label}
        </option>
      ))}
    </select>
  );
}

function OverrideSelect({
  value,
  onChange,
}: {
  value: "✗" | "N/A" | "";
  onChange: (v: "✗" | "N/A" | "") => void | Promise<void>;
}) {
  return (
    <select className={selectClass()} value={value} onChange={(e) => onChange((e.target.value || "") as "✗" | "N/A" | "")}>
      <option value="">Automatico</option>
      <option value="✗">Skip (✗)</option>
      <option value="N/A">N/A</option>
    </select>
  );
}

function ProvTable({ rows, onPick }: { rows: ProvenanceRow[]; onPick: (r: ProvenanceRow) => void }) {
  if (!rows.length) return <p className="px-1 py-6 text-sm text-muted">Nessun dato scritto in questa vista.</p>;
  return (
    <>
      <div className="md:hidden">
        {rows.map((r) => (
          <button
            type="button"
            key={r.id}
            className={`${btn} flex w-full min-w-0 flex-col items-start gap-1 border-t border-line px-1 py-3 text-left hover:bg-paper`}
            onClick={() => onPick(r)}
          >
            <span className="text-xs font-medium text-muted">
              {r.sheet}!{r.cell}
            </span>
            <span className="w-full break-anywhere text-sm">{r.value}</span>
            <span className="w-full break-anywhere text-xs text-muted">
              {r.source_name} · {r.method}
            </span>
          </button>
        ))}
      </div>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[34%]" />
            <col className="w-[32%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <Th>Cella</Th>
              <Th>Valore</Th>
              <Th>Fonte</Th>
              <Th>Metodo</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer border-t border-line hover:bg-paper" onClick={() => onPick(r)}>
                <Td className="font-medium">
                  {r.sheet}!{r.cell}
                </Td>
                <Td>{r.value}</Td>
                <Td className="text-muted">{r.source_name}</Td>
                <Td>{r.method}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dl({ k, v }: { k: string; v: string }) {
  return (
    <div className="mb-3 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{k}</div>
      <div className="break-anywhere text-sm">{v}</div>
    </div>
  );
}
