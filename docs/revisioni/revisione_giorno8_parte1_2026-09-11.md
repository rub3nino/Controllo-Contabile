# Revisione — Giorno 8, parte 1 (interruttori per criterio, motore, JET-08A)

Data: 11 settembre 2026
Branch `codex/jet-toggle-criteri-motore`, commit `cd1000b`, dalla punta di `07757bf` (Giorno 7,
finestra di chiusura). Verificato indipendentemente, non sul riepilogo fornito.

## Scope

`git diff 07757bf..cd1000b --stat`: esattamente i sei file dichiarati, nessuno in più —
`backend/jet/models.py`, `backend/jet/criteri.py`, `tests/test_jet_criteri.py`,
`tests/test_jet_models.py`, `tests/test_jet_conti.py`, `tests/test_jet_store.py`. Nessun file UI
toccato, come richiesto.

## Lettura del codice

- `backend/jet/models.py`: i quattordici campi `attivo_*` sono nel blocco unico richiesto, subito dopo
  `soglia_da_investigare` e prima di `punteggio_profit_impact`. Undici a `True`, `attivo_conto_insolito_raro`
  e `attivo_conto_infragruppo_parte_correlata` a `False`, `attivo_finestra_chiusura` a `True` — coincide
  con la specifica. `soglia_da_investigare_effettiva: int = Field(ge=0)` aggiunto a `EsitoRigaJet`.
- `backend/jet/criteri.py`: ogni `attivo_X` è stato inserito nella condizione che già decideva `None` vs
  calcolabile per il criterio corrispondente (pattern `not parametri.attivo_X or <condizione esistente>`),
  senza toccare la logica di calcolo quando attivo. Confermato caso per caso: profit impact, oltre 10x
  media, sopra performance materiality, cifra tonda, weekend, festività, fuori orario, backdating (annulla
  correttamente sia `flag_backdated` che `flag_forward_dating` che `metodo_calcolo_backdating`), finestra
  di chiusura (annulla sia `flag_finestra_chiusura` che `flag_creata_dopo_chiusura`, correttamente
  entrambi legati allo stesso interruttore anche se avevano condizioni diverse prima), staff non
  autorizzato, parte correlata, conto insolito/raro, conto infragruppo/parte correlata.
- `flag_descrizione_vuota`: `parametri.attivo_descrizione_vuota and not descrizione` — resta `bool`, mai
  `None`, come richiesto esplicitamente (unico criterio a contratto non-nullable).
- Riproporzionamento: `criteri_standard_attivi` somma esattamente gli undici standard, esclude
  correttamente i due criteri conto e la finestra di chiusura. La condizione `1 <= criteri_standard_attivi
  < 8` è quella richiesta — il caso zero cade nel ramo `else` e mantiene `soglia_da_investigare` invariata
  (non zero), esattamente la nota speciale della specifica.
- `flag_e_pesi` e `contributo_weekend_festivita`: nessuna modifica di struttura, il meccanismo esistente
  (`flag is True`) esclude automaticamente i criteri disattivati perché il loro flag è `None` (o `False`
  per la descrizione vuota) — coerente, non richiede logica aggiuntiva.
- Nessuna modifica a `calendari.py`, `sequenza.py`, `ingest*.py`, `JetDashboard.tsx`, `api.ts`, come
  richiesto.

## Verifica manuale dei confini

- Sette criteri attivi: `round(4 * 7 / 11) = round(2.545...) = 3` — coincide col test.
- Otto criteri attivi: ricade nel ramo `else` (condizione `< 8` esclude 8), soglia resta 4 — coincide.
- Zero criteri attivi: ramo `else`, soglia resta 4, punteggio necessariamente 0 (nessun criterio può
  contribuire), quindi `da_investigare is False` — coincide.
- Quattro criteri attivi (esempio della specifica, sette disattivati su undici): soglia
  `round(4*4/11) = round(1.454...) = 1` — coincide.

## Suite — rieseguita da me, ambiente pulito

Il mount git dentro `device_bash` ha risposto correttamente stavolta (`git archive` diretto sul commit
`cd1000b`). La sandbox locale del device bridge non ha accesso di rete per installare le dipendenze
(cache pip assente, nessun proxy raggiungibile), quindi ho spostato l'archivio nel container cloud
(via `_verifica_scratch/` sul repository, stesso pattern già in uso per le fasi precedenti, poi
`device_stage_files`) e ho installato lì un venv nuovo con le sole dipendenze minime (niente
`paddleocr`/`redis`/`celery`/`minio`/`PyJWT`):

```
2 failed, 198 passed in 9.71s
```

Identico al riepilogo fornito. I due falliti sono `test_ocr.py` (PIL mancante), estranei a JET e attesi
in ambiente minimale. Rilanciando solo i quattro file di test JET coinvolti nel diff:

```
76 passed in 3.71s
```

Anche questo numero coincide col riepilogo.

## Nota operativa

Verifica basata sull'archivio `git archive`, non sulla cartella di lavoro live (che contiene modifiche
non tracciate estranee a questo prompt, coerente con la disciplina del progetto).

## Esito

**Approvato.** Nessuna richiesta di modifica al codice. Prossimo passo (non mio, operazione git di
Ruben): allineare `jet/sprint-15-controlli` alla punta consolidata Giorno 5 → 6 → 7 → questo prompt
(`cd1000b`), poi riprendere il prompt 36 (interruttori interfaccia) su quel branch, come già indicato
nella sua stessa sezione di consegna.
