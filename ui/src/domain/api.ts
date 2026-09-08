import { j, type Status } from "../api";

export type Section = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
export type DomainStatus = Exclude<Status, "">;

export type ExtractedField = { kind: string; value: string; unit: string | null };
export type Evidence = {
  id: string; pratica_id: string; item_id: string; found: boolean;
  source_path: string | null; source_name: string | null; fields: ExtractedField[];
  method: string; confidence: number; excerpt: string; notes: string; collected_at: string;
};
export type Anomaly = { kind: string; description: string; severity: "info" | "warning" | "critical"; related_item_id: string | null };
export type VerificationResult = {
  id: string; pratica_id: string; client: string; period: string; section: Section;
  status: DomainStatus; reasoning: string; evidence: Evidence[]; missing_items: string[];
  anomalies: Anomaly[]; computed_at: string;
};
export type FindingRef = { pratica_id: string; client: string; period: string };
export type Finding = {
  id: string; client: string; pratica_id: string; period: string; section: Section;
  sa250b_check: number | null; kind: "carenza_procedurale" | "errore_contabile" | "altro";
  description: string; status: "aperto" | "in_corso" | "sistemato";
  first_raised: FindingRef; previous_finding_id: string | null; resolved_in: FindingRef | null; created_at: string;
};
export type PraticaRecord = { id: string; client_id: string; client: string; period: string; documents_dir: string; created_at: string };
export type HumanOverride = {
  id: string; pratica_id: string; scope: "item" | "section"; target: string;
  decision: "✗" | "N/A"; note: string; decided_by: string | null; decided_at: string | null;
};
export type ClientSummary = { id: string; display_name: string };
export type ScanRequest = { client_id: string; period: string; documents_dir: string; pratica_id?: string };
export type ScanResponse = {
  pratica: PraticaRecord; documents_count: number; evidence_count: number; evidences: Evidence[];
  rescan: boolean; carried_findings: Finding[];
};
export type VerificheResponse = { pratica: PraticaRecord; verifiche: Record<Section, VerificationResult>; open_findings: Finding[] };
export type OverrideRequest = { scope: "item" | "section"; target: string; decision: "✗" | "N/A"; note: string; decided_by?: string };

export const domainApi = {
  clients: () => j<{ clients: ClientSummary[] }>("/api/domain/clients"),
  scan: (body: ScanRequest) => j<ScanResponse>("/api/domain/scan", { method: "POST", body: JSON.stringify(body) }),
  verifiche: (praticaId: string) => j<VerificheResponse>(`/api/domain/pratiche/${encodeURIComponent(praticaId)}/verifiche`),
  createOverride: (praticaId: string, body: OverrideRequest) => j<{ override: HumanOverride }>(`/api/domain/pratiche/${encodeURIComponent(praticaId)}/overrides`, { method: "POST", body: JSON.stringify(body) }),
};
