# Piano operativo Quadra (e dopo: Consentil)

Documento di lavoro quotidiano. Non è un piano architetturale: è **cosa fai, in che ordine, quando è fatto**.

- **Mandato:** concentrarti su Quadra; Consentil solo a Quadra stabile.
- **Nessuna scadenza** detta agli amministratori. Le finestre sotto sono **tue**, per non disperderti.
- **Regola d’oro:** un filo alla volta. JET → controllo pilota → OCR su quel pilota → Consentil.

---

## 0. Come lavorare ogni giorno (metodo)

1. Apri questo file, leggi solo la **settimana in corso**.
2. Scegli **un** obiettivo della giornata (una riga della checklist).
3. Fine giornata (10 minuti): spunta, annota file usato / bug / “un collega si perderebbe qui”.
4. Non aprire Consentil, PEC, Vercel, `enterprise/`, Docker “per pulizia” se non è nella settimana.

**Branch:** un tema per branch (`jet/…`, poi `controllo/…`). Commit piccoli. Dati cliente **mai** nel git.

**Test automatici, prima di dire “fatto”:**

```bash
python -m pytest tests/test_jet*.py tests/modules/jet/ -q
```

Poi sempre un giro **a mano** nell’UI.

---

## 1. Mappa del lavoro (non fare il successivo prima)

```
FASE A — JET in mano          ← sei qui
FASE B — Controllo, 1 pilota
FASE C — OCR su quel pilota
FASE D — (opz.) VPS studio, senza OCR pesante
FASE E — Consentil (dopo “stabile”)
```

**Parcheggio** (non esistono finché non chiudi A, poi B):  
PEC, CRM, Vercel, ISO/CISA, demo rete studio, tutti i clienti, login Microsoft, secondo prodotto.

---

## FASE A — JET usabile in studio

**Scopo:** un collega carica un giornale, vede le righe da investigare, scarica Excel.

**Non è scopo:** ogni gestionale del portafoglio, server pubblico, OCR del giornale scansionato (il PDF in `test/` è Fase C, non A).

### Settimana A1 — Locale, fixture, UI

| # | Obiettivo | Fatto quando |
|---|-----------|----------------|
| A1.1 | App parte con `./start.sh`, sezione JET apre | Nessun traceback a vuoto |
| A1.2 | Pytest JET verde | Comando sopra, 0 fail pertinenti |
| A1.3 | Giro completo su fixture `fixtures/jet/` | Pratica → upload → mappa → analizza → filtri → export.xlsx si apre |
| A1.4 | Errori in italiano | File vuoto, colonne sbagliate, analisi senza mappatura: messaggio chiaro |
| A1.5 | Parametri `None` visibili | “Non calcolabile” ≠ “falso” in schermata |

**Stop settimana:** tu da solo, file sintetico, Excel apribile.

### Settimana A2 — File reale + un collega

Usa **un** file vero (Nordson **oppure** ALUK), sul Mac, non in cloud.

| # | Obiettivo | Fatto quando |
|---|-----------|----------------|
| A2.1 | Stesso flusso sul file reale | Export coerente (niente crash a scala Nordson) |
| A2.2 | Annota tempi e numeri | Righe, minuti analisi, minuti export, conteggio “da investigare” |
| A2.3 | Lista “click oscuri” | 5 punti max da sistemare in UI |
| A2.4 | Test collega (15–20 min, tu zitto) | Arriva all’Excel **oppure** hai la lista di dove si è fermato |
| A2.5 | Foglio 1 pagina per lo studio | Cosa fa JET / cosa non decide il software |

**Exit Fase A (stabile JET):** A2.4 o A2.5 fatti, e tu non sei l’unico che sa quale bottone premere.

Checklist stampa — test manuale JET:

- [ ] Nuova pratica (cliente + periodo)
- [ ] Upload Excel **o** TXT + profilo colonne
- [ ] Parametri: vuoto ciò che non so
- [ ] Analizza
- [ ] Filtro da investigare
- [ ] Export aperto in Excel
- [ ] Un criterio `None` non risulta “ok”

---

## FASE B — Controllo contabile, un cliente pilota

**Inizia solo se Fase A è exit.**  
**Scopo:** un trimestre, **un** cliente, dashboard + Excel carte A–I usabile in revisione.

**Non è scopo:** 12 verifiche SA 250B chiuse in automatico, tutti i clienti, giudizi A/D/H/I senza umano.

| # | Obiettivo | Fatto quando |
|---|-----------|----------------|
| B.1 | Pilota scelto per iscritto (nome cliente + trimestre) | Mail o nota internamente |
| B.2 | Scan cartella documenti di **quel** trimestre | Classificazione visibile, mancanti elenco |
| B.3 | Dashboard: stati sezioni, evidenze, override dove serve | Un revisore capisce ✓ / wip / ✗ |
| B.4 | Export Excel apribile, template non rotto | Si può mettere in pratica |
| B.5 | Lista gap (verifiche 11–12, libri, ecc.) | Scritta, non “li facciamo tutti ora” |

**Exit B:** B.4 vero sul pilota. Il resto è backlog, non blocco.

---

## FASE C — OCR → Excel (stesso pilota)

**Scopo:** documento difficile → campi estratti → **conferma umana** → finisce in Quadra/Excel.

Il PDF tipo `test/giornale_scansionato_sintetico.pdf` entra **qui**, non in JET settimana 1 (JET oggi mangia Excel/TXT strutturati).

| # | Obiettivo | Fatto quando |
|---|-----------|----------------|
| C.1 | 10 documenti del pilota, tipi misti (F24, e/c, …) | Campi visibili in UI |
| C.2 | Conferma/correzione prima di scrivere | Nessun Excel “silenzioso” sbagliato |
| C.3 | Giornale *scansionato* solo se serve al pilota | Separato dal JET su file già tabellare |

**Exit C:** C.2 sul pilota. Non “OCR che non sbaglia mai”.

---

## FASE D — Messa in rete (solo se serve)

**Non Vercel.** Backend Python, upload, JET, OCR non stanno su serverless.

| Quando | Cosa |
|--------|------|
| Demo in ufficio | Mac + `./start.sh`, colleghi su LAN se l’IT lo consente |
| Serve URL dello studio | VPS EU + Docker (`docker-compose.prod.yml` / Coolify), **OCR spento** al primo giro |
| Dati | Solo server/studio; mai Nordson su account personale cloud |

---

## FASE E — Consentil (dopo Quadra stabile)

Stabile = exit A + (meglio) B.4, non “Quadra perfetto”.

**Avvio Consentil:**

1. Mail ai tre: perimetro **rete/studio**, niente scan aggressivo, report da “cliente interno”.
2. 8–12 slide: 5 rischi, evidenze, “stesso fascicolo su un cliente in incarico”.
3. Chiedere **un** sì: modulo ITGC su una revisione **oppure** assessment igiene su un cliente, non “tutti i clienti”.
4. Nel frattempo Quadra: **max mezza giornata / 2 settimane** (solo bug di produzione).

Certificazioni (non bloccano Quadra): CISA dopo, non in Fase A.

---

## Backlog esplicito (non toccare in A–C)

- Invii PEC
- Login Microsoft / multi-tenant
- Secondo e terzo cliente “tutti i dettagli”
- CRM commerciale
- Deploy Vercel
- Refactor `backend/enterprise`, `backend/modules` vs `backend/jet`
- Firmare certificati ISO/NIS2

---

## Registro (compila tu)

| Data | Fase | Cosa ho chiuso | File / cliente | Blocco |
|------|------|----------------|----------------|--------|
|      | A    |                |                |        |

---

## Riunione interna (quando hai A2)

Non promettere date. Mostra:

1. Excel JET di un giornale reale (numeri coperti se serve).
2. I 3 click del flusso.
3. Prossimo passo: *un pilota di controllo, poi OCR, Consentil dopo*.

Se chiedono Consentil: *dopo che JET (e il pilota) sono usati senza di me nella stanza.*
