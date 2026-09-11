import { j } from "../api";

export type JetStatus =
  | "bozza"
  | "parametri_configurati"
  | "file_caricato"
  | "analizzato";
export type JetParams = {
  materialita_bilancio: number | null;
  performance_materiality: number | null;
  utile_netto_dopo_imposte: number | null;
  valore_medio_registrazione: number | null;
  soglia_importo_cifra_tonda: number | string | null;
  paese: string | null;
  orario_ufficio_inizio: string | null;
  orario_ufficio_fine: string | null;
  giorni_weekend: number[] | null;
  soglia_backdating_giorni: number | null;
  data_chiusura: string | null;
  finestra_chiusura_giorni_lavorativi: number | null;
  festivita: string[] | null;
  staff_autorizzato: string[] | null;
  utenti_di_sistema: string[] | null;
  parole_chiave_parti_correlate: string[] | null;
  soglia_frequenza_insolita: number | null;
  conti_infragruppo_parte_correlata: string[] | null;
  soglia_da_investigare: number;
  punteggio_profit_impact: number;
  punteggio_oltre_dieci_volte_media: number;
  punteggio_sopra_performance_materiality: number;
  punteggio_importo_cifra_tonda: number;
  punteggio_weekend: number;
  punteggio_festivita: number;
  punteggio_fuori_orario: number;
  punteggio_backdated: number;
  punteggio_staff_non_autorizzato: number;
  punteggio_parte_correlata: number;
  punteggio_descrizione_vuota: number;
  punteggio_conto_insolito_raro: number | null;
  punteggio_conto_infragruppo_parte_correlata: number | null;
  punteggio_conto_lunghezza: number | null;
  punteggio_cifre_ripetute: number | null;
  attivo_profit_impact: boolean;
  attivo_oltre_dieci_volte_media: boolean;
  attivo_sopra_performance_materiality: boolean;
  attivo_importo_cifra_tonda: boolean;
  attivo_weekend: boolean;
  attivo_festivita: boolean;
  attivo_fuori_orario: boolean;
  attivo_backdated: boolean;
  attivo_staff_non_autorizzato: boolean;
  attivo_parte_correlata: boolean;
  attivo_descrizione_vuota: boolean;
  attivo_conto_insolito_raro: boolean;
  attivo_conto_infragruppo_parte_correlata: boolean;
  attivo_conto_lunghezza: boolean;
  attivo_cifre_ripetute: boolean;
  attivo_finestra_chiusura: boolean;
};
export type JetPractice = {
  id: string;
  client: string;
  period: string;
  status: JetStatus;
  created_at: string;
  parametri: JetParams | null;
  file_originale_nome: string | null;
  mappatura: Record<string, string> | null;
  analizzato_at: string | null;
  profilo_estrazione_id: string | null;
  strategia_duplicati: "mantieni_tutti" | "scarta_identiche";
  numero_fonti: number;
  numero_registrazioni: number;
  numero_da_investigare: number;
  valore_medio_registrazione_effettivo: number | string | null;
};
export type JetSource = {
  id: string;
  pratica_id: string;
  nome_originale: string;
  percorso_relativo: string;
  formato: "xlsx" | "txt" | "pdf";
  sha256: string;
  dimensione_byte: number;
  attiva: boolean;
  stato: "da_configurare" | "pronta" | "esclusa" | "errore";
  mappatura: Record<string, string> | null;
  profilo_estrazione_id: string | null;
  numero_righe: number;
  errore: string | null;
  created_at: string;
};
export type JetImport = {
  id: string;
  pratica_id: string;
  fonte_id: string;
  stato: "completata" | "errore";
  numero_righe: number;
  errore: string | null;
  created_at: string;
};
export type ExtractionProfile = {
  id: string;
  nome: string;
  riga_intestazione: number;
  intestazione_riferimento: string;
  posizioni: Record<string, [number, number]>;
  created_at: string;
};
export type FileInspection = {
  pratica: JetPractice;
  intestazioni?: string[];
  intestazione?: string;
  riga_intestazione?: number;
  righe_esempio?: string[];
  codifica?: string;
  profilo?: ExtractionProfile | null;
};
export type JournalRow = {
  data_effettiva: string;
  data_creazione: string | null;
  ora_creazione: string | null;
  identificativo_registrazione: string;
  numero_documento: string | null;
  importo_netto: string;
  descrizione: string | null;
  utente: string | null;
  conto_contabile: string | null;
};
export type RowOutcome = Record<string, boolean | number | string | null> & {
  identificativo_registrazione: string;
  punteggio_totale: number;
  da_investigare: boolean;
};
export type JetResult = Record<string, unknown> & {
  riga: JournalRow;
  esito: RowOutcome;
};
export type ResultPage = {
  items: JetResult[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};
export type ResultFilters = {
  da_investigare?: boolean;
  conto_contabile?: string;
  punteggio_minimo?: number;
};

function query(filters: ResultFilters & { page?: number; page_size?: number }) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") p.set(key, String(value));
  });
  return p.toString();
}
async function upload(practiceId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(
    `/api/jet/pratiche/${encodeURIComponent(practiceId)}/file`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new Error(
      (await response.json()).detail || "Caricamento non riuscito",
    );
  }
  return response.json() as Promise<FileInspection>;
}
async function uploadFiles(practiceId: string, files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  const response = await fetch(
    `/api/jet/pratiche/${encodeURIComponent(practiceId)}/files`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new Error(
      (await response.json()).detail || "Caricamento non riuscito",
    );
  }
  return response.json() as Promise<
    {
      pratica: JetPractice;
      files: (Omit<FileInspection, "pratica"> & { fonte: JetSource })[];
    }
  >;
}
export const jetApi = {
  list: () => j<JetPractice[]>("/api/jet/pratiche"),
  create: (client: string, period: string) =>
    j<JetPractice>("/api/jet/pratiche", {
      method: "POST",
      body: JSON.stringify({ client, period }),
    }),
  parameters: (id: string, body: JetParams) =>
    j<JetPractice>(`/api/jet/pratiche/${encodeURIComponent(id)}/parametri`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  upload,
  uploadFiles,
  sources: (id: string) =>
    j<JetSource[]>(`/api/jet/pratiche/${encodeURIComponent(id)}/fonti`),
  imports: (id: string) =>
    j<JetImport[]>(`/api/jet/pratiche/${encodeURIComponent(id)}/importazioni`),
  sourcePreview: (practiceId: string, sourceId: string) =>
    j<Omit<FileInspection, "pratica"> & { fonte: JetSource }>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }/anteprima`,
    ),
  configureSource: (practiceId: string, sourceId: string, attiva: boolean) =>
    j<JetSource>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }`,
      { method: "PATCH", body: JSON.stringify({ attiva }) },
    ),
  replaceSource: async (practiceId: string, sourceId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }/file`,
      { method: "PUT", body },
    );
    if (!response.ok) {
      throw new Error(
        (await response.json()).detail || "Sostituzione non riuscita",
      );
    }
    return response.json() as Promise<FileInspection & { fonte: JetSource }>;
  },
  deleteSource: async (practiceId: string, sourceId: string) => {
    const response = await fetch(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Eliminazione della fonte non riuscita");
  },
  sourceMapping: (
    practiceId: string,
    sourceId: string,
    mappatura: Record<string, string>,
  ) =>
    j<JetSource>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }/mappatura`,
      { method: "PUT", body: JSON.stringify({ mappatura }) },
    ),
  sourceApplyProfile: (
    practiceId: string,
    sourceId: string,
    profileId: string,
  ) =>
    j<JetSource>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }/profilo/${encodeURIComponent(profileId)}`,
      { method: "PUT" },
    ),
  sourceCreateProfile: (
    practiceId: string,
    sourceId: string,
    nome: string,
    posizioni: Record<string, [number, number]>,
  ) =>
    j<JetSource>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/fonti/${
        encodeURIComponent(sourceId)
      }/profilo`,
      { method: "POST", body: JSON.stringify({ nome, posizioni }) },
    ),
  duplicates: (id: string, strategia: JetPractice["strategia_duplicati"]) =>
    j<JetPractice>(`/api/jet/pratiche/${encodeURIComponent(id)}/duplicati`, {
      method: "PUT",
      body: JSON.stringify({ strategia }),
    }),
  headers: (id: string) =>
    j<Omit<FileInspection, "pratica">>(
      `/api/jet/pratiche/${encodeURIComponent(id)}/intestazioni`,
    ),
  profiles: () => j<ExtractionProfile[]>("/api/jet/profili"),
  profile: (id: string) =>
    j<ExtractionProfile>(`/api/jet/profili/${encodeURIComponent(id)}`),
  applyProfile: (practiceId: string, profileId: string) =>
    j<JetPractice>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/profilo/${
        encodeURIComponent(profileId)
      }`,
      { method: "PUT" },
    ),
  createProfile: (
    practiceId: string,
    nome: string,
    posizioni: Record<string, [number, number]>,
  ) =>
    j<JetPractice>(
      `/api/jet/pratiche/${encodeURIComponent(practiceId)}/profilo`,
      { method: "POST", body: JSON.stringify({ nome, posizioni }) },
    ),
  mapping: (id: string, mappatura: Record<string, string>) =>
    j<JetPractice>(`/api/jet/pratiche/${encodeURIComponent(id)}/mappatura`, {
      method: "PUT",
      body: JSON.stringify({ mappatura }),
    }),
  analyze: (id: string) =>
    j<JetPractice>(`/api/jet/pratiche/${encodeURIComponent(id)}/analizza`, {
      method: "POST",
    }),
  results: (id: string, filters: ResultFilters, page: number) =>
    j<ResultPage>(
      `/api/jet/pratiche/${encodeURIComponent(id)}/risultati?${
        query({ ...filters, page, page_size: 50 })
      }`,
    ),
  exportUrl: (id: string, filters: ResultFilters) =>
    `/api/jet/pratiche/${encodeURIComponent(id)}/export.xlsx?${query(filters)}`,
};
