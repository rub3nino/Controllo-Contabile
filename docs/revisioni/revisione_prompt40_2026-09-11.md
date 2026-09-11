# Revisione — Prompt 40 (conto >10 cifre, fix peso parte correlata)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `196edbe`, parent `ab0a56f` (il mio commit di sola
documentazione), che a sua volta è parent `569bf4e` (ultimo commit di codice approvato).
Verificato indipendentemente, non sul riepilogo fornito.

## Metodo

`device_bash` continua a non riuscire a raggiungere `.git` nella cartella collegata. Scope e contenuto
verificati camminando a mano sugli oggetti git (`device_stage_files` + decompressione `zlib` in Python),
scendendo l'albero dei commit `ab0a56f` → `196edbe` fino al singolo blob per ognuno dei sei file
dichiarati.

## Scope

Esattamente i sei file dichiarati, nessuno in più: `backend/jet/models.py`, `backend/jet/criteri.py`,
`tests/test_jet_conti.py`, `ui/src/jet/api.ts`, `ui/src/jet/ParamsPanel.tsx`,
`ui/src/jet/JetDashboard.tsx`. `libro_gioranel.csv` correttamente rimasto fuori dal commit, come
dichiarato nel riepilogo.

## Lettura del codice

- `backend/jet/models.py`: `attivo_conto_lunghezza: bool = False` e
  `punteggio_conto_lunghezza: int | None = Field(default=None, ge=0)` nella posizione richiesta, accanto
  ai due criteri di conto analoghi. `flag_conto_lunghezza: bool | None = None` aggiunto a `EsitoRigaJet`.
- `backend/jet/criteri.py`: il blocco è posizionato esattamente come richiesto, subito dopo
  `flag_conto_infragruppo_parte_correlata`. Confermato `cifre = sum(carattere.isdigit() for carattere in
  riga.conto_contabile)` — conta solo cifre numeriche, non lunghezza totale della stringa, come richiesto
  esplicitamente. Soglia `> 10` (non `>= 10`), coerente col nome del controllo. `flag_conto_lunghezza` è
  `None` quando il criterio è disattivato o `conto_contabile` è assente — mai `False`, disciplina
  rispettata. Aggiunto correttamente alla tupla `flag_e_pesi` e alla costruzione finale di
  `EsitoRigaJet`. **Confermato che `attivo_conto_lunghezza` non è stato aggiunto al conteggio
  `criteri_standard_attivi`**: il blocco che lo calcola non risulta toccato dal diff.
- `tests/test_jet_conti.py`: tutti e cinque i casi richiesti presenti. Ricalcolato a mano il caso più
  delicato (`test_conto_alfanumerico_conta_solo_le_cifre`, conto `"IC-1234567890123"`): 13 cifre
  numeriche, `> 10` → `True`, coerente con l'asserzione. Verificato anche il confine
  (`test_conto_con_esattamente_dieci_cifre_non_flaggato`, 10 cifre esatte → `False`, non `True`) —
  conferma che il controllo è correttamente "più di 10", non "almeno 10".
- `ui/src/jet/api.ts`: i due campi aggiunti a `JetParams` nella posizione richiesta, stesso stile dei
  campi analoghi.
- `ui/src/jet/JetDashboard.tsx`: `punteggio_parte_correlata` corretto da `1` a `4` in `EMPTY` — unica
  modifica a quella riga, nessun altro peso toccato. Aggiunti `punteggio_conto_lunghezza: null` e
  `attivo_conto_lunghezza: false` in `EMPTY`, coerenti con gli altri due criteri di conto opzionali.
- `ui/src/jet/ParamsPanel.tsx`: esisteva già una riga placeholder per il controllo id `"14"` (che non
  conoscevo, verosimilmente aggiunta dal refactor di Cursor come "assente/non disponibile") — aggiornata
  correttamente sul posto, non duplicata: `status: "presente"`, `available: true`, `flagKeys`,
  `attivoKeys`, `pesi` tutti popolati coerentemente col nuovo criterio. La voce descrittiva aggiunta
  (obiettivo/rischio/campi/regola/limitazioni/eccezione) è accurata e dichiara esplicitamente sia la
  soglia fissa sia il conteggio solo-cifre. Nessuna modifica a `ControlFields` — corretto, il controllo
  non ha parametri propri oltre a peso e interruttore, il rendering di default lo gestisce già (come per
  il controllo "descrizione vuota").

## Suite di test

```
205 passed, 7 warnings in 4.08s
```
Nessun fallimento su `test_ocr.py` questa volta (a differenza delle esecuzioni precedenti, dove
mancava `PIL`): coerente con un ambiente di verifica diverso da quello minimale usato in questa sessione
per le fasi precedenti, non un problema del codice JET. Il conteggio è coerente con l'atteso: 198 passed
(base Giorno 8 parte 1) + 2 (`test_ocr.py`, qui passati invece che falliti) + 5 nuovi test di questo
prompt = 205.

**Non rieseguita da me in modo indipendente** in ambiente pulito, per lo stesso guasto di `device_bash`
su `.git` già dichiarato nella revisione precedente — riserva aperta. La verifica di contenuto sopra
(lettura completa del codice e ricalcolo a mano dei casi limite) resta comunque solida.

## Nota non bloccante

Il riepilogo segnala una discrepanza preesistente tra `package.json` e `package-lock.json` che impedisce
`npm ci` (aggirata con `npm install` nella copia temporanea per eseguire `tsc`). Non riguarda questo
prompt e non blocca l'approvazione, ma andrebbe sistemata da Ruben prima che diventi un problema per un
ambiente CI/deploy futuro.

## Esito

**Approvato.** Nessuna richiesta di modifica al codice.
