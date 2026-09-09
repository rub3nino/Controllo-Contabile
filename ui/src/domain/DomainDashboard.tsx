/**
 * DomainDashboard.tsx — Dashboard verifiche SA 250B
 * Migrato al design system Atelier Document System.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { asUserError, type UserFacingError } from "../api";
import { Icon, Card, CardHeader, StatusBadge, mapStatusToVariant } from "../components";
import { ALL_SECTIONS, SECTION_HELP } from "../sectionHelp";
import { domainApi, type ClientSummary, type OverrideRequest, type Section, type VerificheResponse } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DomainDashboard({ onShowExcel }: { onShowExcel: () => void }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [form, setForm] = useState({ client_id: "", period: "Aprile - Giugno 2026", documents_dir: "", pratica_id: "" });
  const [data, setData] = useState<VerificheResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [override, setOverride] = useState<OverrideRequest>({ scope: "section", target: "D", decision: "✗", note: "", decided_by: "" });

  useEffect(() => {
    domainApi.clients().then(({ clients: available }) => {
      setClients(available);
      setForm((current) => ({ ...current, client_id: current.client_id || available[0]?.id || "" }));
    }).catch((reason) => setError(asUserError(reason)));
  }, []);

  async function scan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scanned = await domainApi.scan({
        client_id: form.client_id,
        period: form.period,
        documents_dir: form.documents_dir,
        ...(form.pratica_id.trim() ? { pratica_id: form.pratica_id.trim() } : {}),
      });
      setForm((current) => ({ ...current, pratica_id: scanned.pratica.id }));
      setData(await domainApi.verifiche(scanned.pratica.id));
    } catch (reason) {
      setError(asUserError(reason));
    } finally {
      setBusy(false);
    }
  }

  function prepareOverride(scope: "item" | "section", target: string) {
    setOverride((current) => ({ ...current, scope, target, decision: "✗" }));
    document.getElementById("domain-override")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveOverride(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await domainApi.createOverride(data.pratica.id, override);
      setData(await domainApi.verifiche(data.pratica.id));
      setOverride((current) => ({ ...current, note: "" }));
    } catch (reason) {
      setError(asUserError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-lg">
      {/* ─── Error Banner ─── */}
      {error && (
        <div className="rounded-lg border border-status-red-bg bg-status-red-bg/30 px-base py-md">
          <div className="flex items-start gap-md">
            <Icon name="error" size="md" className="text-status-red-text flex-shrink-0 mt-xxs" />
            <div>
              <p className="text-label-md text-status-red-text font-medium">{error.title}</p>
              {error.detail && <p className="mt-xs text-body-sm text-status-red-text/80">{error.detail}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Setup Form ─── */}
      <Card padding="lg">
        <CardHeader>Avvia o riprendi una pratica</CardHeader>
        <p className="text-body-md text-ink-secondary mb-md">
          Scansiona la cartella e calcola lo stato delle nove carte di lavoro.
        </p>
        <form onSubmit={scan} className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Cliente">
            <select
              required
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
            >
              <option value="">Seleziona…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.display_name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Periodo">
            <input
              required
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
            />
          </FormField>

          <FormField label="Cartella documenti">
            <input
              required
              value={form.documents_dir}
              onChange={(e) => setForm({ ...form, documents_dir: e.target.value })}
              placeholder="/Volumes/…/documenti"
              className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
            />
          </FormField>

          <FormField label="ID pratica (opzionale)">
            <input
              value={form.pratica_id}
              onChange={(e) => setForm({ ...form, pratica_id: e.target.value })}
              placeholder="Generato automaticamente"
              className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
            />
          </FormField>

          <button
            disabled={busy || !form.client_id}
            className="md:col-span-2 xl:col-span-4 inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors-fast"
          >
            <Icon name="document_scanner" size="sm" />
            {busy ? "Elaborazione…" : "Scansiona e calcola verifiche"}
          </button>
        </form>
      </Card>

      {/* ─── Results ─── */}
      {data ? (
        <>
          {/* Pratica Info */}
          <Card padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-md">
              <div>
                <p className="text-label-sm text-ink-tertiary uppercase tracking-wide">
                  Pratica {data.pratica.id}
                </p>
                <h2 className="text-headline-md text-ink-primary mt-xs">{data.pratica.client}</h2>
                <p className="text-body-md text-ink-secondary">{data.pratica.period}</p>
              </div>
              <p className="text-body-sm text-ink-tertiary break-all max-w-md">
                {data.pratica.documents_dir}
              </p>
            </div>
          </Card>

          {/* Sections Grid */}
          <div className="grid gap-base lg:grid-cols-2">
            {ALL_SECTIONS.map((id) => {
              const result = data.verifiche[id as Section];
              const meta = SECTION_HELP[id];
              const found = result.evidence.filter((evidence) => evidence.found);

              return (
                <Card key={id} padding="lg">
                  <div className="flex items-start justify-between gap-md mb-md">
                    <div>
                      <p className="text-label-sm text-ink-tertiary uppercase tracking-wide">
                        Sezione {id}
                      </p>
                      <h3 className="text-headline-sm text-ink-primary mt-xs">{meta.title}</h3>
                      <p className="text-body-sm text-ink-secondary mt-xs">{meta.blurb}</p>
                    </div>
                    <StatusBadge variant={mapStatusToVariant(result.status)}>{result.status}</StatusBadge>
                  </div>

                  <p className="p-md rounded-lg bg-surface-sidebar text-body-md text-ink-primary mb-md">
                    {result.reasoning}
                  </p>

                  <div className="grid gap-md sm:grid-cols-2">
                    {/* Missing items */}
                    <div>
                      <h4 className="text-label-sm text-ink-tertiary uppercase tracking-wide mb-sm">
                        Mancanti
                      </h4>
                      {result.missing_items.length === 0 ? (
                        <p className="text-body-sm text-ink-tertiary">Nessuna voce mancante</p>
                      ) : (
                        <ul className="space-y-xs">
                          {result.missing_items.map((item) => (
                            <li
                              key={item}
                              className="flex items-center justify-between gap-sm rounded-lg border border-status-yellow-bg bg-status-yellow-bg/30 px-md py-sm"
                            >
                              <span className="text-body-sm text-status-yellow-text font-medium">{item}</span>
                              <button
                                type="button"
                                onClick={() => prepareOverride("item", item)}
                                className="text-body-sm text-status-yellow-text underline"
                              >
                                Segna saltata
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Evidence found */}
                    <div>
                      <h4 className="text-label-sm text-ink-tertiary uppercase tracking-wide mb-sm">
                        Evidenze trovate
                      </h4>
                      {found.length === 0 ? (
                        <p className="text-body-sm text-ink-tertiary">Nessuna evidenza trovata</p>
                      ) : (
                        <ul className="space-y-xs">
                          {found.map((evidence) => (
                            <li key={evidence.id} className="rounded-lg border border-border-subtle px-md py-sm">
                              <span className="text-body-sm text-ink-primary font-medium">{evidence.item_id}</span>
                              <span className="block text-body-sm text-ink-tertiary mt-xxs truncate">
                                {evidence.source_name || "Fonte non disponibile"}
                              </span>
                              {evidence.fields.length > 0 && (
                                <ul className="mt-sm space-y-xxs border-l-2 border-border-muted pl-sm">
                                  {evidence.fields.map((field, index) => (
                                    <li key={`${field.kind}-${index}`} className="text-body-sm text-ink-secondary">
                                      <span className="font-medium">{field.kind.replaceAll("_", " ")}</span>: {field.value}
                                      {field.unit ? ` ${field.unit}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Anomalies */}
                  {result.anomalies.length > 0 && (
                    <div className="mt-md">
                      <h4 className="text-label-sm text-ink-tertiary uppercase tracking-wide mb-sm">
                        Anomalie
                      </h4>
                      <ul className="space-y-xs">
                        {result.anomalies.map((anomaly, index) => (
                          <li
                            key={`${anomaly.kind}-${index}`}
                            className="rounded-lg border border-status-red-bg bg-status-red-bg/30 px-md py-sm"
                          >
                            <span className="text-body-sm text-status-red-text font-medium">{anomaly.kind}</span>
                            <span className="text-body-sm text-status-red-text"> — {anomaly.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => prepareOverride("section", id)}
                    className="mt-md inline-flex items-center gap-sm px-base py-sm rounded border border-border-subtle bg-surface-card text-label-md text-ink-primary hover:bg-surface-hover transition-colors-fast"
                  >
                    <Icon name="edit_note" size="sm" />
                    Registra override sezione
                  </button>
                </Card>
              );
            })}
          </div>

          {/* Open Findings */}
          <Card padding="lg">
            <CardHeader>Finding aperti</CardHeader>
            <p className="text-body-md text-ink-secondary mb-md">
              Carenze ed errori riportati dai trimestri precedenti (verifiche 11/12).
            </p>
            {data.open_findings.length === 0 ? (
              <p className="text-body-md text-ink-tertiary">Nessun finding aperto.</p>
            ) : (
              <ul className="divide-y divide-border-muted">
                {data.open_findings.map((finding) => (
                  <li key={finding.id} className="py-md">
                    <span className="text-label-md text-ink-primary font-medium">
                      {finding.section} · {finding.kind.replaceAll("_", " ")}
                    </span>
                    <p className="text-body-md text-ink-secondary mt-xs">{finding.description}</p>
                    <p className="text-body-sm text-ink-tertiary mt-xs">
                      Prima segnalazione: {finding.first_raised.period}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Override Form */}
          <div id="domain-override">
          <Card padding="lg">
            <CardHeader>Registra una decisione umana</CardHeader>
            <p className="text-body-md text-ink-secondary mb-md">
              L'override vale soltanto per la pratica corrente. Dopo il salvataggio le verifiche vengono ricalcolate.
            </p>
            <form onSubmit={saveOverride} className="grid gap-md md:grid-cols-2 xl:grid-cols-5">
              <FormField label="Ambito">
                <select
                  value={override.scope}
                  onChange={(e) => setOverride({ ...override, scope: e.target.value as OverrideRequest["scope"] })}
                  className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
                >
                  <option value="section">Sezione</option>
                  <option value="item">Voce</option>
                </select>
              </FormField>

              <FormField label="Target">
                <input
                  required
                  value={override.target}
                  onChange={(e) => setOverride({ ...override, target: e.target.value })}
                  className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
                />
              </FormField>

              <FormField label="Decisione">
                <select
                  value={override.decision}
                  onChange={(e) => setOverride({ ...override, decision: e.target.value as OverrideRequest["decision"] })}
                  className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
                >
                  <option value="✗">Skip (✗)</option>
                  <option value="N/A">N/A</option>
                </select>
              </FormField>

              <FormField label="Deciso da">
                <input
                  value={override.decided_by || ""}
                  onChange={(e) => setOverride({ ...override, decided_by: e.target.value })}
                  className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary"
                />
              </FormField>

              <FormField label="Nota">
                <input
                  required
                  value={override.note}
                  onChange={(e) => setOverride({ ...override, note: e.target.value })}
                  placeholder="Motivazione della decisione"
                  className="w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-ink-secondary"
                />
              </FormField>

              <button
                disabled={busy}
                className="md:col-span-2 xl:col-span-5 inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors-fast"
              >
                <Icon name="save" size="sm" />
                Salva override e ricalcola
              </button>
            </form>
          </Card>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-card/60 px-lg py-3xl text-center">
          <Icon name="folder_open" size="xl" className="text-ink-tertiary mb-md mx-auto text-[48px]" />
          <p className="text-body-md text-ink-tertiary">
            Seleziona cliente e cartella per vedere lo stato delle verifiche.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-label-sm text-ink-secondary mb-xs">{label}</span>
      {children}
    </label>
  );
}
