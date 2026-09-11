import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { asUserError } from "../api";
import {
  Callout,
  Card,
  CardHeader,
  DataTable,
  Icon,
  StatusBadge,
} from "../components";
import {
  type ExtractionProfile,
  type FileInspection,
  jetApi,
  type JetParams,
  type JetPractice,
  type JetResult,
  type JetSource,
  type ResultFilters,
} from "./api";
import { ParamsPanel } from "./ParamsPanel";
import {
  mappingIsReady,
  presetProva,
  PROFILO_PROVA_NOME,
  PROFILO_PROVA_POSIZIONI,
  PROVA_CLIENT,
  suggestMapping,
} from "./presetProva";

const inputClass =
  "w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary";
const buttonClass =
  "inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed";
const ghostButtonClass =
  "inline-flex items-center justify-center gap-sm px-base py-sm rounded border border-border-subtle text-label-md text-ink-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed";

const EMPTY: JetParams = {
  materialita_bilancio: null,
  performance_materiality: null,
  utile_netto_dopo_imposte: null,
  valore_medio_registrazione: null,
  soglia_importo_cifra_tonda: null,
  paese: null,
  orario_ufficio_inizio: "08:00",
  orario_ufficio_fine: "18:00",
  giorni_weekend: null,
  soglia_backdating_giorni: null,
  data_chiusura: null,
  finestra_chiusura_giorni_lavorativi: null,
  festivita: null,
  staff_autorizzato: null,
  utenti_di_sistema: null,
  parole_chiave_parti_correlate: null,
  nominativi_visura_camerale: null,
  soglia_frequenza_insolita: 10,
  conti_infragruppo_parte_correlata: null,
  soglia_da_investigare: 4,
  punteggio_profit_impact: 1,
  punteggio_oltre_dieci_volte_media: 1,
  punteggio_sopra_performance_materiality: 1,
  punteggio_importo_cifra_tonda: 1,
  punteggio_weekend: 1,
  punteggio_festivita: 4,
  punteggio_fuori_orario: 1,
  punteggio_backdated: 4,
  punteggio_staff_non_autorizzato: 4,
  punteggio_parte_correlata: 4,
  punteggio_descrizione_vuota: 4,
  punteggio_conto_insolito_raro: 4,
  punteggio_conto_infragruppo_parte_correlata: null,
  punteggio_conto_lunghezza: null,
  punteggio_cifre_ripetute: null,
  attivo_profit_impact: true,
  attivo_oltre_dieci_volte_media: true,
  attivo_sopra_performance_materiality: true,
  attivo_importo_cifra_tonda: true,
  attivo_weekend: true,
  attivo_festivita: true,
  attivo_fuori_orario: true,
  attivo_backdated: true,
  attivo_staff_non_autorizzato: true,
  attivo_parte_correlata: true,
  attivo_descrizione_vuota: true,
  attivo_conto_insolito_raro: false,
  attivo_conto_infragruppo_parte_correlata: false,
  attivo_conto_lunghezza: false,
  attivo_cifre_ripetute: false,
  attivo_finestra_chiusura: true,
};
const MAP_FIELDS = [
  "identificativo_registrazione",
  "numero_documento",
  "data_effettiva",
  "data_creazione",
  "ora_creazione",
  "conto_contabile",
  "importo_netto",
  "importo_dare",
  "importo_avere",
  "descrizione",
  "utente",
];
const FLAG_NAMES: Record<string, string> = {
  flag_profit_impact: "Impatto utile",
  flag_oltre_dieci_volte_media: ">10× media",
  flag_sopra_performance_materiality: "Oltre PM",
  flag_importo_cifra_tonda: "Cifra tonda",
  flag_weekend: "Weekend",
  flag_festivita: "Festività",
  flag_fuori_orario: "Fuori orario",
  flag_backdated: "Retrodatata",
  flag_finestra_chiusura: "Finestra di chiusura",
  flag_creata_dopo_chiusura: "Creata dopo chiusura",
  flag_staff_non_autorizzato: "Staff non autorizzato",
  flag_parte_correlata: "Parte correlata",
  flag_descrizione_vuota: "Descrizione vuota",
  flag_conto_insolito_raro: "Conto raro",
  flag_conto_infragruppo_parte_correlata: "Infragruppo",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-xs text-label-sm text-ink-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
function statusVariant(status: JetPractice["status"]) {
  return status === "analizzato"
    ? "success"
    : status === "bozza"
    ? "neutral"
    : "info";
}

export function JetDashboard() {
  const [practices, setPractices] = useState<JetPractice[]>([]);
  const [active, setActive] = useState<JetPractice | null>(null);
  const [create, setCreate] = useState({ client: "", period: "" });
  const [params, setParams] = useState<JetParams>(EMPTY);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<JetSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<JetSource | null>(null);
  const [profiles, setProfiles] = useState<ExtractionProfile[]>([]);
  const [txtInspection, setTxtInspection] = useState<
    Omit<FileInspection, "pratica"> | null
  >(null);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [profileName, setProfileName] = useState("");
  const [positions, setPositions] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [highlightField, setHighlightField] = useState("");
  const [results, setResults] = useState<JetResult[]>([]);
  const [filters, setFilters] = useState<ResultFilters>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [provaMode, setProvaMode] = useState(false);
  const [sourceHint, setSourceHint] = useState("");
  const refresh = async () => setPractices(await jetApi.list());
  useEffect(() => {
    refresh().catch((e) => setError(asUserError(e).title));
    jetApi.profiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);
  const loadSource = async (practiceId: string, source: JetSource) => {
    const x = await jetApi.sourcePreview(practiceId, source.id);
    setSelectedSource(source);
    setHeaders(x.intestazioni || []);
    setMapping(
      source.mappatura || suggestMapping(x.intestazioni || []),
    );
    setTxtInspection(x.intestazione === undefined ? null : x);
    setSelectedProfile(source.profilo_estrazione_id || x.profilo?.id || "");
    setPositions({});
    return x;
  };
  const reloadSources = async (practiceId: string, preferredId?: string) => {
    const next = await jetApi.sources(practiceId);
    setSources(next);
    const selected = next.find((x) => x.id === preferredId) || next.at(-1) ||
      null;
    if (selected) await loadSource(practiceId, selected);
    else {
      setSelectedSource(null);
      setHeaders([]);
      setTxtInspection(null);
    }
    return next;
  };
  const choose = async (p: JetPractice) => {
    setActive(p);
    setProvaMode(p.client === PROVA_CLIENT);
    setSourceHint("");
    const annoPeriodo = p.period.match(/\b(20\d{2})\b/)?.[1];
    setParams(
      p.parametri || {
        ...EMPTY,
        data_chiusura: `${annoPeriodo || new Date().getFullYear()}-12-31`,
      },
    );
    setResults([]);
    setError("");
    try {
      await reloadSources(p.id);
    } catch {
      setSources([]);
      setHeaders([]);
    }
  };
  const applyPresetTo = async (practice: JetPractice) => {
    const next = presetProva(EMPTY, practice.period);
    setParams(next);
    return jetApi.parameters(practice.id, next);
  };
  const run = async (action: () => Promise<JetPractice>) => {
    setBusy(true);
    setError("");
    try {
      const p = await action();
      setActive(p);
      await refresh();
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  const createPractice = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const p = await jetApi.create(create.client, create.period);
      setCreate({ client: "", period: "" });
      return p;
    });
  };
  const createProva = async () => {
    setBusy(true);
    setError("");
    try {
      const year = String(new Date().getFullYear());
      const created = await jetApi.create(PROVA_CLIENT, year);
      const saved = await applyPresetTo(created);
      setCreate({ client: "", period: "" });
      setProvaMode(true);
      await refresh();
      await choose(saved);
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  const fillPreset = async () => {
    if (!active) return;
    if (
      active.parametri &&
      !window.confirm("Sostituire i parametri salvati con il preset di prova?")
    ) return;
    await run(() => applyPresetTo(active));
    setProvaMode(true);
  };
  const fillProfiloProva = () => {
    const giaCompilato =
      profileName.trim() !== "" ||
      Object.values(positions).some((x) => x.start !== "" || x.end !== "");
    if (
      giaCompilato &&
      !window.confirm("Sostituire nome e posizioni già inseriti con i valori di prova?")
    ) return;
    setProfileName(PROFILO_PROVA_NOME);
    setPositions(
      Object.fromEntries(
        Object.entries(PROFILO_PROVA_POSIZIONI).map(([field, [start, end]]) => [
          field,
          { start: String(start), end: String(end) },
        ]),
      ),
    );
  };
  const saveParams = () => {
    if (active) run(() => jetApi.parameters(active.id, params));
  };
  const configureNewSource = async (
    practiceId: string,
    source: JetSource,
    preview: Awaited<ReturnType<typeof jetApi.sourcePreview>>,
  ) => {
    if (source.mappatura || source.profilo_estrazione_id) return source;
    const suggested = suggestMapping(preview.intestazioni || []);
    if (
      (source.formato === "xlsx" || !preview.intestazione) &&
      mappingIsReady(suggested)
    ) {
      const configured = await jetApi.sourceMapping(
        practiceId,
        source.id,
        suggested,
      );
      setSourceHint(
        "Mappatura applicata automaticamente dalle intestazioni. Controlla e correggi se serve.",
      );
      return configured;
    }
    if (provaMode && preview.profilo?.id) {
      const configured = await jetApi.sourceApplyProfile(
        practiceId,
        source.id,
        preview.profilo.id,
      );
      setSourceHint(
        `Profilo «${preview.profilo.nome}» applicato in automatico. Controlla se è quello giusto.`,
      );
      return configured;
    }
    if (Object.keys(suggested).length) {
      setMapping(suggested);
      setSourceHint(
        "Intestazioni riconosciute: conferma la mappatura o correggi le colonne.",
      );
    }
    return source;
  };
  const upload = async (files?: FileList | null) => {
    if (!files?.length || !active) return;
    setBusy(true);
    setError("");
    setSourceHint("");
    try {
      const x = await jetApi.uploadFiles(active.id, Array.from(files));
      setActive(x.pratica);
      setProfileName("");
      const last = x.files.at(-1);
      if (last) {
        await configureNewSource(active.id, last.fonte, last);
      }
      await reloadSources(active.id, last?.fonte.id);
      await refresh();
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  const refreshConfiguredSource = async (source: JetSource) => {
    if (!active) return;
    await reloadSources(active.id, source.id);
    const updated = (await jetApi.list()).find((x) => x.id === active.id);
    if (updated) setActive(updated);
    await refresh();
  };
  const applyProfile = async () => {
    if (!active || !selectedSource || !selectedProfile) return;
    setBusy(true);
    setError("");
    try {
      await refreshConfiguredSource(
        await jetApi.sourceApplyProfile(
          active.id,
          selectedSource.id,
          selectedProfile,
        ),
      );
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  const createProfile = async () => {
    if (!active || !selectedSource) return;
    const parsed = Object.fromEntries(
      Object.entries(positions).filter(([, x]) =>
        x.start !== "" && x.end !== ""
      ).map((
        [field, x],
      ) => [field, [Number(x.start), Number(x.end)] as [number, number]]),
    );
    setBusy(true);
    setError("");
    try {
      await refreshConfiguredSource(
        await jetApi.sourceCreateProfile(
          active.id,
          selectedSource.id,
          profileName,
          parsed,
        ),
      );
      setProfiles(await jetApi.profiles());
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  const loadResults = async (next = page, nextFilters = filters) => {
    if (!active) return;
    setBusy(true);
    try {
      const x = await jetApi.results(active.id, nextFilters, next);
      setResults(x.items);
      setPage(x.page);
      setPages(x.pages);
      setTotal(x.total);
    } catch (e) {
      setError(asUserError(e).title);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (active?.status === "analizzato") loadResults(1);
  }, [active?.id, active?.status]);
  const trueFlags = useMemo(
    () => (e: JetResult["esito"]) =>
      Object.entries(FLAG_NAMES).filter(([k]) => e[k] === true).map((
        [, label],
      ) => label),
    [],
  );
  const isProfileFile = selectedSource?.formato === "txt" ||
    selectedSource?.formato === "pdf";
  const allActiveSourcesReady = sources.some((x) => x.attiva) &&
    sources.filter((x) => x.attiva).every((x) => x.stato === "pronta");
  const highlightedHeader = useMemo(() => {
    const text = txtInspection?.intestazione || "";
    const range = positions[highlightField];
    if (!range || range.start === "" || range.end === "") return <>{text}</>;
    const start = Math.max(0, Number(range.start));
    const end = Math.min(text.length, Number(range.end));
    return (
      <>
        {text.slice(0, start)}
        <mark className="bg-status-yellow-bg text-status-yellow-text">
          {text.slice(start, end)}
        </mark>
        {text.slice(end)}
      </>
    );
  }, [txtInspection?.intestazione, positions, highlightField]);

  return (
    <div className="space-y-lg">
      <header>
        <h1 className="text-headline-lg text-ink-primary">
          JET — Journal Entry Testing
        </h1>
        <p className="mt-sm text-body-lg text-ink-secondary">
          Crea una pratica, configura i criteri ISA 240, carica il giornale
          Excel, TXT o PDF testuale e analizza i risultati. Per i test manuali
          usa il preset di prova: restano da caricare solo i libri giornale.
        </p>
      </header>
      {error && <Callout variant="warning">{error}</Callout>}
      <Card padding="lg">
        <CardHeader>Pratiche JET</CardHeader>
        <form
          onSubmit={createPractice}
          className="grid md:grid-cols-3 gap-md mb-sm"
        >
          <Field label="Cliente">
            <input
              required
              value={create.client}
              onChange={(e) => setCreate({ ...create, client: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Periodo">
            <input
              required
              value={create.period}
              onChange={(e) => setCreate({ ...create, period: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-sm self-end">
            <button disabled={busy} className={buttonClass}>
              <Icon name="add" size="sm" />Crea pratica
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={createProva}
              className={ghostButtonClass}
            >
              Crea pratica di prova
            </button>
          </div>
        </form>
        <p className="text-body-sm text-ink-tertiary mb-lg">
          La pratica di prova salva da sola Paese Italia, orario 8:00–18:00,
          chiusura 31/12, soglie e pesi. Staff e parole chiave sono fittizi:
          adattali al file se non vuoi che quasi ogni utente risulti non
          autorizzato.
        </p>
        <DataTable
          data={practices as (JetPractice & Record<string, unknown>)[]}
          getRowKey={(p) => p.id}
          onRowClick={choose}
          emptyMessage="Nessuna pratica JET."
          columns={[{ key: "client", header: "Cliente" }, {
            key: "period",
            header: "Periodo",
          }, {
            key: "status",
            header: "Stato",
            render: (p) => (
              <StatusBadge variant={statusVariant(p.status)}>
                {p.status.replaceAll("_", " ")}
              </StatusBadge>
            ),
          }, {
            key: "numero_registrazioni",
            header: "Righe",
            align: "right",
            render: (p) => p.numero_registrazioni.toLocaleString("it-IT"),
          }, {
            key: "numero_da_investigare",
            header: "Da investigare",
            align: "right",
          }]}
        />
      </Card>
      {active && (
        <>
          <Card padding="lg">
            <CardHeader
              trailing={
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={fillPreset}
                    className={ghostButtonClass}
                  >
                    Compila preset di prova
                  </button>
                  <StatusBadge variant={statusVariant(active.status)}>
                    {active.status.replaceAll("_", " ")}
                  </StatusBadge>
                </div>
              }
            >
              1. Parametri — {active.client}
            </CardHeader>
            <ParamsPanel
              key={active.id}
              params={params}
              setParams={setParams}
              busy={busy}
              onSave={saveParams}
            />
          </Card>
          <Card padding="lg">
            <CardHeader>2. Fonti e mappatura/profilo</CardHeader>
            <div className="space-y-md">
              {sourceHint && <Callout variant="info">{sourceHint}</Callout>}
              <Field label="Libri giornale (.xlsx, .txt o .pdf testuale)">
                <input
                  multiple
                  type="file"
                  accept=".xlsx,.txt,.pdf"
                  onChange={(e) => upload(e.target.files)}
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-sm">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`flex flex-wrap items-center gap-sm rounded border p-sm ${
                      selectedSource?.id === source.id
                        ? "border-ink-primary"
                        : "border-border-subtle"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => active && loadSource(active.id, source)}
                    >
                      <span className="block truncate text-label-md text-ink-primary">
                        {source.nome_originale}
                      </span>
                      <span className="text-body-sm text-ink-secondary">
                        {source.formato.toUpperCase()} ·{" "}
                        {source.numero_righe.toLocaleString("it-IT")} righe ·
                        {" "}
                        {source.stato.replaceAll("_", " ")}
                        {source.formato === "pdf" &&
                          source.numero_pagine_pdf !== null
                          ? ` · ${source.numero_pagine_pdf} pagine · ${
                            source.sequenza_pagine_completa === null
                              ? "numerazione non rilevabile"
                              : source.sequenza_pagine_completa
                              ? "numerazione completa"
                              : `numerazione incompleta${
                                source.pagine_mancanti?.length
                                  ? ` (mancano: ${source.pagine_mancanti.join(", ")})`
                                  : ""
                              }`
                          }`
                          : ""}
                      </span>
                    </button>
                    <label className="flex items-center gap-xs text-body-sm">
                      <input
                        type="checkbox"
                        checked={source.attiva}
                        onChange={async (event) => {
                          if (!active) return;
                          await refreshConfiguredSource(
                            await jetApi.configureSource(
                              active.id,
                              source.id,
                              event.target.checked,
                            ),
                          );
                        }}
                      />
                      Inclusa
                    </label>
                    <label className="cursor-pointer px-sm py-xs rounded border border-border-subtle text-label-sm">
                      Sostituisci
                      <input
                        className="sr-only"
                        type="file"
                        accept=".xlsx,.txt,.pdf"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!active || !file) return;
                          setBusy(true);
                          setSourceHint("");
                          try {
                            const preview = await jetApi.replaceSource(
                              active.id,
                              source.id,
                              file,
                            );
                            await configureNewSource(
                              active.id,
                              preview.fonte,
                              preview,
                            );
                            await reloadSources(active.id, source.id);
                            const updated = (await jetApi.list()).find((item) =>
                              item.id === active.id
                            );
                            if (updated) setActive(updated);
                          } catch (cause) {
                            setError(asUserError(cause).title);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="px-sm py-xs rounded border border-border-subtle text-label-sm"
                      onClick={async () => {
                        if (
                          !active ||
                          !window.confirm(`Eliminare ${source.nome_originale}?`)
                        ) return;
                        await jetApi.deleteSource(active.id, source.id);
                        await reloadSources(active.id);
                        const updated = (await jetApi.list()).find((item) =>
                          item.id === active.id
                        );
                        if (updated) setActive(updated);
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                ))}
              </div>
              <Field label="Gestione righe identiche tra fonti">
                <select
                  value={active.strategia_duplicati}
                  onChange={(event) =>
                    run(() =>
                      jetApi.duplicates(
                        active.id,
                        event.target
                          .value as JetPractice["strategia_duplicati"],
                      )
                    )}
                  className={inputClass}
                >
                  <option value="mantieni_tutti">
                    Mantieni tutte le righe
                  </option>
                  <option value="scarta_identiche">
                    Scarta duplicati identici
                  </option>
                </select>
              </Field>
              {!isProfileFile && headers.length > 0 && (
                <>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-md">
                    {MAP_FIELDS.map((field) => (
                      <Field key={field} label={field.replaceAll("_", " ")}>
                        <select
                          value={mapping[field] || ""}
                          onChange={(e) => {
                            const next = { ...mapping };
                            if (e.target.value) {
                              next[field] = e.target.value;
                            } else delete next[field];
                            setMapping(next);
                          }}
                          className={inputClass}
                        >
                          <option value="">Non mappato</option>
                          {headers.map((h) => <option key={h}>{h}</option>)}
                        </select>
                      </Field>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!selectedSource) return;
                      setBusy(true);
                      try {
                        await refreshConfiguredSource(
                          await jetApi.sourceMapping(
                            active.id,
                            selectedSource.id,
                            mapping,
                          ),
                        );
                      } catch (cause) {
                        setError(asUserError(cause).title);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={buttonClass}
                  >
                    Conferma mappatura
                  </button>
                </>
              )}
              {isProfileFile && txtInspection && (
                <div className="space-y-lg">
                  <div>
                    <p className="mb-xs text-label-sm text-ink-secondary">
                      Intestazione e righe di esempio · {txtInspection.codifica}
                    </p>
                    <pre className="overflow-x-auto rounded bg-tint-gray-bg p-md font-mono text-body-sm text-ink-primary"><code>{highlightedHeader}{txtInspection.righe_esempio?.map((line, index) => <span key={index}>{"\n"}{line}</span>)}</code></pre>
                  </div>
                  {txtInspection.profilo && (
                    <Callout variant="info">
                      Profilo riconosciuto:{" "}
                      <strong>{txtInspection.profilo.nome}</strong>, creato il
                      {" "}
                      {new Date(txtInspection.profilo.created_at)
                        .toLocaleString("it-IT")}.
                    </Callout>
                  )}
                  <div className="grid md:grid-cols-[1fr_auto] gap-md items-end">
                    <Field label="Profilo esistente">
                      <select
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Scegli un profilo</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      disabled={busy || !selectedProfile}
                      onClick={applyProfile}
                      className={buttonClass}
                    >
                      Conferma profilo
                    </button>
                  </div>
                  <div className="border-t border-border-muted pt-lg">
                    <div className="flex flex-wrap items-center justify-between gap-sm mb-md">
                      <h4 className="text-label-md text-ink-primary">
                        Crea un nuovo profilo
                      </h4>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={fillProfiloProva}
                        className={ghostButtonClass}
                      >
                        Compila posizioni di prova
                      </button>
                    </div>
                    <Field label="Nome profilo">
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-md mt-md">
                      {MAP_FIELDS.map((field) => (
                        <div
                          key={field}
                          onFocus={() => setHighlightField(field)}
                        >
                          <span className="block mb-xs text-label-sm text-ink-secondary">
                            {field.replaceAll("_", " ")}
                          </span>
                          <div className="grid grid-cols-2 gap-sm">
                            <input
                              aria-label={`${field} inizio`}
                              type="number"
                              min="0"
                              placeholder="Inizio"
                              value={positions[field]?.start || ""}
                              onChange={(e) =>
                                setPositions({
                                  ...positions,
                                  [field]: {
                                    start: e.target.value,
                                    end: positions[field]?.end || "",
                                  },
                                })}
                              className={inputClass}
                            />
                            <input
                              aria-label={`${field} fine`}
                              type="number"
                              min="1"
                              placeholder="Fine esclusiva"
                              value={positions[field]?.end || ""}
                              onChange={(e) =>
                                setPositions({
                                  ...positions,
                                  [field]: {
                                    start: positions[field]?.start || "",
                                    end: e.target.value,
                                  },
                                })}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy || !profileName.trim()}
                      onClick={createProfile}
                      className={`${buttonClass} mt-md`}
                    >
                      Salva e applica profilo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
          <Card padding="lg">
            <CardHeader>3. Analisi</CardHeader>
            <div className="flex flex-wrap items-center gap-md">
              <button
                disabled={busy || !active.parametri || !allActiveSourcesReady}
                onClick={() => run(() => jetApi.analyze(active.id))}
                className={buttonClass}
              >
                <Icon name="analytics" size="sm" />
                {busy
                  ? "Elaborazione…"
                  : active.status === "analizzato"
                  ? "Rilancia analisi"
                  : "Avvia analisi"}
              </button>
              {active.status === "analizzato" && (
                <span className="text-body-md text-ink-secondary">
                  {active.numero_registrazioni.toLocaleString("it-IT")} righe ·
                  {" "}
                  {active.numero_da_investigare.toLocaleString("it-IT")}{" "}
                  da investigare · media registrazione:{" "}
                  {active.valore_medio_registrazione_effettivo === null
                    ? "—"
                    : `€${Number(active.valore_medio_registrazione_effettivo).toLocaleString(
                      "it-IT",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}`}
                </span>
              )}
            </div>
          </Card>
          {active.status === "analizzato" && (
            <Card padding="none">
              <div className="p-base">
                <CardHeader
                  trailing={
                    <a
                      href={jetApi.exportUrl(active.id, filters)}
                      className={buttonClass}
                    >
                      <Icon name="download" size="sm" />Esporta Excel
                    </a>
                  }
                >
                  4. Risultati
                </CardHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadResults(1);
                  }}
                  className="grid md:grid-cols-4 gap-md"
                >
                  <Field label="Da investigare">
                    <select
                      value={filters.da_investigare === undefined
                        ? ""
                        : String(filters.da_investigare)}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          da_investigare: e.target.value === ""
                            ? undefined
                            : e.target.value === "true",
                        })}
                      className={inputClass}
                    >
                      <option value="">Tutte</option>
                      <option value="true">Sì</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <Field label="Conto">
                    <input
                      value={filters.conto_contabile || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          conto_contabile: e.target.value || undefined,
                        })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Punteggio minimo">
                    <input
                      type="number"
                      min="0"
                      value={filters.punteggio_minimo ?? ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          punteggio_minimo: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })}
                      className={inputClass}
                    />
                  </Field>
                  <button className={`${buttonClass} self-end`}>
                    Applica filtri
                  </button>
                </form>
              </div>
              <DataTable
                data={results}
                getRowKey={(x) => x.riga.identificativo_registrazione}
                columns={[{
                  key: "id",
                  header: "Registrazione",
                  render: (x) => x.riga.identificativo_registrazione,
                }, {
                  key: "date",
                  header: "Data",
                  render: (x) => x.riga.data_effettiva,
                }, {
                  key: "account",
                  header: "Conto",
                  render: (x) => x.riga.conto_contabile || "—",
                }, {
                  key: "amount",
                  header: "Importo",
                  align: "right",
                  render: (x) => x.riga.importo_netto,
                }, {
                  key: "score",
                  header: "Punti",
                  align: "right",
                  render: (x) => x.esito.punteggio_totale,
                }, {
                  key: "investigate",
                  header: "Esito",
                  render: (x) => (
                    <StatusBadge
                      variant={x.esito.da_investigare ? "warning" : "neutral"}
                    >
                      {x.esito.da_investigare ? "Investigare" : "No"}
                    </StatusBadge>
                  ),
                }, {
                  key: "flags",
                  header: "Criteri scattati",
                  render: (x) => (
                    <div className="flex flex-wrap gap-xs">
                      {trueFlags(x.esito).map((f) => (
                        <span
                          key={f}
                          className="px-xs rounded bg-status-yellow-bg text-status-yellow-text text-label-sm"
                        >
                          {f}
                        </span>
                      ))}
                      {Object.entries(FLAG_NAMES).some(([k]) =>
                        x.esito[k] === null
                      ) && (
                        <span className="px-xs rounded bg-tint-gray-bg text-tint-gray-text text-label-sm">
                          Alcuni non calcolabili
                        </span>
                      )}
                    </div>
                  ),
                }]}
              />
              <div className="flex items-center justify-between p-base border-t border-border-muted">
                <span className="text-body-sm text-ink-secondary">
                  {total.toLocaleString("it-IT")} risultati · pagina {page} di
                  {" "}
                  {pages || 1}
                </span>
                <div className="flex gap-sm">
                  <button
                    disabled={page <= 1 || busy}
                    onClick={() => loadResults(page - 1)}
                    className="px-md py-sm rounded border border-border-subtle disabled:opacity-40"
                  >
                    Precedente
                  </button>
                  <button
                    disabled={page >= pages || busy}
                    onClick={() => loadResults(page + 1)}
                    className="px-md py-sm rounded border border-border-subtle disabled:opacity-40"
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
