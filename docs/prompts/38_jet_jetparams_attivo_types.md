# Prompt — JET: aggiunge i tipi `attivo_*` a `JetParams` (preparatorio al prompt 36)

## Contesto

Il prompt 35 (parte 1, motore) ha introdotto quattordici campi `attivo_<nome>` in
`ParametriClienteJet` (`backend/jet/models.py`), vietando esplicitamente di toccare
`ui/src/jet/JetDashboard.tsx` e `ui/src/jet/api.ts` in quella fase. Il prompt 36 (parte 2,
interruttori nell'interfaccia) presuppone però che quei quattordici campi siano già dichiarati nel tipo
`JetParams` lato frontend — non lo sono: è una falla nella sequenza dei prompt, non un errore di chi ha
implementato 35 o 36. Verificato da me sul codice attuale (`grep attivo_ backend/jet/models.py` dà i
quattordici campi; `JetParams` in `ui/src/jet/api.ts` non ne contiene nessuno).

Questo prompt è **solo un allineamento di tipi**: nessuna logica, nessuna interfaccia, nessun default.
Va eseguito prima del prompt 36, sullo stesso branch `jet/sprint-15-controlli`.

## Cosa implementare

Due file: `ui/src/jet/api.ts` (il tipo) e, per la sola aggiunta a `EMPTY` descritta più sotto,
`ui/src/jet/JetDashboard.tsx` — nessun altro file. Nel tipo `JetParams`, subito dopo il campo
`punteggio_conto_infragruppo_parte_correlata` e prima della chiusura `};`, aggiungi esattamente questi
quattordici campi, nello stesso ordine con cui compaiono in `backend/jet/models.py`, tutti di tipo
`boolean` (nel backend sono `bool` con un default sempre presente, mai `Optional` — quindi mai `null`
lato frontend):

```ts
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
attivo_finestra_chiusura: boolean;
```

Non serve alcun valore di default nel tipo (un `type`/`interface` TypeScript non ne ha): questi campi
diventano semplicemente leggibili/scrivibili su `params` come già lo sono tutti gli altri.

**Aggiornamento obbligato di `EMPTY`.** In `ui/src/jet/JetDashboard.tsx` esiste una costante
`const EMPTY: JetParams = {...}` (oggetto letterale completo, usato per inizializzare una pratica senza
parametri). Aggiungere i quattordici campi obbligatori al tipo senza aggiornare anche `EMPTY` fa fallire
subito la compilazione (proprietà mancanti sull'oggetto letterale) — quindi questo prompt include anche
questa singola aggiunta, non è una scelta discrezionale: i valori sono un mirror esatto dei default già
approvati lato backend nel prompt 35 (`backend/jet/models.py`), nessun valore nuovo da inventare.
Aggiungi in `EMPTY`, stesso ordine, subito dopo `punteggio_conto_infragruppo_parte_correlata: null,`:

```ts
attivo_profit_impact: true,
attivo_oltre_dieci_volte_media: true,
attivo_sopra_performance_materiality: true,
attivo_importo_cifra_tonda: true,
attivo_weekend: true,
attivo_festivita: true,
attivo_fuori_orario: true,
attivo_backdated: true,
attivo_staff_non_autorizzato: true,
attivo_parte_correlata: true,
attivo_descrizione_vuota: true,
attivo_conto_insolito_raro: false,
attivo_conto_infragruppo_parte_correlata: false,
attivo_finestra_chiusura: true,
```

## Cosa NON fare

- Non toccare `backend/` in nessun file: i campi esistono già lì dal prompt 35, non vanno ridefiniti né
  modificati.
- Non toccare `ui/src/jet/JetDashboard.tsx` **oltre** alla sola aggiunta a `EMPTY` indicata sopra:
  nessun interruttore, nessuna UI, nessun'altra modifica in questo prompt — è compito del prompt 36,
  che segue.
- Non aggiungere altri campi a `JetParams` oltre ai quattordici elencati, anche se noti altre
  discrepanze tra backend e frontend: segnalale nel riepilogo invece di correggerle qui.
- Non cambiare i valori di default elencati sopra per `EMPTY`: devono coincidere esattamente con quelli
  già approvati nel backend (prompt 35) — se pensi che uno sia sbagliato, segnalalo nel riepilogo invece
  di modificarlo.

## Verifica richiesta prima della consegna

Nessuna modifica al backend, quindi non serve rilanciare la suite Python. Serve il controllo
TypeScript in un checkout pulito (`git archive`, non la cartella di lavoro live): `npx tsc --noEmit`
dalla cartella `ui/`. Incolla l'output letterale, anche se pulito, ed elenca ogni eventuale errore
(compreso un possibile errore su `EMPTY`, vedi sopra) invece di risolverlo di tua iniziativa.

## Consegna

Commit diretto su `jet/sprint-15-controlli`, a partire dalla punta attuale (`37ad405`). Nessun push né
PR, come sempre. Nel riepilogo: conferma che i soli file toccati sono `ui/src/jet/api.ts` e
`ui/src/jet/JetDashboard.tsx` (solo l'aggiunta a `EMPTY`), l'output letterale di `npx tsc --noEmit`, e
qualunque errore o dubbio emerso invece di risolverlo autonomamente.
