# Prompt — JET: precompilazione di prova per il form "Crea un nuovo profilo" (fuori sprint 15 controlli) (Quadra — modulo JET)

## Contesto

Non è uno dei 15 controlli dello sprint: è un aiuto per i test manuali di Ruben, nello stesso spirito del
pulsante "Compila preset di prova" già presente (`ui/src/jet/presetProva.ts`, che precompila i parametri
cliente). Questo prompt fa la stessa cosa per il form "Crea un nuovo profilo" nella sezione "2. Fonti e
mappatura/profilo" di `ui/src/jet/JetDashboard.tsx" (il blocco con `Nome profilo` e la griglia
`MAP_FIELDS.map(...)` con gli input Inizio/Fine per ogni campo).

Oggi, quando Ruben testa manualmente un file TXT/PDF a colonne fisse che non ha un'intestazione
riconoscibile automaticamente, deve compilare a mano `profileName` e, per ciascuno degli undici campi di
`MAP_FIELDS`, due numeri (`Inizio`/`Fine esclusiva`) partendo da campi vuoti. Il pulsante nuovo serve solo
a dargli un punto di partenza compilato con valori fittizi non sovrapposti, che poi lui corregge a mano
guardando le posizioni reali nel file (mostrate sopra, in `Intestazione e righe di esempio`). **Non deve
avere alcuna pretesa di correttezza sui dati reali** — è puro scaffolding per non scrivere ventidue numeri
da zero ogni volta.

Verificato sul codice reale (branch `jet/sprint-15-controlli`, dopo il commit che porta il preset di prova
attuale — usa quella punta esatta, non indovinarla): lo stato `positions` è
`useState<Record<string, {start: string; end: string}>>({})`, `profileName` è uno `useState<string>("")`,
`MAP_FIELDS` è l'array di undici stringhe già presente, `createProfile` legge `positions`/`profileName`
filtrando le voci con `start`/`end` non vuoti.

## Cosa implementare

Tutto in `ui/src/jet/JetDashboard.tsx`, più eventualmente una nuova costante in
`ui/src/jet/presetProva.ts` (per coerenza con dove vivono già le costanti di test — la funzione
`presetProva`/`PROVA_CLIENT` sono lì). Nessuna modifica a `backend/`, a `ui/src/jet/api.ts`, né alla
logica di `createProfile`/`applyProfile`/`suggestMapping`/`mappingIsReady`.

**1. In `ui/src/jet/presetProva.ts`**, aggiungi le due costanti (posizioni non sovrapposte, in questo
ordine esatto — non inventarne altre):

```typescript
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
```

**2. In `JetDashboard.tsx`**, importa le due nuove costanti da `./presetProva` insieme a quelle già
importate. Aggiungi una funzione (vicino a `fillPreset`, stesso stile):

```tsx
const fillProfiloProva = () => {
  const giaCompilato =
    profileName.trim() !== "" ||
    Object.values(positions).some((x) => x.start !== "" || x.end !== "");
  if (
    giaCompilato &&
    !window.confirm("Sostituire nome e posizioni già inseriti con i valori di prova?")
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
```

**3. Pulsante nuovo**, posizionato subito sopra o accanto al blocco `<Field label="Nome profilo">`
(dentro `<div className="border-t border-border-muted pt-lg">`, prima o dopo l'intestazione "Crea un
nuovo profilo" — scegli la posizione che si incastra meglio nel layout esistente senza spostare gli altri
elementi), stile coerente con `ghostButtonClass` (già usato da "Compila preset di prova"):

```tsx
<button
  type="button"
  disabled={busy}
  onClick={fillProfiloProva}
  className={ghostButtonClass}
>
  Compila posizioni di prova
</button>
```

Il pulsante **non chiama alcuna API** e non salva nulla da solo: riempie solo lo stato locale del form,
esattamente come "Compila preset di prova" fa per i parametri. Il salvataggio resta un'azione separata di
Ruben tramite "Salva e applica profilo", invariato.

## Cosa NON fare

- Non toccare `backend/` in nessun file.
- Non cambiare `createProfile`, `applyProfile`, `suggestMapping`, `mappingIsReady`, `configureNewSource`:
  restano esattamente come sono.
- Non inventare posizioni diverse da quelle elencate sopra, né un ordine diverso dei campi.
- Non far scomparire o disabilitare il pulsante in base a `provaMode`: dev'essere sempre visibile e
  utilizzabile, anche su una pratica non di prova — serve per qualunque test manuale, non solo per la
  pratica `Prova JET`.
- Non salvare automaticamente il profilo al click: il pulsante compila solo il form, il salvataggio resta
  un'azione separata dell'utente.
- Non rimuovere la conferma (`window.confirm`) quando il form ha già qualcosa scritto: previene di
  perdere per sbaglio una mappatura reale già inserita a mano.

## Verifica richiesta prima della consegna

Nessuna modifica al backend, quindi non serve rilanciare la suite Python. Serve il controllo TypeScript in
un checkout pulito (`git archive`, non la cartella live): il comando esatto del progetto
(`npx tsc --noEmit` dalla cartella `ui/`, o quanto risulta da `package.json`/CI). Incolla l'output
letterale, anche se pulito.

## Consegna

Commit diretto su `jet/sprint-15-controlli`, **sulla punta dopo che Ruben ha committato il preset di prova
attuale** (pratica fittizia + `presetProva.ts` + mappatura automatica) — verifica con `git log -1` che
quel lavoro sia già nella storia del branch prima di iniziare; se non lo è ancora, segnalalo invece di
procedere su una base incompleta. Nessun push né PR. Nel riepilogo: file toccati, hash del commit di base
da cui sei partito, conferma che il controllo TypeScript passa in ambiente pulito.
