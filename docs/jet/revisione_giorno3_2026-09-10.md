# Revisione — Giorno 3 (soglia cifra tonda configurabile, JET-04)

Data: 10 settembre 2026
Branch `codex/jet-cifra-tonda-configurabile`, commit `3960f33`, dalla punta di `380475c`.
Verificato indipendentemente, non sul riepilogo fornito.

## Scope

`git diff 380475c..3960f33 --stat`: sei file, tutti dichiarati nel prompt 29, nessuno in più —
`backend/jet/criteri.py`, `backend/jet/models.py`, `tests/test_jet_criteri.py`,
`tests/test_jet_models.py`, `ui/src/jet/JetDashboard.tsx`, `ui/src/jet/api.ts`.
`ui/src/jet/ParamsPanel.tsx` non è stato toccato, come richiesto.

## Lettura del codice

`soglia_importo_cifra_tonda: Decimal | None = Field(default=None, gt=0)` aggiunto a
`ParametriClienteJet` — il vincolo `gt=0` rifiuta zero e negativi a livello di modello, senza bisogno
di logica applicativa aggiuntiva. `flag_importo_cifra_tonda` allargato da `bool` a `bool | None`
in `EsitoRigaJet`, coerente con la disciplina "non calcolabile ≠ falso" del modulo. La logica in
`criteri.py` è esattamente quella richiesta: resto della divisione per la soglia configurata, `None`
quando la soglia non è impostata. Nessun flag "multipli superiori" — corretto, era ridondante.

Riprodotto io stesso, fuori dai test, in un venv pulito: soglia 10.000 su importo 100.000 → `True`;
soglia 100.000 su importo 10.000 → `False`; nessuna soglia su importo 100.000 → `None`; soglia
10.000 su importo 15.500 (non multiplo) → `False`. Tutti coerenti con l'aritmetica attesa.

L'interfaccia (tendina 10.000/100.000/1.000.000/Personalizzato con campo numerico dedicato quando
il valore caricato non coincide con nessuna delle tre opzioni fisse) è implementata in modo
sensato, incluso il caso di riapertura di una pratica con un valore custom già salvato.

## Test

I due test aggiunti in `test_jet_criteri.py` coprono esattamente i due casi richiesti (soglia
10k/importo 100k vero, soglia 100k/importo 10k falso) più il caso "nessuna soglia" con anche gli
altri parametri nullificati per isolare che il punteggio totale resti davvero zero, non solo il
flag di questo criterio. `test_jet_models.py` verifica che il modello accetti il flag `None`
esplicitamente. La funzione helper `_parametri()` è stata aggiornata con la soglia di base, quindi
il test parametrizzato preesistente (righe -120/121) continua a passare senza modifiche al suo
comportamento.

## Suite rieseguita da me in ambiente pulito

`git archive` del commit `3960f33`, estratto a parte, venv nuovo, sole dipendenze minime (senza
paddleocr/PIL eccetera). Risultato: **156 passed, 2 failed** — i due falliti sono ancora
`tests/test_ocr.py` per `PIL` mancante, estraneo a JET e volutamente non installato.
156 + 2 = 158, combacia col numero riportato nel riepilogo. Nessun test JET fallito.

## Esito

**Approvato.** Nessuna richiesta di correzione.
