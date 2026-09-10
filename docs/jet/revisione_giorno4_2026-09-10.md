# Revisione — Giorno 4 (dataset calendari nazionali)

Data: 10 settembre 2026
Branch `codex/jet-calendari-nazionali`, commit `23b2e6d`, dalla punta di `3960f33`.
Verificato indipendentemente, non sul riepilogo fornito.

## Scope

`git diff 3960f33..23b2e6d --stat`: tre file, tutti dichiarati — `backend/jet/calendari.py`,
`backend/jet/__init__.py`, `tests/test_jet_calendari.py`. Nessun altro file toccato, come
richiesto (motore, modelli, API, interfaccia invariati).

## Verifica delle date — non mi sono fidato delle fonti citate, le ho ricalcolate

Oltre a leggere il codice, ho calcolato in modo indipendente, con algoritmi standard (Gauss/Meeus
per la Pasqua occidentale e ortodossa, la regola federale statunitense per le festività "n-esimo
lunedì" e per i giorni osservati quando una data fissa cade di sabato o domenica), le festività
mobili attese per tutti gli anni 2024–2030 e le ho confrontate con quelle nel dataset:

- **Germania**: Venerdì Santo, Lunedì dell'Angelo, Ascensione, Lunedì di Pentecoste — **7 anni su 7
  coincidono esattamente** con il calcolo.
- **Francia**: stesse quattro ricorrenze (dove applicabili) — **7 anni su 7 coincidono**.
- **Italia**: Lunedì dell'Angelo — **7 anni su 7 coincide**; anche l'aggiunta del 4 ottobre dal 2026
  è coerente con la fonte citata (Legge 151/2025).
- **Cipro**: ho ricalcolato la Pasqua ortodossa (calendario giuliano convertito in gregoriano) —
  Venerdì Santo e Lunedì di Pasqua ortodossi **coincidono su tutti e 7 gli anni**, incluso il caso
  particolare del 2024 (Pasqua ortodossa il 5 maggio, un mese dopo quella occidentale).
- **Stati Uniti**: ho ricalcolato tutte le undici festività federali con la regola "n-esimo lunedì
  del mese" e la regola dei giorni osservati — **coincidenza esatta su tutti e 7 gli anni**, incluso
  il caso limite corretto: il Capodanno 2028 cade di sabato, quindi si osserva venerdì 31/12/2027 —
  il dataset lo riporta giustamente nell'anno 2027 e non ripete l'1/1 nel 2028. Un dettaglio facile
  da sbagliare, gestito bene.
- **Malta e Irlanda**: verifica a campione (Venerdì Santo maltese, alcune "primo lunedì del mese"
  irlandesi) coerente con quanto atteso, non ricalcolata riga per riga come per gli altri cinque
  Paesi.

Le festività fisse (1 gennaio, 1 maggio, 25 dicembre, ecc.) sono corrette per definizione e non
richiedono verifica oltre alla presenza.

Non ho verificato in modo indipendente Spagna (giorni comuni nazionali dichiarati) al di là della
lettura della fonte citata, né i dettagli non standard di Malta/Irlanda oltre al campione sopra —
resta valido quanto scritto nel prompt: una validazione finale da parte di uno o del team, prima
dell'uso su un cliente reale, è comunque richiesta dalla governance della specifica ("il manager
approva... i calendari").

## Un problema reale trovato, da correggere prima del Giorno 5

Israele ha tutti e sette gli anni presenti nel dataset ma con liste vuote (scelta corretta e onesta
per non inventare corrispondenze del calendario ebraico non verificate). Il problema è che
`festivita("IL", anno, anno)` restituisce quindi `[]` — una lista vuota valida, non un errore.
Se il prompt del Giorno 5 (integrazione) venisse eseguito così com'è scritto, selezionare "Israele"
per una pratica produrrebbe silenziosamente "nessuna festività mai rilevata" invece di "non
calcolabile": esattamente il tipo di falso silenzioso che la disciplina del progetto vuole evitare.
Lo stesso vale per la Spagna negli anni 2027–2030.

Ho corretto il prompt 31 (Giorno 5) prima di consegnarlo per tenerne conto: quando il calendario
nazionale non ha nessuna festività compilata per l'anno della riga *e* non c'è nessuna aggiunta
manuale, il criterio risulta esplicitamente "non calcolabile", non "nessuna festività". Trovi il
prompt aggiornato allegato a parte.

## Test e suite

I test strutturali (copertura di tutti i Paesi/anni, liste ordinate senza duplicati, errori su
codice Paese inesistente o range invertito/non disponibile) sono corretti e sufficienti per quello
che possono verificare da soli — non possono validare la correttezza delle singole date, per quello
serve il ricalcolo indipendente fatto sopra.

Suite rieseguita da me in ambiente pulito (`git archive` del commit `23b2e6d`, venv nuovo, sole
dipendenze minime): **163 passed, 2 failed** — i due falliti sono ancora `test_ocr.py` per `PIL`
mancante, estraneo a JET. 163 + 2 = 165, combacia col numero riportato.

## Esito

**Approvato**, con la correzione già applicata al prompt del Giorno 5 per il caso dei Paesi con
dataset incompleto (Israele, Spagna 2027–2030). Nessuna richiesta di modifica al Giorno 4 stesso.
