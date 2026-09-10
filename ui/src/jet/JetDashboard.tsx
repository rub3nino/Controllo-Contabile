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
    setShowCreate(false);
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
  const saveParams = () => {
    if (active) run(() => jetApi.parameters(active.id, params));
  };
  const upload = async (files?: FileList | File[] | null) => {
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
            <ToolButton icon="add" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Chiudi form" : "Nuova pratica"}
            </ToolButton>
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
              <button disabled={busy} className={`${buttonClass} self-end`}>
                <Icon name="add" size="sm" />Crea pratica
              </button>
            </form>
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
          <GhostButton icon="arrow_back" onClick={() => setActive(null)}>
            Pratiche
          </GhostButton>
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
        headers={headers}
        mapping={mapping}
        setMapping={setMapping}
        profiles={profiles}
        txtInspection={txtInspection}
        selectedProfile={selectedProfile}
        setSelectedProfile={setSelectedProfile}
        profileName={profileName}
        setProfileName={setProfileName}
        positions={positions}
        setPositions={setPositions}
        setHighlightField={setHighlightField}
        highlightedHeader={highlightedHeader}
        onUpload={upload}
        onSelectSource={(source) => void loadSource(active.id, source)}
        onToggleActive={async (source, attiva) => {
          await refreshConfiguredSource(
            await jetApi.configureSource(active.id, source.id, attiva),
          );
        }}
        onReplace={async (source, file) => {
          setBusy(true);
          try {
            await jetApi.replaceSource(active.id, source.id, file);
            await reloadSources(active.id, source.id);
            const updated = (await jetApi.list()).find((item) => item.id === active.id);
            if (updated) setActive(updated);
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
        }}
        onDuplicates={(value) =>
          run(() => jetApi.duplicates(active.id, value))
        }
        onConfirmMapping={async () => {
          if (!selectedSource) return;
          setBusy(true);
          try {
            await refreshConfiguredSource(
              await jetApi.sourceMapping(active.id, selectedSource.id, mapping),
            );
          } catch (cause) {
            setError(asUserError(cause).title);
          } finally {
            setBusy(false);
          }
        }}
        onApplyProfile={applyProfile}
        onCreateProfile={createProfile}
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
    </div>
  );
}
