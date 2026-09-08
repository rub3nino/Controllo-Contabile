import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { asUserError, type UserFacingError } from "../api";
import { Logo } from "../Logo";
import { ALL_SECTIONS, SECTION_HELP } from "../sectionHelp";
import { pill } from "../statusPill";
import { domainApi, type ClientSummary, type OverrideRequest, type Section, type VerificheResponse } from "./api";
import { WorkspaceTabs } from "./WorkspaceTabs";

const fieldClass = "h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-ink/30";
const buttonClass = "min-h-11 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="h-dvh overflow-y-auto bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Logo className="h-8 w-8" />
          <div className="mr-auto">
            <p className="font-semibold">Quadra</p>
            <p className="text-xs text-muted">Dashboard verifiche · SA 250B</p>
          </div>
          <WorkspaceTabs active="domain" onChange={(value) => value === "excel" && onShowExcel()} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
            <p className="font-semibold">{error.title}</p>
            {error.detail ? <p className="mt-1">{error.detail}</p> : null}
          </div>
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
          <div className="mb-4">
            <h1 className="text-lg font-semibold">Avvia o riprendi una pratica</h1>
            <p className="mt-1 text-sm text-muted">Scansiona la cartella e calcola lo stato delle nove carte di lavoro.</p>
          </div>
          <form onSubmit={scan} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Cliente">
              <select required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })} className={fieldClass}>
                <option value="">Seleziona…</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}
              </select>
            </Field>
            <Field label="Periodo"><input required value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} className={fieldClass} /></Field>
            <Field label="Cartella documenti"><input required value={form.documents_dir} onChange={(event) => setForm({ ...form, documents_dir: event.target.value })} placeholder="/Volumes/…/documenti" className={fieldClass} /></Field>
            <Field label="ID pratica (opzionale)"><input value={form.pratica_id} onChange={(event) => setForm({ ...form, pratica_id: event.target.value })} placeholder="Generato automaticamente" className={fieldClass} /></Field>
            <button disabled={busy || !form.client_id} className={`${buttonClass} bg-ink text-white hover:bg-ink/90 md:col-span-2 xl:col-span-4`}>
              {busy ? "Elaborazione…" : "Scansiona e calcola verifiche"}
            </button>
          </form>
        </section>

        {data ? (
          <>
            <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
              <div><p className="text-xs uppercase tracking-wide text-muted">Pratica {data.pratica.id}</p><h2 className="mt-1 text-lg font-semibold">{data.pratica.client}</h2><p className="text-sm text-muted">{data.pratica.period}</p></div>
              <p className="max-w-xl break-anywhere text-xs text-muted">{data.pratica.documents_dir}</p>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              {ALL_SECTIONS.map((id) => {
                const result = data.verifiche[id as Section];
                const meta = SECTION_HELP[id];
                const found = result.evidence.filter((evidence) => evidence.found);
                return (
                  <section key={id} data-testid={`section-${id}`} className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xs font-semibold text-muted">SEZIONE {id}</p><h2 className="mt-1 font-semibold">{meta.title}</h2><p className="mt-1 text-xs leading-5 text-muted">{meta.blurb}</p></div>
                      {pill(result.status)}
                    </div>
                    <p className="mt-4 rounded-xl bg-paper px-3 py-2 text-sm leading-6">{result.reasoning}</p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <List title="Mancanti" empty="Nessuna voce mancante">
                        {result.missing_items.map((item) => (
                          <li key={item} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                            <span className="font-medium">{item}</span>
                            <button type="button" onClick={() => prepareOverride("item", item)} className="text-xs font-medium underline">Segna saltata</button>
                          </li>
                        ))}
                      </List>
                      <List title="Evidenze trovate" empty="Nessuna evidenza trovata">
                        {found.map((evidence) => <li key={evidence.id} className="rounded-lg border border-line px-2.5 py-2"><span className="font-medium">{evidence.item_id}</span><span className="mt-0.5 block break-anywhere text-xs text-muted">{evidence.source_name || "Fonte non disponibile"}</span></li>)}
                      </List>
                    </div>

                    {result.anomalies.length ? <div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Anomalie</h3><ul className="mt-2 space-y-2">{result.anomalies.map((anomaly, index) => <li key={`${anomaly.kind}-${index}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm"><span className="font-medium">{anomaly.kind}</span> — {anomaly.description}</li>)}</ul></div> : null}
                    <button type="button" onClick={() => prepareOverride("section", id)} className={`${buttonClass} mt-4 border border-line bg-white hover:bg-paper`}>Registra override sezione</button>
                  </section>
                );
              })}
            </div>

            <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
              <h2 className="font-semibold">Finding aperti</h2>
              <p className="mt-1 text-sm text-muted">Carenze ed errori riportati dai trimestri precedenti (verifiche 11/12).</p>
              {data.open_findings.length ? <ul className="mt-3 divide-y divide-line">{data.open_findings.map((finding) => <li key={finding.id} className="py-3 text-sm"><span className="font-medium">{finding.section} · {finding.kind.replaceAll("_", " ")}</span><p className="mt-1">{finding.description}</p><p className="mt-1 text-xs text-muted">Prima segnalazione: {finding.first_raised.period}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">Nessun finding aperto.</p>}
            </section>

            <section id="domain-override" className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
              <h2 className="font-semibold">Registra una decisione umana</h2>
              <p className="mt-1 text-sm text-muted">L'override vale soltanto per la pratica corrente. Dopo il salvataggio le verifiche vengono ricalcolate.</p>
              <form onSubmit={saveOverride} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Ambito"><select value={override.scope} onChange={(event) => setOverride({ ...override, scope: event.target.value as OverrideRequest["scope"] })} className={fieldClass}><option value="section">Sezione</option><option value="item">Voce</option></select></Field>
                <Field label="Target"><input required value={override.target} onChange={(event) => setOverride({ ...override, target: event.target.value })} className={fieldClass} /></Field>
                <Field label="Decisione"><select value={override.decision} onChange={(event) => setOverride({ ...override, decision: event.target.value as OverrideRequest["decision"] })} className={fieldClass}><option value="✗">Skip (✗)</option><option value="N/A">N/A</option></select></Field>
                <Field label="Deciso da"><input value={override.decided_by || ""} onChange={(event) => setOverride({ ...override, decided_by: event.target.value })} className={fieldClass} /></Field>
                <Field label="Nota"><input required value={override.note} onChange={(event) => setOverride({ ...override, note: event.target.value })} placeholder="Motivazione della decisione" className={fieldClass} /></Field>
                <button disabled={busy} className={`${buttonClass} bg-ink text-white hover:bg-ink/90 md:col-span-2 xl:col-span-5`}>Salva override e ricalcola</button>
              </form>
            </section>
          </>
        ) : <div className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-12 text-center text-sm text-muted">Seleziona cliente e cartella per vedere lo stato delle verifiche.</div>}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{label}</span>{children}</label>;
}

function List({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>{count ? <ul className="mt-2 space-y-2 text-sm">{children}</ul> : <p className="mt-2 text-sm text-muted">{empty}</p>}</div>;
}
