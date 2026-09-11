# Prompt 40 — JET: criterio "conto >10 cifre" e correzione peso keyword parti correlate
(Quadra — modulo JET)

## Contesto

Due modifiche indipendenti, decise con Ruben l'11/09/2026, entrambe piccole ma non fondibili in una
riga sola perché la prima tocca motore + interfaccia, la seconda solo interfaccia.

**1. Nuovo criterio "conto >10 cifre" (punto 14 della tabella dei 15 controlli, oggi assente).** È un
dodicesimo criterio "di dimensione conto", nello stesso spirito di "conto insolito/raro" e "conto
infragruppo/parte correlata" già presenti (Fase 4): opzionale, disattivato di default, non richiede una
soglia configurabile — Ruben ha confermato che la soglia resta fissa a 10, non è un parametro per
cliente. **Contribuisce al punteggio pesato** (peso 1–4 come gli altri, non un flag informativo separato
come la sequenza).

Una precisazione che introduco io, da confermare nel riepilogo se i dati reali smentiscono l'assunzione:
"cifre" significa cifre numeriche, non lunghezza della stringa. Un `conto_contabile` come `"IC-100"` o
con spazi non deve essere penalizzato per i caratteri non numerici. Il conteggio va fatto sui soli
caratteri `0-9` presenti nella stringa, ignorando lettere, trattini, spazi o altri separatori.

**2. Correzione di un peso rimasto disallineato.** Verificando la catena di commit che ha portato i pesi
degli "indicatori forti" a 4 (festività, retrodatazione, utenti non autorizzati, descrizione vuota), ho
trovato che `punteggio_parte_correlata` (il peso del criterio keyword/parti correlate, punto 15 della
tabella) è rimasto a `1` per una svista — la tabella lo includeva esplicitamente tra i cinque pesi da
portare a 4. Va corretto.

## Passo 0 — obbligatorio, prima di toccare qualunque file

Come nei prompt precedenti: più agenti possono aver lavorato sulla stessa cartella condivisa.

1. `git branch --show-current` — deve risultare `jet/sprint-15-controlli`. Se non lo è, fai
   `git checkout jet/sprint-15-controlli` (solo checkout, nessun merge, nessun nuovo branch).
2. `git log -1 --oneline` — alla mia ultima verifica il branch era a `569bf4e`. Se è diverso non è
   necessariamente un problema, ma riporta l'hash esatto nel riepilogo.
3. `git status --short` — deve risultare vuoto. Se non lo è, **fermati e segnala cosa trovi, senza
   scartarlo né correggerlo di tua iniziativa**.

Se un controllo fallisce, non procedere: scrivi nel riepilogo cosa hai trovato e fermati lì.

## Cosa implementare

### Parte 1 — correzione peso keyword (banale, un solo file)

In `ui/src/jet/JetDashboard.tsx`, nell'oggetto `EMPTY`:
```ts
punteggio_parte_correlata: 1,
```
diventa:
```ts
punteggio_parte_correlata: 4,
```
Nessun altro valore di `EMPTY` va toccato in questa parte.

### Parte 2 — criterio "conto >10 cifre"

**`backend/jet/models.py`**

In `ParametriClienteJet`, aggiungi accanto agli altri due interruttori "di conto" (segui esattamente lo
stesso stile/posizione di `attivo_conto_insolito_raro`/`attivo_conto_infragruppo_parte_correlata`):
```python
attivo_conto_lunghezza: bool = False
```
e, nel blocco dei punteggi, accanto a `punteggio_conto_infragruppo_parte_correlata`:
```python
punteggio_conto_lunghezza: int | None = Field(default=None, ge=0)
```
Nessuna soglia da aggiungere: il limite di 10 cifre è fisso nel motore, non un parametro cliente.

In `EsitoRigaJet`, accanto a `flag_conto_infragruppo_parte_correlata`:
```python
flag_conto_lunghezza: bool | None = None
```

**`backend/jet/criteri.py`**

In `valuta_riga`, aggiungi il calcolo (posizionalo accanto al blocco esistente di
`flag_conto_infragruppo_parte_correlata`, stesso stile):
```python
if not parametri.attivo_conto_lunghezza or riga.conto_contabile is None:
    flag_conto_lunghezza = None
else:
    cifre = sum(carattere.isdigit() for carattere in riga.conto_contabile)
    flag_conto_lunghezza = cifre > 10
```
Aggiungi `(flag_conto_lunghezza, parametri.punteggio_conto_lunghezza)` alla tupla `flag_e_pesi` (il
meccanismo esistente lo somma automaticamente quando il flag è `True` e il peso non è `None`, nessun'altra
modifica necessaria lì).

**Non aggiungere** `attivo_conto_lunghezza` al conteggio `criteri_standard_attivi`: come
`attivo_conto_insolito_raro` e `attivo_conto_infragruppo_parte_correlata`, è un criterio opzionale fuori
dagli undici standard e non deve influenzare il riproporzionamento della soglia di approfondimento.

Aggiungi `flag_conto_lunghezza=flag_conto_lunghezza` alla costruzione finale di `EsitoRigaJet`.

**`tests/test_jet_conti.py`**

Aggiungi test analoghi a quelli già presenti per conto insolito/raro e infragruppo (stesso file, stesso
stile di fixture `_parametri`/`_riga`). Copri almeno:
- conto con più di 10 cifre numeriche → flag `True`, contribuisce al punteggio con il peso configurato;
- conto con esattamente 10 cifre → flag `False` (il criterio è "più di 10", non "almeno 10");
- conto alfanumerico tipo `"IC-1234567890123"` (13 cifre ma con prefisso non numerico) → conta solo le
  cifre, non i caratteri totali, quindi flag coerente col numero di cifre reali, non con `len()` della
  stringa;
- criterio disattivato (`attivo_conto_lunghezza=False`) → flag `None`, nessun contributo al punteggio,
  anche con un conto lunghissimo;
- `conto_contabile` assente (`None`) → flag `None`, mai `False`.

**Frontend — `ui/src/jet/api.ts`**

Aggiungi ai tipi `JetParams` i due nuovi campi, nello stesso stile dei corrispondenti già presenti per
conto insolito/raro e infragruppo:
```ts
attivo_conto_lunghezza: boolean;
punteggio_conto_lunghezza: number | null;
```

**Frontend — `ui/src/jet/ParamsPanel.tsx`**

1. In `CONTROLS`, aggiungi la riga per il controllo id `"14"` (conto >10 cifre), seguendo esattamente lo
   schema delle righe esistenti per i controlli id `"10"` (conto raro) e `"15"` (infragruppo/parte
   correlata): `status` coerente col fatto che oggi diventa "presente", `baker` con nota che la tabella
   Global Focus non assegna un peso ufficiale a questo punto (a differenza degli undici standard), campo
   `attivoKeys: ["attivo_conto_lunghezza"]`, `pesi: ["punteggio_conto_lunghezza"]`.
2. In `SCOPO_CONTROLLI`, aggiungi una voce per `attivo_conto_lunghezza` con testo nello stesso registro
   delle altre (spiega cosa fa il controllo, che la soglia è fissa a 10 cifre non configurabile, e che
   conta solo i caratteri numerici del codice conto).
3. In `ControlFields`, il controllo id `"14"` non richiede campi propri oltre a peso e interruttore
   (nessuna soglia, nessuna lista) — verifica se il codice esistente gestisce già questo caso di default
   (come per il controllo id `"09"`, descrizione vuota) o se serve un `case "14": return null;` esplicito
   nello `switch`/struttura equivalente. Non introdurre un campo soglia nell'interfaccia: la soglia è
   fissa nel motore.

## Cosa NON fare

- Non toccare `sequenza.py`, `calendari.py`, `ingest*.py`, `store.py`, `pratica.py`, `fonti.py`.
- Non aggiungere una soglia configurabile per la lunghezza conto: è fissa a 10 cifre nel motore, per
  decisione esplicita di Ruben.
- Non includere `attivo_conto_lunghezza` nel conteggio `criteri_standard_attivi` di `criteri.py`.
- Non toccare altri valori di `EMPTY` oltre a `punteggio_parte_correlata` (parte 1) e ai nuovi campi
  aggiunti per il conto >10 cifre (parte 2): `attivo_conto_lunghezza: false` e
  `punteggio_conto_lunghezza: null` come default, coerente con gli altri due criteri opzionali di conto.
- **Non toccare, scartare o committare alcun file che non sia uno di quelli elencati sopra.** Se trovi
  modifiche non committate estranee a questo prompt nella cartella condivisa, fermati e segnalale, non
  deciderle tu.

## Verifica richiesta prima della consegna

Suite completa in ambiente pulito (`git archive`, non la cartella di lavoro live), dipendenze minime
della disciplina di progetto (niente `paddleocr`/`redis`/`celery`/`minio`/`PyJWT`):
```
python -m pytest tests/ -q
```
Incolla l'output letterale. Poi, se possibile nel tuo ambiente, `npx tsc --noEmit` dalla cartella `ui/`
in ambiente pulito — incolla l'output letterale anche se pulito.

## Consegna

Commit diretto su `jet/sprint-15-controlli`. Nessun push né PR. Committa esclusivamente:
`backend/jet/models.py`, `backend/jet/criteri.py`, `tests/test_jet_conti.py`, `ui/src/jet/api.ts`,
`ui/src/jet/ParamsPanel.tsx`, `ui/src/jet/JetDashboard.tsx` — nessun altro file. Nel riepilogo: branch e
commit di partenza effettivi, conferma che il diff riguarda solo questi sei file, output letterale della
suite di test, e segnala esplicitamente se nei dati che hai usato per i test il conteggio "solo cifre
numeriche" (invece di lunghezza totale della stringa) ti è sembrato sbagliato per qualche motivo — è
un'assunzione mia, non di Ruben, e va confermata.
