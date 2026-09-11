# Prompt — JET: default orario 8-18 e conferma peso infragruppo (Giorno 8/15, parte 3) (Quadra — modulo JET)

## Contesto

Due correzioni piccole e indipendenti, emerse durante la revisione del prompt 36:

1. Il pannello "scopo del controllo" (aggiunto dal prompt 36) dichiara che l'orario ufficio è
   "precompilato 8:00–18:00, sempre modificabile" — ma questo default non è mai stato implementato:
   `EMPTY` ha ancora `orario_ufficio_inizio: null` e `orario_ufficio_fine: null`. Era comunque già nel
   piano originale dello sprint ("settimana facile": default 8–18 per l'orario). Questo prompt lo
   implementa, allineando il codice a quanto il pannello già dichiara.
2. Ruben ha confermato che il peso per "conto infragruppo/parte correlata"
   (`punteggio_conto_infragruppo_parte_correlata`) va considerato **approvato dal partner**, non più
   "proposto" — va quindi tolto da `PESI_PROPOSTI`.

Entrambe le modifiche sono in `ui/src/jet/JetDashboard.tsx`, nessun altro file coinvolto.

## Passo 0 — obbligatorio, prima di toccare qualunque file

Come nei prompt precedenti: più agenti lavorano in parallelo sulla stessa cartella condivisa.

1. `git branch --show-current` — deve risultare `jet/sprint-15-controlli`. Se non lo è, fai
   `git checkout jet/sprint-15-controlli` (solo checkout, nessun merge, nessun nuovo branch).
2. `git log -1 --oneline` — alla mia ultima verifica il branch era a `1a98113`. Se è diverso non è
   necessariamente un problema, ma riporta l'hash esatto nel riepilogo.
3. `git status --short -- ui/src/jet/` — deve risultare vuoto. Se non lo è, **fermati e segnala cosa
   trovi, senza scartarlo né correggerlo di tua iniziativa**.

Se un controllo fallisce, non procedere: scrivi nel riepilogo cosa hai trovato e fermati lì.

## Cosa implementare

Tutto in `ui/src/jet/JetDashboard.tsx`.

**1. Default orario ufficio.** Nell'oggetto `EMPTY`, cambia:
```ts
orario_ufficio_inizio: null,
orario_ufficio_fine: null,
```
in:
```ts
orario_ufficio_inizio: "08:00",
orario_ufficio_fine: "18:00",
```
Nessun altro valore di `EMPTY` va toccato. Il campo resta un normale input di tipo `time`, già presente
e già modificabile dall'utente — questa modifica cambia solo il valore iniziale di una pratica nuova,
non introduce alcuna logica nuova.

**2. Rimuovi `punteggio_conto_infragruppo_parte_correlata` da `PESI_PROPOSTI`.** L'insieme diventa:
```ts
const PESI_PROPOSTI = new Set<keyof JetParams>([
  "punteggio_backdated",
  "punteggio_festivita",
  "punteggio_staff_non_autorizzato",
  "punteggio_descrizione_vuota",
  "punteggio_parte_correlata",
  "punteggio_conto_insolito_raro",
]);
```
Effetto in interfaccia: l'etichetta del peso per "Conto infragruppo" passa da "peso proposto" a "peso
approvato dal partner" — nessun'altra modifica necessaria, la logica di visualizzazione esiste già dal
prompt 36.

## Cosa NON fare

- Non toccare `backend/` in nessun file.
- Non toccare `SCOPO_CONTROLLI`, `WEIGHTS`, la legenda a quattro stati, o qualunque altra parte del
  file introdotta dal prompt 36: restano invariate.
- Non estendere il default 8–18 ad altri campi (es. weekend, festività): riguarda solo
  `orario_ufficio_inizio`/`orario_ufficio_fine`.
- **Non toccare, scartare o committare alcun file che non sia `ui/src/jet/JetDashboard.tsx`.** Più
  agenti lavorano in parallelo: se trovi modifiche non committate estranee a questo prompt, fermati e
  segnalale, non deciderle tu.

## Verifica richiesta prima della consegna

Nessuna modifica al backend, quindi non serve rilanciare la suite Python. Serve `npx tsc --noEmit`
dalla cartella `ui/`, in un checkout pulito (`git archive`, non la cartella live). Incolla l'output
letterale, anche se pulito (dato che questa è una modifica puramente di valori, non di tipi, non mi
aspetto errori — ma va comunque eseguito).

## Consegna

Commit diretto su `jet/sprint-15-controlli`. Nessun push né PR. **Committa esclusivamente
`ui/src/jet/JetDashboard.tsx`**, nessun altro file. Nel riepilogo: branch e commit di partenza
effettivi, conferma che il diff riguarda solo le due modifiche sopra (nient'altro in `EMPTY`, nient'altro
in `PESI_PROPOSTI`), e l'output letterale di `npx tsc --noEmit`.
