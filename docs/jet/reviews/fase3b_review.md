# Revisione JET Fase 3b — esclusione utenti di sistema dal criterio staff

Branch: `jet/fase3b-utenti-sistema` (sopra `jet/fase3-criteri`, approvato), commit `269f344`.

## Verifica del codice

`git diff jet/fase3-criteri..jet/fase3b-utenti-sistema --stat`: **4 file, esattamente quelli
dichiarati**, 40 inserimenti / 1 rimozione. Letto il diff completo (non solo lo stat): la modifica a
`criteri.py` aggiunge la condizione `utenti_di_sistema` all'`if` che già gestiva "non calcolabile",
nello stesso posto logico, senza toccare nient'altro — esattamente il minimo intervento richiesto.
`ParametriClienteJet.utenti_di_sistema` ha una descrizione che chiarisce bene la distinzione
concettuale (non è "autorizzato", è "il criterio non si applica a un processo"). I due nuovi test
coprono correttamente sia il caso con lista fornita sia l'assenza di esclusione implicita quando
`utenti_di_sistema=None` — quest'ultimo era il test giusto da scrivere: garantisce che il default
resti "nessuna esclusione", non silenziosamente più permissivo.

## Verifica indipendente

Suite in ambiente pulito (`git archive` + venv nuovo): **103 passati, 0 falliti** (101 della Fase 3
+ 2 nuovi) — coincide con la mia riesecuzione, non con i "114" di Codex, stessa causa già segnalata
due volte (file non tracciati nella cartella di lavoro).

Rieseguita io stesso la validazione sul file reale: **identica a quella riportata**
(`utenti_di_sistema_esclusi=178.992`, `staff_non_autorizzato=11.626`, `da_investigare=11.804`,
`sopra_pm=1.104`, `cifra_tonda=19.196`, `buchi_sequenza=0`).

## Sui 11.626 residui — non mi sono fermato al numero

Corretto non aver forzato la corrispondenza a 184: sarebbe stato esattamente il tipo di scorciatoia
che il progetto vieta. Ho voluto capire cosa c'è dentro quei 11.626, elencando gli utenti distinti
esclusi sia dai 38 autorizzati sia dai due account di sistema: **35 utenti**, in cima
`VAVANTARIO` (7.206 righe) e `INTLORDERS` (2.193) — poi un gruppo eterogeneo con volumi da poche a
poche centinaia di righe. Due osservazioni utili per la decisione col cliente, non per il codice:

- `BASWARE` (315 righe) e `INTLORDERS` (2.193) hanno tutta l'aria di essere altre interfacce
  automatiche (Basware è una piattaforma nota di fatturazione elettronica/AP automation), non
  persone — andrebbero probabilmente aggiunte a `utenti_di_sistema` dopo conferma, non per
  assunzione mia.
- Compare anche un utente `0` (855 righe, letteralmente il valore zero, non una stringa) — quasi
  certamente un dato mancante o un placeholder nel gestionale, non un utente reale.
- `VAVANTARIO` con 7.206 registrazioni è l'unico caso che sembra davvero una persona con volume
  alto e non autorizzata: o l'elenco dei 38 è incompleto/non aggiornato, o è un caso da investigare
  per davvero.

Non ho aggiunto nulla alla lista `utenti_di_sistema` — è la stessa disciplina già seguita per
festività/parole chiave/staff: mai inventare, il cliente decide sulla base di questi elementi.

## Verdetto

Fase 3b approvata. Modifica minima, corretta, verificata anche riga per riga sul diff. Il residuo di
11.804 "da investigare" è ora un output di audit legittimo (non un artefatto tecnico) su cui la
prossima azione è una conversazione con chi conosce il cliente Nordson, non altro codice.

## Verso la Fase 4

Con Fase 3 completa e verificata, il prossimo passo del piano concordato è colmare il gap sulla
dimensione conto (frequenza/rarità del conto, conti infragruppo/parti correlate) — gli unici tre
campi di `EsitoRigaJet` ancora sempre `None`. Prompt allegato.
