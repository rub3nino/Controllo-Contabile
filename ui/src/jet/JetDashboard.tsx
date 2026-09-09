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

const inputClass =
  "w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary";
const buttonClass =
  "inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed";

const EMPTY: JetParams = {
  materialita_bilancio: null,
  performance_materiality: null,
  utile_netto_dopo_imposte: null,
  valore_medio_registrazione: null,
  orario_ufficio_inizio: null,
  orario_ufficio_fine: null,
  giorni_weekend: null,
  soglia_backdating_giorni: null,
  festivita: null,
  staff_autorizzato: null,
  utenti_di_sistema: null,
  parole_chiave_parti_correlate: null,
  soglia_frequenza_insolita: null,
  conti_infragruppo_parte_correlata: null,
  soglia_da_investigare: 4,
  punteggio_profit_impact: 1,
  punteggio_oltre_dieci_volte_media: 1,
  punteggio_sopra_performance_materiality: 1,
  punteggio_importo_cifra_tonda: 1,
  punteggio_weekend: 1,
  punteggio_festivita: 1,
  punteggio_fuori_orario: 1,
  punteggio_backdated: 1,
  punteggio_staff_non_autorizzato: 1,
  punteggio_parte_correlata: 1,
  punteggio_descrizione_vuota: 1,
  punteggio_conto_insolito_raro: null,
  punteggio_conto_infragruppo_parte_correlata: null,
};
const OPTIONAL_NUMBERS: [keyof JetParams, string][] = [
  ["materialita_bilancio", "Materialità di bilancio"],
  ["performance_materiality", "Performance materiality"],
  ["utile_netto_dopo_imposte", "Utile netto dopo imposte"],
  ["valore_medio_registrazione", "Valore medio registrazione"],
  ["soglia_backdating_giorni", "Soglia retrodatazione (giorni)"],
  ["soglia_frequenza_insolita", "Soglia frequenza conto insolito"],
];
const WEIGHTS: [keyof JetParams, string, boolean?][] = [
  ["punteggio_profit_impact", "Impatto sull’utile"],
  ["punteggio_oltre_dieci_volte_media", "Oltre 10× media"],
  ["punteggio_sopra_performance_materiality", "Oltre performance materiality"],
  ["punteggio_importo_cifra_tonda", "Cifra tonda"],
  ["punteggio_weekend", "Weekend"],
  ["punteggio_festivita", "Festività"],
  ["punteggio_fuori_orario", "Fuori orario"],
  ["punteggio_backdated", "Retrodatata"],
  ["punteggio_staff_non_autorizzato", "Staff non autorizzato"],
  ["punteggio_parte_correlata", "Parte correlata"],
  ["punteggio_descrizione_vuota", "Descrizione vuota"],
  ["punteggio_conto_insolito_raro", "Conto insolito/raro", true],
  ["punteggio_conto_infragruppo_parte_correlata", "Conto infragruppo", true],
];
const LISTS: [keyof JetParams, string, "text" | "date" | "number"][] = [
  ["giorni_weekend", "Giorni weekend (0=lunedì, 6=domenica)", "number"],
  ["festivita", "Festività", "date"],
  ["staff_autorizzato", "Staff autorizzato", "text"],
  ["utenti_di_sistema", "Utenti di sistema", "text"],
  ["parole_chiave_parti_correlate", "Parole chiave parti correlate", "text"],
  [
    "conti_infragruppo_parte_correlata",
    "Conti infragruppo / parti correlate",
    "text",
  ],
];
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

function ListInput(
  { label, values, type, onChange }: {
    label: string;
    values: (string | number)[] | null;
    type: string;
    onChange: (x: (string | number)[] | null) => void;
  },
) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    const value = type === "number" ? Number(draft) : draft.trim();
    onChange([...(values || []), value]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex gap-sm">
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="px-md rounded border border-border-subtle"
        >
          Aggiungi
        </button>
      </div>
      <div className="flex flex-wrap gap-xs mt-xs">
        {values?.map((v, i) => (
          <button
            type="button"
            key={`${v}-${i}`}
            onClick={() => {
              const next = values.filter((_, x) => x !== i);
              onChange(next.length ? next : null);
            }}
            className="px-sm py-xxs rounded bg-tint-gray-bg text-label-sm text-tint-gray-text"
          >
            {v} ×
          </button>
        ))}
        {values === null && (
          <span className="text-body-sm text-ink-tertiary">Non impostato</span>
        )}
      </div>
    </Field>
  );
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
  const refresh = async () => setPractices(await jetApi.list());
  useEffect(() => {
    refresh().catch((e) => setError(asUserError(e).title));
    jetApi.profiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);
  const loadSource = async (practiceId: string, source: JetSource) => {
    const x = await jetApi.sourcePreview(practiceId, source.id);
    setSelectedSource(source);
    setHeaders(x.intestazioni || []);
    setMapping(source.mappatura || {});
    setTxtInspection(x.intestazione === undefined ? null : x);
    setSelectedProfile(source.profilo_estrazione_id || x.profilo?.id || "");
    setPositions({});
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
    setParams(p.parametri || EMPTY);
    setResults([]);
    setError("");
    try {
      await reloadSources(p.id);
    } catch {
      setSources([]);
      setHeaders([]);
    }
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
  const saveParams = (e: FormEvent) => {
    e.preventDefault();
    if (active) run(() => jetApi.parameters(active.id, params));
  };
  const upload = async (files?: FileList | null) => {
    if (!files?.length || !active) return;
    setBusy(true);
    setError("");
    try {
      const x = await jetApi.uploadFiles(active.id, Array.from(files));
      setActive(x.pratica);
      setProfileName("");
      await reloadSources(active.id, x.files.at(-1)?.fonte.id);
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
          Excel, TXT o PDF testuale e analizza i risultati.
        </p>
      </header>
      {error && <Callout variant="warning">{error}</Callout>}
      <Card padding="lg">
        <CardHeader>Pratiche JET</CardHeader>
        <form
          onSubmit={createPractice}
          className="grid md:grid-cols-3 gap-md mb-lg"
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
          <button disabled={busy} className={`${buttonClass} self-end`}>
            <Icon name="add" size="sm" />Crea pratica
          </button>
        </form>
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
                <StatusBadge variant={statusVariant(active.status)}>
                  {active.status.replaceAll("_", " ")}
                </StatusBadge>
              }
            >
              1. Parametri — {active.client}
            </CardHeader>
            <form onSubmit={saveParams} className="space-y-lg">
              <div className="grid md:grid-cols-3 gap-md">
                {OPTIONAL_NUMBERS.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      step="any"
                      value={(params[key] as number | null) ?? ""}
                      placeholder="Non impostato"
                      onChange={(e) =>
                        setParams({
                          ...params,
                          [key]: e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        })}
                      className={inputClass}
                    />
                  </Field>
                ))}
                <Field label="Orario ufficio — inizio">
                  <input
                    type="time"
                    value={params.orario_ufficio_inizio || ""}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        orario_ufficio_inizio: e.target.value || null,
                      })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Orario ufficio — fine">
                  <input
                    type="time"
                    value={params.orario_ufficio_fine || ""}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        orario_ufficio_fine: e.target.value || null,
                      })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-md">
                {LISTS.map(([key, label, type]) => (
                  <ListInput
                    key={key}
                    label={label}
                    type={type}
                    values={params[key] as (string | number)[] | null}
                    onChange={(v) => setParams({ ...params, [key]: v })}
                  />
                ))}
              </div>
              <div>
                <h4 className="text-label-md text-ink-primary mb-md">
                  Pesi dei criteri e soglia
                </h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-md">
                  {WEIGHTS.map(([key, label, optional]) => (
                    <Field
                      key={key}
                      label={`${label}${optional ? " (opzionale)" : ""}`}
                    >
                      <input
                        required={!optional}
                        min="0"
                        type="number"
                        value={(params[key] as number | null) ?? ""}
                        placeholder="Non impostato"
                        onChange={(e) =>
                          setParams({
                            ...params,
                            [key]: e.target.value === "" && optional
                              ? null
                              : Number(e.target.value),
                          })}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                  <Field label="Soglia da investigare">
                    <input
                      required
                      min="0"
                      type="number"
                      value={params.soglia_da_investigare}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          soglia_da_investigare: Number(e.target.value),
                        })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
              <button disabled={busy} className={buttonClass}>
                Salva tutti i parametri
              </button>
            </form>
          </Card>
          <Card padding="lg">
            <CardHeader>2. Fonti e mappatura/profilo</CardHeader>
            <div className="space-y-md">
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
                          try {
                            await jetApi.replaceSource(
                              active.id,
                              source.id,
                              file,
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
                    <h4 className="mb-md text-label-md text-ink-primary">
                      Crea un nuovo profilo
                    </h4>
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
                  da investigare
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
