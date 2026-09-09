# Prompt per Cursor (Opus) — Ricostruzione UI Quadra secondo "Atelier Document System"

## Come leggere questo prompt

Questo è un prompt di implementazione, non di ideazione: il design è già stato deciso e approvato da chi
commissiona il lavoro (mockup reale + design system formale, entrambi allegati/descritti sotto). Il compito
non è proporre uno stile ma **applicare esattamente** quello descritto qui, in tutto il frontend esistente di
Quadra, senza inventare varianti né "migliorare" la palette.

Lavora su un nuovo branch dedicato (es. `ui/redesign-atelier`), con commit incrementali e messaggi chiari.
**Non fare push, non toccare `main`.** Alla fine del lavoro, chi ha commissionato il prompt (io, in un'altra
sessione) verificherà il risultato leggendo il diff, il codice e facendo un giro nell'app funzionante —
quindi ogni scelta implementativa deve essere motivabile e coerente con quanto scritto qui, non improvvisata.

## Contesto del progetto

Quadra è uno strumento software interno usato da un team di revisori legali per svolgere il controllo
contabile periodico previsto dal principio di revisione SA Italia 250B (verifica ex art. 2409-ter c.c.).
Stack: backend FastAPI in `backend/`, frontend React + Vite + TypeScript + Tailwind in `ui/`. Non è un
prodotto consumer: è usato internamente da revisori per ore consecutive, quindi leggibilità e assenza di
affaticamento visivo contano più di ogni effetto estetico.

Lo stato attuale del frontend:

- `ui/src/App.tsx` — **1173 righe, monolitico**. Contiene già un toggle rudimentale `workspace:
  "excel"|"domain"`, uno stato `view`, e una navigazione interna abbozzata (`navOpen`, `IconMenu`). Questo
  file va scomposto: la logica applicativa (fetch, stato, gestione pratiche) resta, ma la shell visiva e la
  navigazione vanno riscritte secondo la nuova struttura a sidebar descritta sotto.
- `ui/src/domain/DomainDashboard.tsx` — la dashboard del "Controllo Contabile" vero e proprio: lista
  pratiche, apertura pratica, carte di lavoro per sezione, stato/provenienza documento, export Excel. Usa già
  colori di stato `rose-*` (errori/anomalie) e `amber-*` (mancante/da controllare); non esiste ancora un
  verde per lo stato "conforme".
- `ui/tailwind.config.js` — token attuali: `ink:#1A1A1A`, `muted:#6B6B6B`, `line:#E8E8E4`, `paper:#F6F6F3`,
  `card:#FFFFFF`, font Inter, un'ombra soft chiamata `card`.

**Questi token vanno sostituiti**, non affiancati: il nuovo design system descritto sotto ("Atelier Document
System") diventa la palette unica e definitiva di Quadra. Non è un'evoluzione dei vecchi token — è vicino
nello spirito (base chiara e calda, inchiostro scuro, bordi sottili, nessun colore "brand" acceso) ma i
valori esatti cambiano e vanno presi da qui, non dal vecchio `tailwind.config.js`.

## Il design system da implementare: "Atelier Document System"

Stile: **Editorial Document Minimalism** — base monocromatica calda (grigio pietra/carta), bordi hairline da
1px che imitano righe di quaderno, nessuna ombra marcata, gerarchia costruita con stratificazione tonale
(surface levels) invece che con `box-shadow`. L'interfaccia deve "sparire" davanti ai dati: i controlli sono
quasi invisibili finché non vengono usati (hover/focus), il contenuto (tabelle, pratiche, documenti) resta
sempre il protagonista visivo.

### Token colore (usa questi nomi e questi valori esatti in `tailwind.config.js`)

Estendi `theme.extend.colors` con questi token (non rimuovere i colori di stato Tailwind di default come
`rose`, `amber`, `emerald`, `red` — restano disponibili per i badge, vedi sotto):

```js
colors: {
  // superfici
  "surface": "#faf9f6",              // canvas app / sfondo pagina
  "surface-sidebar": "#f7f6f3",      // sidebar, tray di navigazione, pannelli annidati
  "surface-card": "#ffffff",         // carte, tabelle, pagina documento
  "surface-hover": "#f1f1ef",        // hover su liste, righe, voci di menu
  "surface-recessed": "#eaeae8",     // callout annidati profondi, input disabilitati
  "surface-sidebar-hover": "#ebebea",// hover specifico su voci sidebar

  // bordi
  "border-subtle": "#e5e5e3",        // bordo hairline standard (celle tabella, sidebar, divisori)
  "border-muted": "#eaeae8",         // bordo secondario più tenue (card, righe)

  // inchiostro / testo
  "ink-primary": "#232321",          // titoli, dati tabellari, corpo testo
  "ink-secondary": "#5f5e5b",        // etichette, breadcrumb, voci sidebar, meta
  "ink-tertiary": "#9b9a97",         // placeholder, icone collassate, timestamp

  // accenti funzionali tenui (fill + testo abbinato)
  "tint-blue-bg": "#edf5f8", "tint-blue-text": "#2b5966",
  "tint-green-bg": "#edf3ec", "tint-green-text": "#2b593f",
  "tint-yellow-bg": "#fbf3db", "tint-yellow-text": "#785e07",
  "tint-orange-bg": "#faece3", "tint-orange-text": "#8f471a",
  "tint-red-bg": "#fdebec", "tint-red-text": "#933038",
  "tint-gray-bg": "#efefed", "tint-gray-text": "#454443",
}
```

Nota: nel mockup HTML di riferimento (descritto sotto) compaiono anche varianti leggermente diverse per gli
stessi concetti (es. verde `#e6f4ea`/`#137333`, rosso `#fce8e6`/`#c5221f`, giallo `#fef7e0`/`#b06000`) usate
per badge di stato più "pieni" (conforme/anomalia/in sospeso) rispetto ai tag tenui sopra. Aggiungi anche
questi come token separati, perché servono per un uso diverso (badge di stato prominenti vs tag inline):

```js
  "status-green-bg": "#e6f4ea", "status-green-text": "#137333",
  "status-red-bg": "#fce8e6", "status-red-text": "#c5221f",
  "status-yellow-bg": "#fef7e0", "status-yellow-text": "#b06000",
```

### Tipografia

Font: **Inter** (già in uso), fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
Per frammenti monospaced (codici pratica, protocolli, importi tabellari, timestamp) usa **JetBrains Mono**
(carica da Google Fonts, va aggiunto — vedi sezione "Cosa puoi aggiungere").

Scala tipografica esatta (definiscila come utility Tailwind personalizzate o classi CSS riutilizzabili, non
valori inline sparsi):

| Nome | Dimensione | Peso | Interlinea | Letter-spacing | Uso |
|---|---|---|---|---|---|
| display | 40px | 700 | 48px | -0.03em | non serve probabilmente in Quadra, salta se non c'è un caso d'uso |
| headline-lg | 30px | 600 | 38px | -0.025em | titolo pagina principale (es. nome pratica) |
| headline-md | 22px | 600 | 28px | -0.018em | titoli di sezione |
| headline-sm | 17px | 600 | 24px | -0.012em | sottotitoli, titoli di card |
| body-lg | 16px | 400 | 26px | -0.011em | testo lungo/prosa (se presente) |
| body-md | 14px | 400 | 22px | -0.006em | testo standard, celle tabella, descrizioni |
| body-sm | 12px | 400 | 18px | 0em | meta testo, didascalie |
| label-md | 13px | 500 | 18px | -0.005em | etichette, voci sidebar, pulsanti |
| label-sm | 11px | 500 | 14px | 0.01em | badge, tag, intestazioni tabella maiuscole |
| code | 12.5px | 400 (JetBrains Mono) | 18px | 0em | codici, protocolli, importi monospaced |

### Spaziatura, raggi, larghezze

Spaziatura su scala 8px con questi valori nominati (aggiungili come `theme.extend.spacing`):
`xxs:0.125rem, xs:0.25rem, sm:0.5rem, md:0.75rem, base:1rem, lg:1.5rem, xl:2rem, 2xl:3rem, 3xl:4.5rem`.

Larghezze di layout: `sidebar-expanded: 16.25rem` (260px), `sidebar-collapsed: 3.5rem`, `content-narrow:
44rem`, `content-standard: 56rem`, `content-wide: 72rem`.

Raggi: `sm:0.125rem, DEFAULT:0.25rem, md:0.375rem, lg:0.5rem, xl:0.75rem, full:9999px`. Regola pratica: 4px
(`DEFAULT`) per elementi interattivi standard (pulsanti, voci menu, badge, input); 8px (`lg`) per contenitori
strutturati (card, modali, dropdown); `full` solo per avatar/indicatori a pallino.

### Elevazione — niente ombre marcate

Principio guida: **nessuna `box-shadow` pesante, nessun rebrand con gradient vistosi**. La profondità si
ottiene solo con stratificazione tonale (colori di superficie via via più chiari verso il "davanti") e bordi
hairline da 1px. Gerarchia:

1. Livello 0 (shell app / sidebar): `surface-sidebar` (`#f7f6f3`)
2. Livello 1 (area contenuto principale): `surface-card` (`#ffffff`), separata dalla sidebar da un bordo
   verticale `1px solid border-subtle`
3. Livello 2 (callout, box, righe di tabella): `surface-card` o `surface-sidebar` con `1px solid
   border-muted`
4. Livello 3 (menu contestuali, dropdown — se presenti): sfondo bianco puro, bordo `border-subtle`, **unica
   eccezione dove è ammessa un'ombra**, ultra sottile: `box-shadow: 0 1px 2px rgba(15,15,15,.04), 0 4px 12px
   rgba(15,15,15,.06)`. Nient'altro nell'app deve avere ombre più marcate di questa.
5. Modali (se in futuro serviranno): sfondo bianco, bordo `border-subtle`, scrim `#0f0f0f` al 18% di opacità
   con `backdrop-filter: blur(2px)`.

Sfondo dell'area contenuto principale: puoi opzionalmente applicare un micro pattern a puntini per dare
scala spaziale, come nel mockup di riferimento:
```css
background-image: radial-gradient(#e5e5e3 1px, transparent 1px);
background-size: 16px 16px;
```
Non è obbligatorio, ma se lo includi va SOLO sull'area di contenuto principale, mai sulla sidebar o dentro le
card/tabelle.

## Struttura da implementare: sidebar + area di contenuto

### Sidebar fissa a sinistra (260px espansa, 56px collassata a sole icone)

Sempre visibile, sfondo `surface-sidebar`, bordo destro `1px solid border-subtle`. Dall'alto verso il basso:

1. **Intestazione workspace**: un piccolo blocco quadrato (24-28px) con sfondo scuro (`ink-primary`) e la
   lettera "Q" bianca, accanto il nome "Quadra Revisione" e sotto, in testo più piccolo e muted, "SA Italia
   250B · art. 2409-ter". Hover leggero sull'intero blocco (`surface-sidebar-hover`).
2. **Navigazione principale** — sezione con intestazione maiuscola piccola (es. "Procedure di Audit",
   `label-sm`, `ink-tertiary`), poi esattamente cinque voci, ciascuna: icona outline (Material Symbols
   Outlined, coerente per tutta l'app — vedi sotto), etichetta, ed eventualmente un badge a destra:
   1. **Controllo Contabile** — icona `fact_check`. È la voce più usata, va per prima. Badge a destra:
      `250B` (badge neutro, `tint-gray-bg`/`tint-gray-text`).
   2. **JET (ISA 240)** — icona `account_balance`. Badge: `Testing` (stesso stile neutro).
   3. **Sezione 3** — icona a scelta coerente (es. `inventory_2`). Badge/etichetta: `In arrivo` (testo
      `ink-tertiary`, nessuno sfondo).
   4. **Sezione 4** — icona (es. `folder_supervised`). Badge: `In arrivo`.
   5. **Sezione 5** — icona (es. `history_edu`). Badge: `In arrivo`.
   La voce attiva ha sfondo `surface-sidebar-hover` (o `surface-hover`) e testo/icona in `ink-primary`; le
   voci inattive sono in `ink-secondary` con hover che le porta a `ink-primary` + sfondo hover.
3. **Footer sidebar** (in fondo, sempre visibile): un piccolo pannello con sfondo leggermente più scuro
   (`surface-recessed` o simile) che mostra "Sessione di Revisione" e sotto un indicatore a pallino verde +
   testo (es. "Incarico Fiscale Attivo" o simile) — **questo è puramente decorativo/di stato locale, non
   richiede backend**: può essere hardcoded o derivato da uno stato semplice già presente lato client. Non
   introdurre login/autenticazione: non è un profilo utente, è solo un'indicazione di sessione di lavoro
   attiva. Sotto, un pulsante "Riduci barra laterale" che collassa la sidebar a sole icone (comportamento
   client-side, salva la preferenza in `localStorage`).

**Cosa NON includere dalla sidebar del mockup di riferimento**: la riga "Cerca" con scorciatoia ⌘K e la riga
"Aggiornamenti"/"Impostazioni & Membri" sono elementi decorativi del mockup originale pensati per un prodotto
tipo Notion — **omettili o rendili non funzionanti solo se non hanno un corrispettivo reale in Quadra oggi**;
se Quadra ha già una funzione di ricerca pratiche, collega quella voce a quella funzione, altrimenti non
inventare una funzione di ricerca che non esiste. La sezione "Archivio Cartelle" nel mockup (scorciatoie a
cartelle specifiche) va omessa in questa fase: non esiste un concetto equivalente in Quadra oggi e non va
inventato.

### Area di contenuto principale

A destra della sidebar, larghezza flessibile. In alto una barra sottile (44px circa) con sfondo
`surface`/leggera trasparenza, bordo inferiore `border-muted`, che mostra un breadcrumb testuale (es. "Clienti
/ Nome Pratica / Sezione corrente") — usa dati reali della pratica aperta, non placeholder statici. Il
contenuto sotto varia per sezione (vedi sotto), sempre entro un contenitore centrato con larghezza massima
`content-wide` (72rem) e padding laterale generoso (min 48px su desktop).

## Contenuto delle singole sezioni

### 1. Controllo Contabile

**Non è una pagina nuova da disegnare da zero: è la dashboard esistente (`DomainDashboard.tsx` e la logica
correlata in `App.tsx`) trasferita dentro la nuova shell, con lo stile del design system applicato.** Non
perdere nessuna funzionalità esistente: apertura/creazione pratica, elenco carte di lavoro per sezione con
stato reale, provenienza documento, export Excel, storico documenti caricati. Il mockup HTML di riferimento
mostra come dovrebbe apparire visivamente (card metriche in alto, tabella "Carte di Lavoro" con colonne
Sezione/Ambito/Esito/Fonte documentale/Scostamento/Azione, tabella storico documenti in basso) — usalo come
riferimento di stile e struttura visiva, ma i **dati devono restare quelli reali già gestiti dall'app**, non
dati finti hardcoded. Se il mockup mostra colonne o concetti che l'app attuale non ha (es. "Scostamento" in
euro, badge "Conforme ISA / SA Italia"), valuta caso per caso: se il dato esiste già nello stato applicativo,
mostralo in quello stile; se non esiste, ometti l'elemento invece di inventare un valore.

Applica i colori di stato così: verde tenue (`status-green-bg`/`status-green-text`) per "conforme/completato"
(oggi assente, va introdotto), ambra (`status-yellow-bg`/`status-yellow-text`) per "in sospeso/mancante"
(sostituisce l'attuale `amber-*`), rosso (`status-red-bg`/`status-red-text`) per anomalie (sostituisce
l'attuale `rose-*`). Ogni badge di stato: pallino colorato + testo breve, radius `DEFAULT`, padding
orizzontale ~8px, altezza contenuta (~20-24px).

### 2. JET (ISA 240)

**Questa NON è ancora uno strumento operativo.** Non aggiungere un pulsante "avvia analisi" funzionante, non
collegare upload file reali: è una pagina di stato/racconto del lavoro già svolto sul modulo, pensata per
mostrare a chi la apre — con credibilità, numeri concreti, non solo parole — cosa è stato costruito e
verificato finora. Contenuto richiesto, in quest'ordine:

1. **Intestazione**: titolo "JET — Journal Entry Testing" con sottotitolo breve che spiega cos'è: analisi del
   libro giornale secondo i criteri di rischio del principio ISA 240 §A44 (conti insoliti, importi a cifra
   tonda, registrazioni fuori orario o festive, personale non autorizzato, parti correlate, e altri).
2. **Timeline delle fasi completate** (tutte già concluse — presentale come una lista verticale o una serie
   di step con icona di spunta verde, non come una barra di progresso percentuale generica): definizione dei
   contratti dati; ingest dei file del gestionale; replica degli undici criteri di rischio storici;
   copertura della dimensione "conto" (frequenza d'uso, conti insoliti/infragruppo); correzioni di robustezza
   emerse da un test su dati reali.
3. **Due card con risultati di test reali**, con numeri concreti (usali esattamente, sono dati reali di
   verifica già svolta, non inventarli né arrotondarli diversamente):
   - Cliente 1 (dati SAP, formato Excel): **213.656 registrazioni contabili analizzate**, risultati coincidenti
     esattamente con il foglio Excel storico già in uso dal team.
   - Cliente 2 (formato di export completamente diverso, una stampa del gestionale, non un file Excel):
     **56.133 registrazioni ingerite e analizzate con successo**.
4. **Uno spazio ben visibile ma chiaramente etichettato "Prossimamente"** per la futura area operativa dove
   si potrà caricare un file e avviare un'analisi vera — deve avere lo stesso stile curato del resto (card con
   bordo hairline, icona, testo esplicativo), non un placeholder rotto o un errore 404.

Questa sezione è quasi interamente contenuto statico (testo + numeri fissi), quindi può essere un componente
React autonomo senza dipendenze da API — se preferisci comunque isolare i numeri in una piccola costante
tipizzata in cima al file invece di stringhe sparse nel JSX, va bene, ma non serve un endpoint backend
dedicato.

### 3. Sezione 3 / 4 / 5 (segnaposto)

Pagina semplice nello stesso stile del resto — non una pagina bianca vuota: icona centrale grande (Material
Symbols Outlined, `ink-tertiary`), titolo ("Sezione in arrivo" o simile), una riga di testo `body-md` in
`ink-secondary` che indica che il contenuto sarà definito in seguito. Deve trasmettere che fa parte di un
piano, non che è un errore. Le tre sezioni possono condividere lo stesso componente placeholder parametrizzato
per titolo/icona.

## Icone

Usa **Material Symbols Outlined** (Google Fonts) in tutta l'app, stile outline coerente, mai un mix con altre
icon-set già presenti (se `App.tsx` usa già un'altra libreria di icone solo per `IconMenu`, sostituiscila con
Material Symbols per coerenza). Carica il font così nell'`index.html`:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```

e usa le icone come `<span class="material-symbols-outlined">nome_icona</span>` con `font-size` controllata
via classi Tailwind, oppure — se preferibile per coerenza col resto del progetto React — un pacchetto npm
equivalente (es. `material-symbols` o icone SVG statiche copiate dai nomi usati): scegli l'approccio più
coerente con come il progetto già gestisce asset statici, ma il risultato visivo deve essere lo stesso set di
icone outline.

## Componenti riutilizzabili da creare

Per evitare stile duplicato e incoerente, crea (o riorganizza se esistono già equivalenti) questi componenti
condivisi in `ui/src/components/` (o dove il progetto già organizza componenti condivisi):

- `Sidebar` — la sidebar completa, con stato espansa/collassata persistito in `localStorage`, voce attiva
  derivata dalla route/sezione corrente.
- `StatusBadge` — badge di stato con varianti `success | warning | error | neutral`, mappate rispettivamente
  a `status-green-*`, `status-yellow-*`, `status-red-*`, `tint-gray-*`.
- `Card` / `Callout` — contenitore con bordo hairline, radius `lg`, sfondo `surface-card` o `surface-sidebar`
  a seconda del contesto, nessuna ombra salvo il caso "livello 3" descritto sopra.
- `DataTable` — wrapper di stile per tabelle: intestazione su `surface-sidebar`, celle con bordo
  `border-subtle`, hover riga leggerissimo (`rgba(35,35,33,.025)` circa), altezza intestazione ~32px.
- `PlaceholderSection` — per Sezione 3/4/5.

## Cosa puoi aggiungere, cosa NON toccare

**Puoi aggiungere:**
- Il font Google "JetBrains Mono" (link `<link>` in `index.html`, come per Material Symbols Outlined).
- Nuovi componenti React sotto `ui/src/`.
- Nuove chiavi in `tailwind.config.js` (colori/spacing/radius sopra), senza rimuovere le utility Tailwind
  standard già in uso altrove (`rose`, `amber`, `emerald`, ecc. restano disponibili anche se lo stile nuovo
  non li usa più per i badge di stato).
- Una piccola utility client-side per persistere lo stato espanso/collassato della sidebar
  (`localStorage`), niente di più invasivo.

**Non toccare, non introdurre:**
- **Nessuna modifica al backend** (`backend/`): questo è un lavoro esclusivamente di frontend/UI.
- **Nessun login, autenticazione, profilo utente, avatar**: già escluso in una decisione precedente, resta
  escluso qui.
- **Nessuna nuova dipendenza npm pesante** (router, state management, UI kit di terze parti) se non
  strettamente necessaria per la nuova navigazione a sidebar — se il routing tra le 5 sezioni può essere
  gestito con lo stato React già esistente in `App.tsx` (come già fa oggi con `view`/`workspace`), preferisci
  quello a introdurre `react-router` o simili. Se ritieni davvero necessaria una libreria, spiega il motivo
  nel commit invece di aggiungerla silenziosamente.
- **Nessun dato finto persistito come se fosse reale**: l'unica eccezione esplicitamente autorizzata sono i
  numeri della sezione JET elencati sopra, che sono risultati reali di test già svolti, non dati inventati —
  vanno scritti come testo/costanti, non richiedono una chiamata API.
- Non rinominare o spostare file del backend, non modificare `requirements.txt`, non toccare Docker o
  configurazioni di infrastruttura: se nel repository trovi già cartelle non tracciate come
  `backend/modules/jet/`, `backend/enterprise/`, `backend/core/`, Dockerfile o modifiche non commesse a
  `ui/package.json`/`ui/vite.config.ts` — **ignorale, non basarti su di esse e non toccarle**: non fanno
  parte di questo lavoro e la loro origine è già in discussione separatamente.
- Nessun push, nessun merge su `main`: solo commit sul branch dedicato.

## Verifica che ti chiedo di fare tu stesso prima di consegnare

Prima di considerare il lavoro concluso:
1. Avvia l'app in locale e controlla visivamente ciascuna delle 5 sezioni della sidebar (incluse le tre
   segnaposto), sia con sidebar espansa che collassata.
2. Verifica che nessuna funzionalità esistente della sezione "Controllo Contabile" sia andata persa
   (apertura pratica, stato reale delle carte di lavoro, export Excel, storico documenti).
3. Controlla che non ci siano più riferimenti ai vecchi token Tailwind (`ink`, `muted`, `line`, `paper`,
   `card` così come definiti nel vecchio `tailwind.config.js`) rimasti in giro nel codice — se restano usi
   legittimi vanno migrati ai nuovi token equivalenti.
4. Controlla il contrasto testo/sfondo per i testi più chiari (`ink-tertiary` su `surface`/`surface-sidebar`)
   — deve restare leggibile, non scendere sotto un contrasto ragionevole per un'app usata per ore.
5. Riporta nel messaggio di consegna: quali file sono stati toccati, se hai fatto scelte non esplicitamente
   coperte da questo prompt (e perché), e conferma che backend e dipendenze npm non sono stati modificati
   oltre a quanto qui autorizzato.
