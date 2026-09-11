# Revisione — Giorno 5 (retroattiva): pesi indicatori forti, media automatica, cifra tonda
# configurabile, calendari nazionali, integrazione calendari

Data: 11 settembre 2026 (revisione retroattiva, eseguita su richiesta esplicita di Ruben dopo aver
scoperto che questi cinque commit non avevano una revisione salvata nel repository)

Catena `bb50d42` → `5522f676` → `380475c9` → `3960f33d` → `23b2e6d` → `95df9ee`, tutti a parent singolo
(nessun merge, nessuna confusione di branch). Le fasi successive sulla stessa catena (`c307106`
retrodatazione, `07757bf` finestra di chiusura, `cd1000b` toggle motore) risultano invece già
regolarmente revisionate e approvate nei documenti `revisione_giorno6_2026-09-10.md`,
`revisione_giorno7_2026-09-10.md`, `revisione_giorno8_parte1_2026-09-11.md`, già presenti nel repository.

## Metodo usato

`device_bash` non riesce in questo momento a raggiungere `.git` nella cartella collegata (fallisce anche
un semplice `ls .git`, non solo `git diff`/`git archive`), quindi **non è stato possibile rilanciare la
suite di test in ambiente pulito per questi cinque commit** — riserva aperta, dichiarata esplicitamente,
diversa dalle fasi precedenti dove almeno lo scope era verificabile con `git diff` diretto. Ho invece
ricostruito lo scope camminando a mano sugli oggetti git (`device_stage_files` + `zlib.decompress` in
Python), confrontando gli alberi commit per commit dalla radice verso il basso, ed esaminato per intero
lo stato finale di `backend/jet/{models,criteri,calendari,pratica}.py` e `backend/jet/api.py` (già
verificati riga per riga in questa sessione), oltre a leggere i test dedicati
(`tests/test_jet_calendari.py`, `tests/test_jet_conti.py`).

## Scope verificato

- `5522f676` "fix(jet): allinea pesi indicatori forti": **un solo file**,
  `ui/src/jet/JetDashboard.tsx`. Confermato camminando l'albero fino al blob.
- `380475c9` "feat(jet): calcola media registrazioni automaticamente": tocca `backend/`, `tests/`, `ui/`
  (coerente con l'aggiunta di `calcola_media_assoluta_registrazioni` in `criteri.py`, il suo utilizzo in
  `api.py:790`, e la relativa esposizione in UI). Scope non disceso a livello di singolo file per motivi
  di tempo, ma il contenuto finale è verificato (vedi sotto).
- `3960f33d`, `23b2e6d`, `95df9ee`: non discesi a livello di blob per motivi di tempo; il loro effetto
  cumulativo è verificato leggendo lo stato finale dei file interessati (vedi sotto), che è lo stesso
  stato già preso a base dalla revisione approvata del Giorno 6.

## Verifica di contenuto

- **Media automatica**: `calcola_media_assoluta_registrazioni` in `criteri.py` esclude gli importi zero
  dal denominatore e restituisce `None` (mai zero) quando la popolazione è vuota o tutta a zero — coerente
  con la disciplina "mai un falso calcolabile". Confermato l'uso reale in `api.py:790`
  (`media_popolazione = calcola_media_assoluta_registrazioni(righe)`), non solo definita e inutilizzata.
- **Cifra tonda configurabile**: `soglia_importo_cifra_tonda: Decimal | None = Field(default=None, gt=0)`
  in `models.py`, usata in `criteri.py` come divisore (`importo % soglia == 0`). Lato UI, `ParamsPanel.tsx`
  espone `ROUND_PRESETS = [10000, 100000, 1000000]` — coerente con la soglia richiesta (10.000/100.000),
  con un terzo preset in più (1.000.000) non dannoso.
  Non testato che la UI serva davvero un menu a scelta invece di un numero libero: verifica visiva non
  eseguibile da questa sessione (nessun accesso al browser del Mac).
- **Calendari nazionali**: dataset `calendari.py` copre **9 Paesi** (IT, DE, FR, ES, IL, US, MT, IE, CY),
  non solo i 4 originariamente previsti (IT/DE/FR/ES) — estensione in più rispetto allo scope minimo
  concordato, ma coerente con l'impostazione "dataset statico curato" richiesta, ogni blocco Paese cita la
  fonte ufficiale usata. `test_jet_calendari.py` verifica copertura 2024-2030, ordinamento senza
  duplicati, alcune date puntuali per l'Italia 2026, e i casi limite di `giorni_lavorativi_tra`. Ho
  ricalcolato a mano `giorni_lavorativi_tra(2026-01-09, 2026-01-12, [5,6], [])` (venerdì→lunedì, un solo
  giorno lavorativo nell'intervallo aperto a sinistra) e coincide con l'atteso `1` verificato dal test.
- **Integrazione calendari nei controlli**: `valuta_riga` in `criteri.py` usa `calendari.giorni_weekend`/
  `calendari.festivita` come fallback quando `parametri.giorni_weekend`/`parametri.festivita` non sono
  configurati esplicitamente, altrimenti li unisce (`set(base) | set(parametri.festivita or [])`) — il
  parametro esplicito del cliente resta sempre disponibile come override/aggiunta, mai sovrascritto dal
  dataset statico. Comportamento corretto e prudente.

## Difetto trovato — non presente nel riepilogo, trovato da me

`punteggio_parte_correlata` (il peso del criterio "keyword parti correlate/frode", punto 15 della
tabella dei 15 controlli) **è rimasto a `1`** in `EMPTY` (`ui/src/jet/JetDashboard.tsx`, riga 73),
mentre `punteggio_festivita`, `punteggio_backdated`, `punteggio_staff_non_autorizzato` e
`punteggio_descrizione_vuota` sono stati correttamente allineati a `4` nello stesso commit. La tabella
originale dei 15 controlli include esplicitamente "keyword" tra i cinque pesi da correggere a 4. Confermato
col diff letterale del commit `5522f676` (`punteggio_parte_correlata: 1,` non tocca la riga) e con lo
stato attuale del file. **Nessuna correzione applicata da me**: la propongo nel prossimo prompt insieme al
controllo "conto >10 cifre", come piccola correzione indipendente.

## Suite di test

**Non rilanciata in modo indipendente** per questa catena di 5 commit — riserva aperta dichiarata
esplicitamente, dovuta all'indisponibilità di `.git` da `device_bash` in questo momento. Le fasi
successive sulla stessa base di codice (Giorno 6, 7, 8 parte 1) sono state invece rieseguite con successo
in ambiente pulito con conteggi coincidenti al riepilogo fornito all'epoca (198 passed / 2 failed attesi
per `test_ocr.py`, poi 76 passed sui soli test JET del diff Giorno 8 parte 1) — un indizio indiretto ma
non equivalente a un'esecuzione diretta su questi 5 commit.

## Esito

**Approvato con una correzione da fare** (peso `punteggio_parte_correlata` ancora a 1 invece di 4) e
**una riserva aperta** (suite di test non rieseguibile indipendentemente per il guasto di `device_bash`
su `.git`). Nessun altro problema di scope o di contenuto trovato. La correzione del peso verrà inclusa
nel prossimo prompt.
