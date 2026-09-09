/**
 * JetPage — Journal Entry Testing (ISA 240)
 *
 * Pagina di stato che mostra il lavoro già svolto sul modulo JET.
 * I numeri riportati sono risultati reali di test già eseguiti.
 * NON è ancora uno strumento operativo.
 */

import { Icon, Card, CardHeader, Callout } from "../components";

// ─────────────────────────────────────────────────────────────────────────────
// Dati reali di test (costanti, non da API)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_RESULTS = {
  cliente1: {
    nome: "Cliente 1 (SAP, formato Excel)",
    registrazioni: 213656,
    note: "Risultati coincidenti esattamente con il foglio Excel storico già in uso dal team.",
  },
  cliente2: {
    nome: "Cliente 2 (stampa gestionale)",
    registrazioni: 56133,
    note: "Formato di export completamente diverso, una stampa del gestionale, non un file Excel.",
  },
} as const;

const COMPLETED_PHASES = [
  {
    id: 1,
    title: "Definizione dei contratti dati",
    description: "Schema di validazione per i campi richiesti dal libro giornale.",
  },
  {
    id: 2,
    title: "Ingest dei file del gestionale",
    description: "Parser robusto per formati Excel e stampe testuali.",
  },
  {
    id: 3,
    title: "Replica degli undici criteri di rischio storici",
    description: "Implementazione dei criteri ISA 240 §A44 già in uso dal team.",
  },
  {
    id: 4,
    title: "Copertura della dimensione 'conto'",
    description: "Frequenza d'uso, conti insoliti, conti infragruppo.",
  },
  {
    id: 5,
    title: "Correzioni di robustezza",
    description: "Fix emersi da test su dati reali di due clienti diversi.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function JetPage() {
  return (
    <div className="space-y-lg">
      {/* ─── Header ─── */}
      <header>
        <h1 className="text-headline-lg text-ink-primary">
          JET — Journal Entry Testing
        </h1>
        <p className="mt-sm text-body-lg text-ink-secondary max-w-3xl">
          Analisi del libro giornale secondo i criteri di rischio del principio ISA 240 §A44:
          conti insoliti, importi a cifra tonda, registrazioni fuori orario o festive,
          personale non autorizzato, parti correlate, e altri.
        </p>
      </header>

      {/* ─── Timeline fasi completate ─── */}
      <Card>
        <CardHeader>Fasi completate</CardHeader>
        <ul className="space-y-md">
          {COMPLETED_PHASES.map((phase) => (
            <li key={phase.id} className="flex items-start gap-md">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-status-green-bg flex items-center justify-center mt-xxs">
                <Icon name="check" size="sm" className="text-status-green-text" />
              </div>
              <div className="min-w-0">
                <div className="text-label-md text-ink-primary">{phase.title}</div>
                <div className="text-body-sm text-ink-secondary mt-xxs">
                  {phase.description}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* ─── Risultati di test reali ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-base">
        <Card>
          <CardHeader
            trailing={
              <span className="inline-flex items-center gap-xs text-status-green-text">
                <Icon name="verified" size="sm" />
                <span className="text-label-sm">Verificato</span>
              </span>
            }
          >
            {TEST_RESULTS.cliente1.nome}
          </CardHeader>
          <div className="space-y-md">
            <div>
              <div className="text-headline-lg text-ink-primary font-mono">
                {TEST_RESULTS.cliente1.registrazioni.toLocaleString("it-IT")}
              </div>
              <div className="text-body-sm text-ink-secondary">
                registrazioni contabili analizzate
              </div>
            </div>
            <p className="text-body-md text-ink-secondary">
              {TEST_RESULTS.cliente1.note}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            trailing={
              <span className="inline-flex items-center gap-xs text-status-green-text">
                <Icon name="verified" size="sm" />
                <span className="text-label-sm">Verificato</span>
              </span>
            }
          >
            {TEST_RESULTS.cliente2.nome}
          </CardHeader>
          <div className="space-y-md">
            <div>
              <div className="text-headline-lg text-ink-primary font-mono">
                {TEST_RESULTS.cliente2.registrazioni.toLocaleString("it-IT")}
              </div>
              <div className="text-body-sm text-ink-secondary">
                registrazioni ingerite e analizzate con successo
              </div>
            </div>
            <p className="text-body-md text-ink-secondary">
              {TEST_RESULTS.cliente2.note}
            </p>
          </div>
        </Card>
      </div>

      {/* ─── Criteri ISA 240 implementati ─── */}
      <Card>
        <CardHeader>Criteri di rischio ISA 240 §A44</CardHeader>
        <p className="text-body-md text-ink-secondary mb-md">
          I seguenti criteri sono stati implementati e verificati sui dati di test:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm">
          {[
            "Conti insoliti",
            "Importi a cifra tonda",
            "Registrazioni fuori orario",
            "Registrazioni in giorni festivi",
            "Utenti non autorizzati",
            "Parti correlate",
            "Conti infragruppo",
            "Prima/ultima registrazione del periodo",
            "Registrazioni manuali vs automatiche",
            "Concentrazione su singoli utenti",
            "Storno di registrazioni precedenti",
          ].map((criterio) => (
            <div
              key={criterio}
              className="flex items-center gap-sm px-md py-sm rounded bg-surface-sidebar"
            >
              <Icon name="check_circle" size="sm" className="text-status-green-text flex-shrink-0" />
              <span className="text-body-sm text-ink-primary">{criterio}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Prossimamente ─── */}
      <Card className="border-dashed">
        <div className="flex items-start gap-lg">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-tint-blue-bg flex items-center justify-center">
            <Icon name="upload_file" size="lg" className="text-tint-blue-text" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-headline-sm text-ink-primary mb-xs">
              Prossimamente: Area operativa
            </h3>
            <p className="text-body-md text-ink-secondary mb-md">
              In questa sezione sarà possibile caricare un file del libro giornale
              e avviare un'analisi JET completa. La funzionalità è in fase di
              finalizzazione e sarà disponibile a breve.
            </p>
            <Callout variant="info">
              <div className="flex items-center gap-sm text-body-sm">
                <Icon name="info" size="sm" className="text-tint-blue-text" />
                <span className="text-tint-blue-text">
                  Per richieste urgenti o test su nuovi formati, contatta il team di sviluppo.
                </span>
              </div>
            </Callout>
          </div>
        </div>
      </Card>
    </div>
  );
}
