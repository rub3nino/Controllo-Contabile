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
  DataTable,
  Icon,
  StatusBadge,
} from "../components";
import { PageHeader, PrimaryButton, ToolButton, GhostButton } from "../shell/PageHeader";
import {
  countActiveControls,
  EMPTY_JET_PARAMS,
  ParamsPanel,
} from "./ParamsPanel";
import {
  JetMetric,
  JetSection,
  jetGhostClass,
  jetInputClass,
  jetPrimaryClass,
} from "./NotionChrome";
import { SourcePanel } from "./SourcePanel";
import { JetMappingDrawer } from "./JetMappingDrawer";
import {
  mappingIsReady,
  presetProva,
  PROFILO_PROVA_NOME,
  PROFILO_PROVA_POSIZIONI,
  PROVA_CLIENT,
  suggestMapping,
} from "./presetProva";
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

const inputClass = jetInputClass;
const buttonClass = jetPrimaryClass;

const FLAG_NAMES: Record<string, string> = {
  flag_profit_impact: "Impatto utile",
  flag_oltre_dieci_volte_media: ">10× media",
  flag_sopra_performance_materiality: "Oltre PM",
  flag_importo_cifra_tonda: "Cifra tonda",
  flag_weekend: "Weekend",
  flag_festivita: "Festività",
  flag_fuori_orario: "Fuori orario",
  flag_backdated: "Retrodatata",
  flag_forward_dating: "Anticipata",
  flag_staff_non_autorizzato: "Staff non autorizzato",
  flag_parte_correlata: "Parte correlata",
  flag_descrizione_vuota: "Descrizione vuota",
  flag_conto_insolito_raro: "Conto raro",
  flag_conto_infragruppo_parte_correlata: "Infragruppo",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1 text-xs text-[#787774]">
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
  const [params, setParams] = useState<JetParams>(EMPTY_JET_PARAMS);
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
  const [showCreate, setShowCreate] = useState(false);
  const [provaMode, setProvaMode] = useState(false);
  const [sourceHint, setSourceHint] = useState("");
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  const refresh = async () => setPractices(await jetApi.list());
  useEffect(() => {
    refresh().catch((e) => setError(asUserError(e).title));
    jetApi.profiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);
  const loadSource = async (practiceId: string, source: JetSource) => {
    const x = await jetApi.sourcePreview(practiceId, source.id);
    setSelectedSource(source);
    setHeaders(x.intestazioni || []);
    setMapping(source.mappatura || suggestMapping(x.intestazioni || []));
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
    setShowCreate(false);
    setProvaMode(p.client === PROVA_CLIENT);
    setSourceHint("");
    setMapPanelOpen(false);
    setParams(p.parametri || EMPTY_JET_PARAMS);
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
    const next = presetProva(EMPTY_JET_PARAMS, practice.period);
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
      setShowCreate(false);
      setParams(EMPTY_JET_PARAMS);
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
      setShowCreate(false);
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
      !window.confirm(
        "Sostituire nome e posizioni già inseriti con i valori di prova?",
      )
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
      (source.formato === "xlsx" || source.formato === "csv" ||
        !preview.intestazione) &&
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
  const upload = async (files?: FileList | File[] | null) => {
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
      setMapPanelOpen(true);
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
    if (!active || !selectedSource || !selectedProfile) return false;
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
      return true;
    } catch (e) {
      setError(asUserError(e).title);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const createProfile = async () => {
    if (!active || !selectedSource) return false;
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
      return true;
    } catch (e) {
      setError(asUserError(e).title);
      return false;
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
        <mark className="bg-[#fef7e0] text-[#9f6b00]">
          {text.slice(start, end)}
        </mark>
        {text.slice(end)}
      </>
    );
  }, [txtInspection?.intestazione, positions, highlightField]);

  const attivi = countActiveControls(params);
  const fontiAttive = sources.filter((s) => s.attiva).length;
  const investigateTone =
    active && active.numero_da_investigare > 0 ? "alert" : "default";

  if (!active) {
    return (
      <div className="flex flex-col gap-6 min-w-0 w-full pb-8">
        <PageHeader
          variant="page"
          icon="account_balance"
          iconAccent="blue"
          tags={[
            { label: "ISA Italia 240", tone: "blue" },
            { label: "JET", tone: "yellow" },
          ]}
          title="JET — Journal Entry Testing"
          meta={
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e7f3f8] text-[#337ea9] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              {practices.length} pratiche
            </span>
          }
          toolbar={
            <>
              <ToolButton icon="add" onClick={() => setShowCreate((v) => !v)}>
                {showCreate ? "Chiudi form" : "Nuova pratica"}
              </ToolButton>
              <ToolButton icon="science" onClick={() => void createProva()}>
                Crea pratica di prova
              </ToolButton>
            </>
          }
        />
        {error && <Callout variant="warning">{error}</Callout>}
        {showCreate && (
          <JetSection icon="add" title="Nuova pratica" accent="blue" padded>
            <form onSubmit={createPractice} className="grid md:grid-cols-3 gap-3">
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
              <div className="flex flex-wrap gap-2 self-end">
                <button disabled={busy} className={buttonClass}>
                  <Icon name="add" size="sm" />Crea pratica
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createProva()}
                  className={jetGhostClass}
                >
                  Crea pratica di prova
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs text-[#9b9a97] leading-5">
              La pratica di prova è tarata sul CSV Data/Descrizione/Conto/Entrate/Uscite:
              Italia, PM 15.000, utile 100.000. Non ci sono utente né orario in quel
              file: staff, orario e retrodatazione restano spenti.
            </p>
          </JetSection>
        )}
        <JetSection
          icon="table_chart"
          title="Pratiche JET"
          hint="Apri un incarico per KPI, fonti, matrice e risultati"
          accent="blue"
        >
          <DataTable
            variant="notion"
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
        </JetSection>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-w-0 w-full pb-8">
      <PageHeader
        variant="page"
        icon="account_balance"
        iconAccent="blue"
        tags={[
          { label: "ISA Italia 240", tone: "blue" },
          { label: active.period, tone: "gray" },
        ]}
        title={`${active.client} — Journal Entry Testing`}
        meta={
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fbf3db] text-[#9f6b00] font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  active.status === "analizzato" ? "bg-emerald-600" : "bg-amber-600"
                }`}
              />
              {active.status.replaceAll("_", " ")}
            </span>
            <span className="text-[#c8c7c3]">·</span>
            <span>
              Fonti:{" "}
              <strong className="text-[#37352f]">{fontiAttive}</strong>
            </span>
            <span className="text-[#c8c7c3]">·</span>
            <span>
              Libro giornale:{" "}
              <strong className="text-[#37352f]">
                {active.numero_registrazioni.toLocaleString("it-IT")} righe
              </strong>
            </span>
          </>
        }
        toolbar={
          <>
            <GhostButton icon="arrow_back" onClick={() => setActive(null)}>
              Pratiche
            </GhostButton>
            <GhostButton icon="science" onClick={() => void fillPreset()}>
              Compila preset di prova
            </GhostButton>
          </>
        }
        primaryAction={
          <PrimaryButton
            icon="analytics"
            disabled={busy || !allActiveSourcesReady}
            onClick={() =>
              void run(async () => {
                if (!active.parametri) {
                  await jetApi.parameters(active.id, params);
                }
                return jetApi.analyze(active.id);
              })
            }
            title={
              !allActiveSourcesReady
                ? "Carica e conferma almeno una fonte"
                : undefined
            }
          >
            {busy
              ? "Elaborazione…"
              : active.status === "analizzato"
              ? "Rilancia analisi"
              : "Avvia analisi"}
          </PrimaryButton>
        }
      />
      {error && <Callout variant="warning">{error}</Callout>}
      {sourceHint && <Callout variant="info">{sourceHint}</Callout>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <JetMetric
          icon="table_rows"
          label="Popolazione"
          tone={active.numero_registrazioni > 0 ? "ok" : "default"}
          value={active.numero_registrazioni.toLocaleString("it-IT")}
          hint={
            active.status === "analizzato"
              ? "Registrazioni analizzate"
              : "Dopo l’analisi"
          }
        />
        <JetMetric
          icon="warning"
          label="Scritture sospette"
          tone={investigateTone}
          value={active.numero_da_investigare.toLocaleString("it-IT")}
          hint="Punteggio sopra soglia"
        />
        <JetMetric
          icon="fact_check"
          label="Controlli attivi"
          tone="info"
          value={`${attivi} / 15`}
          hint="Parametri salvati sul profilo"
        />
        <JetMetric
          icon="source"
          label="Fonti attive"
          tone={fontiAttive ? "ok" : "pending"}
          value={fontiAttive || "—"}
          hint={allActiveSourcesReady ? "Pronte per l’analisi" : "Da configurare"}
        />
      </div>
      <SourcePanel
        practice={active}
        sources={sources}
        selectedSource={selectedSource}
        busy={busy}
        onUpload={upload}
        onSelectSource={(source) => {
          void loadSource(active.id, source).then(() => setMapPanelOpen(true));
        }}
        onToggleActive={async (source, attiva) => {
          await refreshConfiguredSource(
            await jetApi.configureSource(active.id, source.id, attiva),
          );
        }}
        onReplace={async (source, file) => {
          setBusy(true);
          setSourceHint("");
          try {
            const preview = await jetApi.replaceSource(active.id, source.id, file);
            await configureNewSource(active.id, preview.fonte, preview);
            await reloadSources(active.id, source.id);
            const updated = (await jetApi.list()).find((item) => item.id === active.id);
            if (updated) setActive(updated);
            setMapPanelOpen(true);
          } catch (cause) {
            setError(asUserError(cause).title);
          } finally {
            setBusy(false);
          }
        }}
        onDelete={async (source) => {
          if (!window.confirm(`Eliminare ${source.nome_originale}?`)) return;
          await jetApi.deleteSource(active.id, source.id);
          await reloadSources(active.id);
          const updated = (await jetApi.list()).find((item) => item.id === active.id);
          if (updated) setActive(updated);
          setMapPanelOpen(false);
        }}
        onDuplicates={(value) =>
          run(() => jetApi.duplicates(active.id, value))
        }
        onOpenMapping={() => setMapPanelOpen(true)}
      />
      <ParamsPanel
        client={active.client}
        params={params}
        setParams={setParams}
        busy={busy}
        onSave={saveParams}
      />
      <JetSection
        icon="analytics"
        title="Analisi"
            accent="purple"
            hint={
              allActiveSourcesReady
                ? "Fonti pronte"
                : "Carica e conferma almeno una fonte"
            }
            padded
          >
            <p className="text-xs text-[#787774]">
              {active.status === "analizzato"
                ? `${active.numero_registrazioni.toLocaleString("it-IT")} righe · ${active.numero_da_investigare.toLocaleString("it-IT")} da investigare · media registrazione: ${
                  active.valore_medio_registrazione_effettivo === null
                    ? "—"
                    : `€${Number(active.valore_medio_registrazione_effettivo).toLocaleString(
                      "it-IT",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}`
                }`
                : "Il comando «Avvia analisi» è nella barra della pagina. Resta disattivato finché non c’è almeno una fonte inclusa e pronta."}
            </p>
          </JetSection>
          {active.status === "analizzato" && (
            <JetSection
              icon="table_chart"
              title="Righe sospette"
              accent="yellow"
              hint={`${total.toLocaleString("it-IT")} righe`}
              trailing={
                <a href={jetApi.exportUrl(active.id, filters)} className={jetGhostClass}>
                  <Icon name="download" size="sm" className="text-[#787774]" />
                  Esporta Excel
                </a>
              }
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadResults(1);
                }}
                className="grid md:grid-cols-4 gap-3 p-4 border-b border-[#e9e8e4] bg-[#faf9f7]"
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
              <DataTable
                variant="notion"
                data={results as (JetResult & Record<string, unknown>)[]}
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
                    <div className="flex flex-wrap gap-1">
                      {trueFlags(x.esito).map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded bg-[#fef7e0] text-[#b06000] text-[11px]"
                        >
                          {f}
                        </span>
                      ))}
                      {Object.entries(FLAG_NAMES).some(([k]) =>
                        x.esito[k] === null
                      ) && (
                        <span className="px-1.5 py-0.5 rounded bg-[#f1f1ef] text-[#787774] text-[11px]">
                          Alcuni non calcolabili
                        </span>
                      )}
                    </div>
                  ),
                }]}
              />
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e9e8e4] bg-[#faf9f7]">
                <span className="text-xs text-[#787774]">
                  {total.toLocaleString("it-IT")} risultati · pagina {page} di
                  {" "}
                  {pages || 1}
                </span>
                <div className="flex gap-1.5">
                  <button
                    disabled={page <= 1 || busy}
                    onClick={() => loadResults(page - 1)}
                    className={`${jetGhostClass} disabled:opacity-40`}
                  >
                    Precedente
                  </button>
                  <button
                    disabled={page >= pages || busy}
                    onClick={() => loadResults(page + 1)}
                    className={`${jetGhostClass} disabled:opacity-40`}
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </JetSection>
          )}
      <JetMappingDrawer
        open={mapPanelOpen}
        onClose={() => setMapPanelOpen(false)}
        busy={busy}
        source={selectedSource}
        isProfileFile={isProfileFile}
        headers={headers}
        mapping={mapping}
        onMappingChange={setMapping}
        onConfirmMapping={async () => {
          if (!active || !selectedSource) return;
          setBusy(true);
          try {
            await refreshConfiguredSource(
              await jetApi.sourceMapping(
                active.id,
                selectedSource.id,
                mapping,
              ),
            );
            setMapPanelOpen(false);
          } catch (cause) {
            setError(asUserError(cause).title);
          } finally {
            setBusy(false);
          }
        }}
        txtInspection={txtInspection}
        highlightedHeader={highlightedHeader}
        profiles={profiles}
        selectedProfile={selectedProfile}
        onSelectedProfile={setSelectedProfile}
        onApplyProfile={async () => {
          if (await applyProfile()) setMapPanelOpen(false);
        }}
        profileName={profileName}
        onProfileName={setProfileName}
        positions={positions}
        onPositions={setPositions}
        highlightField={highlightField}
        onHighlightField={setHighlightField}
        onCreateProfile={async () => {
          if (await createProfile()) setMapPanelOpen(false);
        }}
        onFillProva={fillProfiloProva}
      />
    </div>
  );
}
