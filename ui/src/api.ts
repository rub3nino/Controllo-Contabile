export type Status = "✓" | "✗" | "wip" | "N/A" | "";

export type DocumentRow = {
  id: string;
  name: string;
  path: string;
  rel: string;
  ext: string;
  size: number;
  item_id: string | null;
  item_label: string | null;
  confidence: number;
  method: string;
  excerpt: string;
  skip: boolean;
};

export type ProvenanceRow = {
  id: string;
  sheet: string;
  cell: string;
  item_id: string | null;
  value: string;
  source_name: string;
  source_path: string;
  source_rel: string;
  page: string | null;
  excerpt: string;
  method: string;
  confidence: number;
  ts: string;
  human: boolean;
};

export type MissingRow = {
  id: string;
  label: string;
  status: string;
  need?: string;
};

export type UserFacingError = {
  title: string;
  detail: string;
  missing: string[];
};

export type AppState = {
  pratica: {
    client: string;
    period: string;
    done_by: string;
    reviewed_by: string;
    request_date: string | null;
    activity_date: string | null;
    documents_dir: string;
    pratica_id: string;
    ingest_kind: string;
    skip_items: string[];
    na_items: string[];
    skip_sections: string[];
  } | null;
  documents: DocumentRow[];
  checklist: Record<string, Status>;
  sections: { id: string; title: string; status: Status; note: string }[];
  kpis: { files: number; classified: number; missing: number; sections_done: number };
  logs: { ts: string; level: string; section: string; message: string; source: string | null }[];
  provenance: ProvenanceRow[];
  missing: MissingRow[];
  running: boolean;
  current_section: string;
  progress: number;
  output_dir: string | null;
  xlsx_path: string | null;
  error: string | null;
  error_detail: string;
  error_missing: string[];
  job_step: number;
  job_total: number;
  job_label: string;
};

export type Catalog = {
  items: { id: string; label: string; row: number; group: string; need?: string }[];
  sections: { id: string; title: string; blurb?: string; look_for?: string }[];
};

export class ApiError extends Error {
  title: string;
  detail: string;
  missing: string[];

  constructor(err: UserFacingError) {
    super(err.title);
    this.name = "ApiError";
    this.title = err.title;
    this.detail = err.detail;
    this.missing = err.missing;
  }
}

export function parseErrorBody(text: string, fallback = "Qualcosa è andato storto"): UserFacingError {
  const raw = (text || "").trim();
  if (!raw) return { title: fallback, detail: "", missing: [] };
  try {
    const parsed = JSON.parse(raw);
    const d = parsed?.detail ?? parsed;
    if (d && typeof d === "object" && !Array.isArray(d) && d.title) {
      return {
        title: String(d.title),
        detail: String(d.detail || ""),
        missing: Array.isArray(d.missing) ? d.missing.map(String) : [],
      };
    }
    if (typeof d === "string" && d.trim()) {
      return { title: d.trim(), detail: "", missing: [] };
    }
    if (Array.isArray(d)) {
      const msgs = d.map((x) => (x && x.msg ? String(x.msg) : JSON.stringify(x)));
      return { title: "Dati non validi", detail: msgs.join(". "), missing: [] };
    }
  } catch {
    /* testo non JSON */
  }
  if (raw.length > 420) {
    return { title: fallback, detail: `${raw.slice(0, 420)}…`, missing: [] };
  }
  return { title: raw, detail: "", missing: [] };
}

export function asUserError(e: unknown): UserFacingError {
  if (e instanceof ApiError) {
    return { title: e.title, detail: e.detail, missing: e.missing };
  }
  if (e instanceof Error) return parseErrorBody(e.message, e.message || "Qualcosa è andato storto");
  return { title: String(e), detail: "", missing: [] };
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const t = await res.text();
  throw new ApiError(parseErrorBody(t, res.statusText || "Errore dal server"));
}

export async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  await throwIfNotOk(res);
  return res.json();
}

export const api = {
  state: () => j<AppState>("/api/state"),
  catalog: () => j<Catalog>("/api/catalog"),
  pratica: (body: unknown) =>
    j<AppState>("/api/pratica", { method: "POST", body: JSON.stringify(body) }),
  ingest: async (files: FileList | File[]) => {
    const fd = new FormData();
    const list = Array.from(files);
    for (const file of list) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      fd.append("files", file);
      fd.append("rels", rel);
    }
    const res = await fetch("/api/ingest", { method: "POST", body: fd });
    await throwIfNotOk(res);
    return res.json() as Promise<AppState>;
  },
  ingestLink: (path: string) =>
    j<AppState>("/api/ingest-link", { method: "POST", body: JSON.stringify({ path }) }),
  scan: () => j<AppState>("/api/scan", { method: "POST" }),
  patchDoc: (id: string, body: unknown) =>
    j<AppState>(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  patchItem: (id: string, status: "✗" | "N/A" | "") =>
    j<AppState>(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
