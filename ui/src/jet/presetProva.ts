import type { JetParams } from "./api";

/** Cliente usato dalla pratica di prova, riconoscibile in elenco. */
export const PROVA_CLIENT = "Prova JET";

export const PROFILO_PROVA_NOME = "Profilo di prova";

export const PROFILO_PROVA_POSIZIONI: Record<string, [number, number]> = {
  identificativo_registrazione: [0, 10],
  numero_documento: [10, 20],
  data_effettiva: [20, 30],
  data_creazione: [30, 40],
  ora_creazione: [40, 46],
  conto_contabile: [46, 56],
  importo_netto: [56, 72],
  importo_dare: [72, 88],
  importo_avere: [88, 104],
  descrizione: [104, 144],
  utente: [144, 154],
};

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Alias esatti (dopo normalizzazione) delle intestazioni Excel più comuni.
 * L'ordine dentro ogni campo è la priorità; una colonna non viene riusata.
 */
const FIELD_ALIASES: [string, string[]][] = [
  ["identificativo_registrazione", [
    "riga",
    "riga n",
    "transaction id",
    "transactionid",
    "id registrazione",
    "identificativo registrazione",
  ]],
  ["numero_documento", [
    "doc no",
    "numero documento",
    "num docum",
    "n documento",
    "document no",
    "document number",
  ]],
  ["data_effettiva", [
    "data effettiva",
    "effective date",
    "effectivedate",
    "data registrazione",
    "posting date",
    "data reg",
    "data",
  ]],
  ["data_creazione", [
    "data creazione",
    "created date",
    "createddate",
    "data reg 2",
  ]],
  ["ora_creazione", [
    "ora creazione",
    "created time",
    "createdtime",
    "c time",
  ]],
  ["conto_contabile", [
    "conto n",
    "codice conto",
    "account",
    "gl account",
    "conto contabile",
    "conto",
  ]],
  ["importo_netto", [
    "importo netto",
    "net",
    "netto",
  ]],
  ["importo_dare", [
    "entrate",
    "importo dare",
    "dare",
    "debit",
  ]],
  ["importo_avere", [
    "uscite",
    "importo avere",
    "avere",
    "credit",
  ]],
  ["descrizione", [
    "journal description",
    "journaldescription",
    "descrizione operazione",
    "descrizione",
    "causale",
  ]],
  ["utente", [
    "user id",
    "userid",
    "utente",
    "username",
    "user",
  ]],
];

export function suggestMapping(headers: string[]): Record<string, string> {
  const unused = new Map<string, string>();
  for (const header of headers) {
    const key = normalizeHeader(header);
    if (key && !unused.has(key)) unused.set(key, header);
  }
  const mapping: Record<string, string> = {};
  for (const [field, aliases] of FIELD_ALIASES) {
    for (const alias of aliases) {
      const header = unused.get(alias);
      if (!header) continue;
      mapping[field] = header;
      unused.delete(alias);
      break;
    }
  }
  return mapping;
}

export function mappingIsReady(mapping: Record<string, string>): boolean {
  return Boolean(
    mapping.identificativo_registrazione &&
      mapping.data_effettiva &&
      (mapping.importo_netto || mapping.importo_dare || mapping.importo_avere),
  );
}

/** Parametri tarati sul CSV di prova (Data/Descrizione/Conto/Entrate/Uscite). */
export function presetProva(base: JetParams, _period: string): JetParams {
  return {
    ...base,
    materialita_bilancio: 25000,
    performance_materiality: 15000,
    utile_netto_dopo_imposte: 100000,
    valore_medio_registrazione: null,
    soglia_importo_cifra_tonda: 10000,
    paese: "IT",
    orario_ufficio_inizio: null,
    orario_ufficio_fine: null,
    giorni_weekend: null,
    soglia_backdating_giorni: null,
    festivita: null,
    staff_autorizzato: null,
    utenti_di_sistema: null,
    parole_chiave_parti_correlate: [
      "infragruppo",
      "parte correlata",
      "società collegata",
      "intercompany",
      "related party",
      "controllata",
      "collegata",
    ],
    soglia_frequenza_insolita: 10,
    conti_infragruppo_parte_correlata: null,
    punteggio_profit_impact: 1,
    punteggio_oltre_dieci_volte_media: 1,
    punteggio_sopra_performance_materiality: 1,
    punteggio_importo_cifra_tonda: 1,
    punteggio_weekend: 1,
    punteggio_festivita: 4,
    punteggio_fuori_orario: 0,
    punteggio_backdated: 0,
    punteggio_staff_non_autorizzato: 0,
    punteggio_parte_correlata: 1,
    punteggio_descrizione_vuota: 4,
    punteggio_conto_insolito_raro: 4,
  };
}
