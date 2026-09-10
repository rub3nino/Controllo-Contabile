/**
 * I 15 controlli JET: ogni voce ha nome, stato, toggle e i campi da compilare.
 * Toggle spento: criterio non applicato (dato assente e/o peso 0).
 */

import { type FormEvent, type ReactNode, useState } from "react";
import { NotionTag, StatusBadge, Switch } from "../components";
import type { JetParams } from "./api";
import { JetSection, jetInputClass, jetPrimaryClass } from "./NotionChrome";

const inputClass = jetInputClass;

export const EMPTY_JET_PARAMS: JetParams = {
  materialita_bilancio: null,
  performance_materiality: null,
  utile_netto_dopo_imposte: null,
  valore_medio_registrazione: null,
  paese: null,
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
  punteggio_profit_impact: 0,
  punteggio_oltre_dieci_volte_media: 0,
  punteggio_sopra_performance_materiality: 0,
  punteggio_importo_cifra_tonda: 1,
  soglia_importo_cifra_tonda: null,
  punteggio_weekend: 0,
  punteggio_festivita: 0,
  punteggio_fuori_orario: 0,
  punteggio_backdated: 0,
  punteggio_staff_non_autorizzato: 0,
  punteggio_parte_correlata: 0,
  punteggio_descrizione_vuota: 4,
  punteggio_conto_insolito_raro: null,
  punteggio_conto_infragruppo_parte_correlata: null,
};

type ControlStatus = "presente" | "parziale" | "assente";

type ControlDef = {
  n: number;
  title: string;
  status: ControlStatus;
  baker: string;
  hint: string;
  available: boolean;
  isOn: (p: JetParams) => boolean;
  turnOn: (p: JetParams) => JetParams;
  turnOff: (p: JetParams) => JetParams;
};

const WEEKEND_DAYS = [
  { n: 5, label: "Sabato" },
  { n: 6, label: "Domenica" },
  { n: 0, label: "Lunedì" },
  { n: 1, label: "Martedì" },
  { n: 2, label: "Mercoledì" },
  { n: 3, label: "Giovedì" },
  { n: 4, label: "Venerdì" },
];

const CONTROLS: ControlDef[] = [
  {
    n: 1,
    title: "Impatto superiore al 10% dell’utile netto",
    status: "presente",
    baker: "Profit impact = 1",
    hint: "Confronte |importo| con il 10% di |utile netto dopo imposte|. Senza utile il criterio resta non calcolabile.",
    available: true,
    isOn: (p) => p.punteggio_profit_impact > 0,
    turnOn: (p) => ({ ...p, punteggio_profit_impact: 1 }),
    turnOff: (p) => ({ ...p, utile_netto_dopo_imposte: null, punteggio_profit_impact: 0 }),
  },
  {
    n: 2,
    title: "Importi superiori a 10 volte la media",
    status: "parziale",
    baker: ">10x average journal size = 1",
    hint: "La media dovrebbe uscire dal giornale caricato. Oggi si può ancora inserire a mano come ponte.",
    available: true,
    isOn: (p) => p.punteggio_oltre_dieci_volte_media > 0,
    turnOn: (p) => ({ ...p, punteggio_oltre_dieci_volte_media: 1 }),
    turnOff: (p) => ({
      ...p,
      valore_medio_registrazione: null,
      punteggio_oltre_dieci_volte_media: 0,
    }),
  },
  {
    n: 3,
    title: "Superamento della materialità (Global Focus)",
    status: "parziale",
    baker: "Above performance materiality = 1",
    hint: "Il motore usa la performance materiality. La materialità di bilancio è solo di riconciliazione, non alimenta il test.",
    available: true,
    isOn: (p) => p.punteggio_sopra_performance_materiality > 0,
    turnOn: (p) => ({ ...p, punteggio_sopra_performance_materiality: 1 }),
    turnOff: (p) => ({
      ...p,
      performance_materiality: null,
      punteggio_sopra_performance_materiality: 0,
    }),
  },
  {
    n: 4,
    title: "Cifre tonde (multipli di 10.000 / 100.000)",
    status: "parziale",
    baker: "Round sum amount = 1",
    hint: "Il motore oggi segnala gli importi divisibili per 10. Le soglie 10k/100k sono il target, non ancora nel calcolo.",
    available: true,
    isOn: (p) => p.punteggio_importo_cifra_tonda > 0,
    turnOn: (p) => ({ ...p, punteggio_importo_cifra_tonda: 1 }),
    turnOff: (p) => ({ ...p, punteggio_importo_cifra_tonda: 0 }),
  },
  {
    n: 5,
    title: "Weekend e festività per Paese",
    status: "parziale",
    baker: "Weekend = 1 · Festività = 4",
    hint: "Due controlli distinti. Nessun calendario IT/DE/FR/ES automatico: le date festività si inseriscono a mano.",
    available: true,
    isOn: (p) => p.punteggio_weekend > 0 || p.punteggio_festivita > 0,
    turnOn: (p) => ({
      ...p,
      giorni_weekend: p.giorni_weekend ?? [5, 6],
      punteggio_weekend: 1,
      punteggio_festivita: 4,
    }),
    turnOff: (p) => ({
      ...p,
      giorni_weekend: null,
      festivita: null,
      punteggio_weekend: 0,
      punteggio_festivita: 0,
    }),
  },
  {
    n: 6,
    title: "Fuori orario (prima delle 8:00 / dopo le 18:00)",
    status: "presente",
    baker: "Posted outside of office hours = 1",
    hint: "Senza orario il criterio resta non calcolabile. All’attivazione si precompilano 08:00–18:00.",
    available: true,
    isOn: (p) => p.punteggio_fuori_orario > 0,
    turnOn: (p) => ({
      ...p,
      orario_ufficio_inizio: p.orario_ufficio_inizio || "08:00",
      orario_ufficio_fine: p.orario_ufficio_fine || "18:00",
      punteggio_fuori_orario: 1,
    }),
    turnOff: (p) => ({
      ...p,
      orario_ufficio_inizio: null,
      orario_ufficio_fine: null,
      punteggio_fuori_orario: 0,
    }),
  },
  {
    n: 7,
    title: "Registrazioni retrodatate e finestra di chiusura",
    status: "parziale",
    baker: "Backdated = 4",
    hint: "Esiste solo il delta creazione − effettiva. Manca la finestra ultimi 5 giorni / data chiusura (default 31/12).",
    available: true,
    isOn: (p) => p.punteggio_backdated > 0,
    turnOn: (p) => ({
      ...p,
      soglia_backdating_giorni: p.soglia_backdating_giorni ?? 1,
      punteggio_backdated: 4,
    }),
    turnOff: (p) => ({ ...p, soglia_backdating_giorni: null, punteggio_backdated: 0 }),
  },
  {
    n: 8,
    title: "Utenti non autorizzati",
    status: "presente",
    baker: "Posted by an unauthorised person = 4",
    hint: "Senza elenco staff il motore non calcola il criterio. Gli utenti di sistema sono esclusi dal test.",
    available: true,
    isOn: (p) => p.punteggio_staff_non_autorizzato > 0,
    turnOn: (p) => ({ ...p, punteggio_staff_non_autorizzato: 4 }),
    turnOff: (p) => ({
      ...p,
      staff_autorizzato: null,
      utenti_di_sistema: null,
      punteggio_staff_non_autorizzato: 0,
    }),
  },
  {
    n: 9,
    title: "Righe vuote o senza descrizione",
    status: "presente",
    baker: "Journal description is blank = 4",
    hint: "Nessun dato cliente: descrizione assente o solo spazi. Il toggle spegne il peso.",
    available: true,
    isOn: (p) => p.punteggio_descrizione_vuota > 0,
    turnOn: (p) => ({ ...p, punteggio_descrizione_vuota: 4 }),
    turnOff: (p) => ({ ...p, punteggio_descrizione_vuota: 0 }),
  },
  {
    n: 10,
    title: "Conto insolito o raro (2–4 volte l’anno)",
    status: "parziale",
    baker: "Estensione Quadra",
    hint: "Oggi: frequenza sotto soglia sulla popolazione caricata. Target: fascia 2–4 sull’intero esercizio.",
    available: true,
    isOn: (p) => (p.punteggio_conto_insolito_raro ?? 0) > 0 || p.soglia_frequenza_insolita != null,
    turnOn: (p) => ({
      ...p,
      soglia_frequenza_insolita: p.soglia_frequenza_insolita ?? 5,
      punteggio_conto_insolito_raro: p.punteggio_conto_insolito_raro ?? 1,
    }),
    turnOff: (p) => ({
      ...p,
      soglia_frequenza_insolita: null,
      punteggio_conto_insolito_raro: null,
    }),
  },
  {
    n: 11,
    title: "Test di sequenza numerica e controllo per pagina",
    status: "parziale",
    baker: "Fuori tabella pesi (controllo separato)",
    hint: "La sequenza numerica parte con l’analisi, senza punteggio riga. Il controllo per pagina/libro bollato non esiste.",
    available: false,
    isOn: () => false,
    turnOn: (p) => p,
    turnOff: (p) => p,
  },
  {
    n: 12,
    title: "Cifre finali ripetute",
    status: "assente",
    baker: "Estensione Quadra",
    hint: "Nessuna logica nel motore. Da definire il pattern (77, ,99, …) e una soglia minima di importo.",
    available: false,
    isOn: () => false,
    turnOn: (p) => p,
    turnOff: (p) => p,
  },
  {
    n: 13,
    title: "Ri-analisi mirata sui soli dati sospetti",
    status: "assente",
    baker: "Estensione Quadra",
    hint: "Esiste il filtro export «da investigare», non un secondo livello automatico sul sottoinsieme.",
    available: false,
    isOn: () => false,
    turnOn: (p) => p,
    turnOff: (p) => p,
  },
  {
    n: 14,
    title: "Numero di conto superiore a 10 cifre",
    status: "assente",
    baker: "Estensione Quadra",
    hint: "Il conto è testo libero. Una regola fissa a 10 cifre andrebbe parametrizzata per gestionale.",
    available: false,
    isOn: () => false,
    turnOn: (p) => p,
    turnOff: (p) => p,
  },
  {
    n: 15,
    title: "Parole chiave di frode e OCR della visura",
    status: "parziale",
    baker: "Related party / keyword match = 4",
    hint: "Le keyword in descrizione ci sono. L’OCR visura camerale no: resto disattivato finché non c’è il modulo.",
    available: true,
    isOn: (p) => p.punteggio_parte_correlata > 0,
    turnOn: (p) => ({ ...p, punteggio_parte_correlata: 4 }),
    turnOff: (p) => ({
      ...p,
      parole_chiave_parti_correlate: null,
      conti_infragruppo_parte_correlata: null,
      punteggio_parte_correlata: 0,
      punteggio_conto_infragruppo_parte_correlata: null,
    }),
  },
];

export function countActiveControls(params: JetParams) {
  return CONTROLS.filter((c) => c.available && c.isOn(params)).length;
}

function euro(n: number | null | undefined) {
  if (n == null) return null;
  const value = Number(n);
  if (Number.isNaN(value)) return null;
  return `€ ${value.toLocaleString("it-IT")}`;
}

function paramSummary(n: number, p: JetParams, on: boolean) {
  if (!on) return "Non applicabile";
  if (n === 1) return euro(p.utile_netto_dopo_imposte) ? `Utile ${euro(p.utile_netto_dopo_imposte)}` : "Utile non impostato";
  if (n === 2) return euro(p.valore_medio_registrazione) ? `Media ${euro(p.valore_medio_registrazione)}` : "Media dal file (ponte vuoto)";
  if (n === 3) return euro(p.performance_materiality) ? `PM ${euro(p.performance_materiality)}` : "Performance materiality vuota";
  if (n === 4) return "Divisibile per 10 (target 10k / 100k)";
  if (n === 5) {
    const days = (p.giorni_weekend || []).length;
    const hols = p.festivita?.length || 0;
    return `${days} giorni weekend · ${hols} festività`;
  }
  if (n === 6) {
    if (!p.orario_ufficio_inizio || !p.orario_ufficio_fine) return "Orario non impostato";
    return `${p.orario_ufficio_inizio} – ${p.orario_ufficio_fine}`;
  }
  if (n === 7) {
    return p.soglia_backdating_giorni == null
      ? "Soglia giorni vuota"
      : `Retrodatazione ≥ ${p.soglia_backdating_giorni} g`;
  }
  if (n === 8) {
    const staff = p.staff_autorizzato?.length || 0;
    const sys = p.utenti_di_sistema?.length || 0;
    return staff || sys ? `Staff ${staff} · sistema ${sys}` : "Elenchi vuoti";
  }
  if (n === 9) return "Descrizione vuota o solo spazi";
  if (n === 10) {
    return p.soglia_frequenza_insolita == null
      ? "Soglia frequenza vuota"
      : `Sotto ${p.soglia_frequenza_insolita} usi nel file`;
  }
  if (n === 15) {
    const keys = p.parole_chiave_parti_correlate?.length || 0;
    const accounts = p.conti_infragruppo_parte_correlata?.length || 0;
    return keys || accounts ? `${keys} keyword · ${accounts} conti` : "Keyword / conti vuoti";
  }
  return "Non nel motore";
}

export function ParamsPanel({
  client,
  params,
  setParams,
  busy,
  onSave,
}: {
  client: string;
  params: JetParams;
  setParams: (next: JetParams) => void;
  busy: boolean;
  onSave: () => void;
}) {
  const [openN, setOpenN] = useState<number | null>(null);
  const attivi = countActiveControls(params);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <JetSection
      icon="fact_check"
      title="Matrice dei 15 controlli"
      accent="green"
      hint={`${attivi} attivi · soglia approfondimento ≥ ${params.soglia_da_investigare}`}
      trailing={
        <label className="flex items-center gap-2 text-xs text-[#787774]">
          Soglia
          <input
            required
            min="0"
            type="number"
            aria-label="Soglia da investigare"
            value={params.soglia_da_investigare}
            onChange={(e) =>
              setParams({ ...params, soglia_da_investigare: Number(e.target.value) })
            }
            className={`${inputClass} w-16 h-8`}
          />
        </label>
      }
    >
      <form onSubmit={submit}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs notion-table">
            <thead>
              <tr className="bg-[#f7f6f3] text-[#787774] font-medium">
                <th className="py-2 px-3 w-12 text-center font-mono uppercase tracking-wider text-[11px]">
                  #
                </th>
                <th className="py-2 px-3 min-w-[240px] font-normal">Controllo</th>
                <th className="py-2 px-3 min-w-[180px] font-normal">Parametro / soglia</th>
                <th className="py-2 px-3 w-28 font-normal">Motore</th>
                <th className="py-2 px-3 min-w-[140px] font-normal">Baker Tilly</th>
                <th className="py-2 px-3 w-20 text-right font-normal">Attivo</th>
              </tr>
            </thead>
            <tbody>
              {CONTROLS.map((control) => (
                <ControlRow
                  key={control.n}
                  control={control}
                  params={params}
                  setParams={setParams}
                  busy={busy}
                  open={openN === control.n}
                  onOpen={() => setOpenN((n) => (n === control.n ? null : control.n))}
                  onActivate={() => setOpenN(control.n)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-[#e9e8e4] bg-[#faf9f7]">
          <span className="text-[11px] text-[#9b9a97]">
            Clicca la riga per i campi. I 15 restano su questa matrice, senza pagine extra.
          </span>
          <button disabled={busy} className={jetPrimaryClass}>
            Salva profilo
          </button>
        </div>
      </form>
    </JetSection>
  );
}

function ControlRow({
  control,
  params,
  setParams,
  busy,
  open,
  onOpen,
  onActivate,
}: {
  control: ControlDef;
  params: JetParams;
  setParams: (next: JetParams) => void;
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  onActivate: () => void;
}) {
  const on = control.isOn(params);
  const badge =
    control.status === "presente" ? "success" : control.status === "parziale" ? "warning" : "neutral";
  const badgeLabel =
    control.status === "presente" ? "Nel motore" : control.status === "parziale" ? "Parziale" : "Assente";
  const switchLabel = on ? "Attivo" : control.available ? "Non applicabile" : "Non disponibile";
  const nTone =
    control.status === "presente"
      ? "text-[#137333]"
      : control.status === "parziale"
      ? "text-[#b06000]"
      : "text-[#9065b0]";
  const bakerTone = /\b4\b/.test(control.baker)
    ? "orange"
    : /\b1\b/.test(control.baker)
    ? "blue"
    : "purple";
  const openTone =
    control.status === "presente"
      ? "bg-[#f4faf5] border-l-[3px] border-l-[#448361]"
      : control.status === "parziale"
      ? "bg-[#fffbeb] border-l-[3px] border-l-[#dfab01]"
      : "bg-[#f7f6f3] border-l-[3px] border-l-[#9b9a97]";

  return (
    <>
      <tr
        tabIndex={0}
        className={on ? undefined : "text-[#9b9a97]"}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <td className={`py-2.5 px-3 text-center font-mono tabular-nums font-medium ${nTone}`}>
          {String(control.n).padStart(2, "0")}
        </td>
        <td className="py-2.5 px-3">
          <span className={`font-medium ${on ? "text-[#2f3437]" : "text-[#787774]"}`}>
            {control.title}
          </span>
        </td>
        <td className="py-2.5 px-3 text-[#787774]">
          {paramSummary(control.n, params, on && control.available)}
        </td>
        <td className="py-2.5 px-3">
          <StatusBadge variant={badge}>{badgeLabel}</StatusBadge>
        </td>
        <td className="py-2.5 px-3">
          <NotionTag tone={bakerTone}>{control.baker}</NotionTag>
        </td>
        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
          <Switch
            hideLabel
            checked={on}
            disabled={busy || !control.available}
            onChange={(next) => {
              setParams(next ? control.turnOn(params) : control.turnOff(params));
              if (next) onActivate();
            }}
            label={switchLabel}
          />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className={`py-3 px-4 ${openTone}`}>
            <p className="text-[11px] text-[#787774] mb-2 leading-4">{control.hint}</p>
            {on && control.available ? (
              <ControlFields n={control.n} params={params} setParams={setParams} />
            ) : (
              <p className="text-[11px] text-[#9b9a97]">
                {control.available
                  ? "Attiva il controllo per compilare i campi."
                  : "Non disponibile in questa versione del motore."}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ControlFields({
  n,
  params,
  setParams,
}: {
  n: number;
  params: JetParams;
  setParams: (next: JetParams) => void;
}) {
  if (n === 1) {
    return (
      <Field label="Utile netto dopo imposte">
        <input
          type="number"
          step="any"
          value={params.utile_netto_dopo_imposte ?? ""}
          placeholder="Obbligatorio per calcolare il 10%"
          onChange={(e) =>
            setParams({
              ...params,
              utile_netto_dopo_imposte: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={inputClass}
        />
      </Field>
    );
  }
  if (n === 2) {
    return (
      <Field label="Valore medio registrazione (ponte, finché non è calcolato dal file)">
        <input
          type="number"
          step="any"
          value={params.valore_medio_registrazione ?? ""}
          placeholder="Da sostituire con la media della popolazione"
          onChange={(e) =>
            setParams({
              ...params,
              valore_medio_registrazione: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={inputClass}
        />
      </Field>
    );
  }
  if (n === 3) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Performance materiality">
          <input
            type="number"
            step="any"
            value={params.performance_materiality ?? ""}
            placeholder="Valore usato dal test"
            onChange={(e) =>
              setParams({
                ...params,
                performance_materiality: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Materialità di bilancio (solo riconciliazione Global Focus)">
          <input
            type="number"
            step="any"
            value={params.materialita_bilancio ?? ""}
            placeholder="Non entra nel calcolo"
            onChange={(e) =>
              setParams({
                ...params,
                materialita_bilancio: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (n === 4) {
    return (
      <p className="text-xs text-ink-secondary">
        Nessun campo cliente: il peso Baker Tilly è 1. La soglia 10.000 / 100.000 arriverà nel
        motore; oggi resta «divisibile per 10».
      </p>
    );
  }
  if (n === 5) {
    const selected = new Set(params.giorni_weekend || []);
    return (
      <div className="flex flex-col gap-3">
        <div>
          <span className="block mb-1 text-xs text-ink-secondary">Giorni weekend (peso 1)</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKEND_DAYS.map((d) => {
              const checked = selected.has(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(d.n);
                    else next.add(d.n);
                    const list = WEEKEND_DAYS.map((x) => x.n).filter((x) => next.has(x));
                    setParams({
                      ...params,
                      giorni_weekend: list.length ? list : null,
                    });
                  }}
                  className={`h-8 px-2.5 rounded-md text-xs border ${
                    checked
                      ? "bg-ink-primary text-white border-ink-primary"
                      : "bg-surface-card text-ink-secondary border-border-subtle"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <ListInput
          label="Festività (peso 4) — date da calendario cliente"
          type="date"
          values={params.festivita}
          onChange={(v) => setParams({ ...params, festivita: v as string[] | null })}
        />
      </div>
    );
  }
  if (n === 6) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Inizio orario ufficio">
          <input
            type="time"
            value={params.orario_ufficio_inizio || ""}
            onChange={(e) =>
              setParams({ ...params, orario_ufficio_inizio: e.target.value || null })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Fine orario ufficio">
          <input
            type="time"
            value={params.orario_ufficio_fine || ""}
            onChange={(e) =>
              setParams({ ...params, orario_ufficio_fine: e.target.value || null })
            }
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (n === 7) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Soglia retrodatazione (giorni tra creazione e data effettiva)">
          <input
            type="number"
            min="0"
            value={params.soglia_backdating_giorni ?? ""}
            onChange={(e) =>
              setParams({
                ...params,
                soglia_backdating_giorni: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-ink-secondary self-end pb-2">
          Data chiusura bilancio e finestra ultimi 5 giorni lavorativi: non ancora nel motore.
        </p>
      </div>
    );
  }
  if (n === 8) {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <ListInput
          label="Staff autorizzato"
          type="text"
          values={params.staff_autorizzato}
          onChange={(v) => setParams({ ...params, staff_autorizzato: v as string[] | null })}
        />
        <ListInput
          label="Utenti di sistema (esclusi dal test)"
          type="text"
          values={params.utenti_di_sistema}
          onChange={(v) => setParams({ ...params, utenti_di_sistema: v as string[] | null })}
        />
      </div>
    );
  }
  if (n === 9) {
    return (
      <p className="text-xs text-ink-secondary">
        Nessun campo da compilare. Peso Baker Tilly 4 sulla descrizione vuota.
      </p>
    );
  }
  if (n === 10) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Soglia frequenza (segnala conti usati meno di N volte nel file)">
          <input
            type="number"
            min="1"
            value={params.soglia_frequenza_insolita ?? ""}
            placeholder="5 ≈ usi 1–4"
            onChange={(e) =>
              setParams({
                ...params,
                soglia_frequenza_insolita: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Peso (non in tabella Baker Tilly)">
          <input
            type="number"
            min="0"
            value={params.punteggio_conto_insolito_raro ?? ""}
            onChange={(e) =>
              setParams({
                ...params,
                punteggio_conto_insolito_raro:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (n === 15) {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <ListInput
          label="Parole chiave (frode / parti correlate)"
          type="text"
          values={params.parole_chiave_parti_correlate}
          onChange={(v) =>
            setParams({ ...params, parole_chiave_parti_correlate: v as string[] | null })
          }
        />
        <ListInput
          label="Conti infragruppo / parti correlate"
          type="text"
          values={params.conti_infragruppo_parte_correlata}
          onChange={(v) =>
            setParams({
              ...params,
              conti_infragruppo_parte_correlata: v as string[] | null,
              punteggio_conto_infragruppo_parte_correlata: v ? 4 : null,
            })
          }
        />
      </div>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1 text-xs text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

function ListInput({
  label,
  values,
  type,
  onChange,
}: {
  label: string;
  values: (string | number)[] | null;
  type: string;
  onChange: (x: (string | number)[] | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    const value = type === "number" ? Number(draft) : draft.trim();
    onChange([...(values || []), value]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="h-10 px-3 shrink-0 rounded-md border border-border-subtle text-sm text-ink-primary hover:bg-surface-hover"
        >
          Aggiungi
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {values?.map((v, i) => (
          <button
            type="button"
            key={`${v}-${i}`}
            onClick={() => {
              const next = values.filter((_, x) => x !== i);
              onChange(next.length ? next : null);
            }}
            className="h-7 px-2 rounded bg-surface-hover text-xs text-ink-secondary hover:text-ink-primary"
            aria-label={`Rimuovi ${v}`}
          >
            {String(v)} ×
          </button>
        ))}
        {values === null && (
          <span className="text-xs text-ink-secondary">Non impostato</span>
        )}
      </div>
    </Field>
  );
}
