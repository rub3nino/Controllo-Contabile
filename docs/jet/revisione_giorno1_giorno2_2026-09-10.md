# Revisione — Giorno 1 (pesi indicatori forti) e Giorno 2 (media automatica JET-02)

Data: 10 settembre 2026
Verificato indipendentemente, non sul riepilogo fornito.

## Giorno 1 — branch `codex/jet-pesi-indicatori-forti`, commit `5522f67`

Scope del diff (`git diff main...5522f67 --stat`): un solo file, `ui/src/jet/JetDashboard.tsx`,
4 inserimenti/4 cancellazioni — esattamente e soltanto i quattro valori dichiarati nel prompt 27
(`punteggio_festivita`, `punteggio_backdated`, `punteggio_staff_non_autorizzato`,
`punteggio_descrizione_vuota` da 1 a 4). Nessun file in più, nessun altro campo toccato.

Nota: il prompt 27 era stato scritto contro l'oggetto `EMPTY` in `JetDashboard.tsx` prima che un
altro agente, in parallelo e su un fronte non correlato (redesign UI), rendesse quell'oggetto
obsoleto nella working directory locale non committata. Il branch `5522f67` è stato creato prima
di quel redesign, quindi l'oggetto esisteva ancora: nessun conflitto, il commit è valido e
autosufficiente.

**Esito: approvato.**

## Giorno 2 — branch `codex/jet-media-automatica`, commit `380475c` (dalla punta di `5522f67`)

Scope del diff (`git diff 5522f67..380475c --stat`): sette file, tutti dichiarati nel prompt 28 e
nessuno in più — `backend/jet/api.py`, `backend/jet/criteri.py`, `backend/jet/pratica.py`,
`tests/test_jet_api.py`, `tests/test_jet_criteri.py`, `ui/src/jet/JetDashboard.tsx`,
`ui/src/jet/api.ts`.

Lettura integrale del diff (non a campione):

- `calcola_media_assoluta_registrazioni` in `criteri.py`: media dei valori assoluti, zeri esclusi
  dal denominatore, `None` (mai zero) su popolazione vuota o di soli zeri — corretto, coerente con
  la disciplina "mai un `False`/zero fittizio" del modulo.
- `valuta_riga` accetta il nuovo parametro `media_registrazione_popolazione` in coda, con default
  `None`: non rompe le firme posizionali esistenti. La precedenza è corretta — il valore manuale in
  `parametri.valore_medio_registrazione` vince sempre quando presente.
- In `api.py`, la media si calcola una sola volta per l'intera popolazione della pratica prima del
  ciclo di valutazione riga per riga, sullo stesso schema già usato per `calcola_frequenza_conti` —
  nessuna ricomputazione per riga.
- `PraticaJet.valore_medio_registrazione_effettivo` registra il valore realmente usato dal motore
  (manuale se impostato, altrimenti calcolato), non semplicemente il numero calcolato a
  prescindere: corretto, è quello che serve per la verifica a mano.
- Interfaccia: il valore compare accanto a righe/da investigare, formattato in euro con due
  decimali, con un trattino esplicito quando `null` invece di un vuoto silenzioso o uno zero.

Test aggiunti, letti per intero: coprono valori assoluti misti positivi/negativi con esclusione
degli zeri (verificato a mano: importi 10, -20, 0 → media attesa 15, corretto), popolazione vuota e
popolazione di soli zeri parametrizzate insieme (entrambe devono dare `None`), precedenza del
valore manuale su quello di popolazione con un caso costruito apposta perché i due valori diano
esiti opposti sul flag (dimostra realmente la precedenza, non solo che il campo è settato), e un
test a livello API che calcola la media attesa direttamente dai risultati restituiti e la confronta
con `valore_medio_registrazione_effettivo`, più un test API separato per l'override manuale end to
end.

**Suite di test rieseguita da me in ambiente pulito** (non fidandomi del riepilogo): `git archive`
del commit `380475c`, estratto in una cartella separata, virtualenv nuovo, installate solo le
dipendenze minime indicate dal metodo di supervisione (senza paddleocr/redis/celery/minio/PyJWT).
Risultato: **153 passed, 2 failed** — i due falliti sono `tests/test_ocr.py::test_paddle_provider_and_cache`
e `test_ocr_engine_and_image`, entrambi per `ModuleNotFoundError: No module named 'PIL'`, un modulo
non installato di proposito perché estraneo a JET. 153 + 2 = 155, lo stesso totale riportato nel
riepilogo: la differenza è interamente spiegata dall'ambiente OCR escluso, non da una regressione.
Nessun test JET fallito.

TypeScript: non ho rieseguito `tsc` in questa verifica (richiederebbe `npm install` completo);
il diff su `JetDashboard.tsx`/`api.ts` letto per intero è un cambiamento minimo e leggibile
(un'espressione ternaria di formattazione e un campo di tipo aggiuntivo) — nessun elemento che
faccia dubitare del type-check riportato nel riepilogo.

**Esito: approvato dal punto di vista tecnico** — scope corretto, codice corretto, test corretti e
rieseguiti con successo in ambiente pulito.

## Cosa manca prima di considerare il Giorno 2 davvero chiuso

Per il metodo che abbiamo concordato, l'ultima parola sui dati reali è di Ruben, non mia: va
rilanciata l'analisi su un dataset reale già noto (Nordson o ALUK) e confrontato a mano il valore
di `valore_medio_registrazione_effettivo` con un calcolo manuale sullo stesso file. La verifica
tecnica qui sopra conferma che il codice fa quello che deve fare nei casi di test; non sostituisce
quel controllo.
