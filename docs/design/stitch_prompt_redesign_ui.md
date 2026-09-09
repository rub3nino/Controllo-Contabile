# Prompt per Google Stitch — Redesign UI Quadra (sidebar multi-sezione)

## Contesto

Quadra è uno strumento software interno usato da un team di revisori legali per compilare le
verifiche trimestrali previste dal principio di revisione SA Italia 250B (controllo contabile ex
art. 2409-ter c.c.) — lo strumento estrae dati da documenti contabili (estratti conto, F24, libri
giornale, bilancini) e li confronta con le carte di lavoro richieste dalla normativa, segnalando
scostamenti e dati mancanti. È usato internamente da revisori, non da clienti esterni — deve essere
prima di tutto uno strumento di lavoro quotidiano, non una vetrina commerciale: chiaro, veloce da
leggere, pensato per essere guardato per ore senza affaticare la vista.

Lo strumento oggi ha un'unica schermata con una barra di navigazione interna rudimentale. Va
riorganizzato in una struttura con **sidebar fissa a sinistra**, che raggruppa gli strumenti
disponibili in sezioni distinte, ciascuna aperta nell'area di contenuto principale a destra (non
nuove schede del browser).

## Vincolo di stile — non è un rebrand

**Non introdurre una nuova identità visiva.** Quadra ha già una palette scelta apposta per essere
sostenibile su turni di lavoro lunghi, e va mantenuta esattamente:

- Sfondo pagina: `#F6F6F3` (un grigio caldo chiarissimo, non bianco puro)
- Cards/pannelli: `#FFFFFF`
- Testo principale: `#1A1A1A`
- Testo secondario/etichette: `#6B6B6B`
- Bordi/separatori: `#E8E8E4`
- Font: Inter (sans-serif), gerarchia tramite peso e dimensione, non colore
- Ombre: molto leggere e diffuse, mai marcate (`0 1px 2px rgba(20,20,20,.04), 0 8px 24px
  rgba(20,20,20,.04)`)
- Colori di stato già in uso: rosa/rosso tenue (`rose-50`/`rose-200`/`rose-950`) per errori e
  anomalie, ambra tenue (`amber-50`/`amber-200`) per elementi mancanti/da controllare. Per gli stati
  positivi ("conforme", "completato") introduci un verde della stessa famiglia tenue (es.
  `emerald-50`/`emerald-200`/`emerald-800`), coerente con gli altri due, mai un verde acceso.

Niente viola, niente palette "brand" vistosa, niente elementi decorativi che non servono a leggere
più in fretta i dati. L'obiettivo estetico è: professionale, silenzioso, leggibile, mai stancante —
più vicino a uno strumento contabile serio che a un prodotto consumer.

## Struttura richiesta

**Sidebar fissa a sinistra** (larghezza indicativa 260-280px), sempre visibile, con in alto il nome
"Quadra". Sotto, cinque voci di menu, ciascuna un'icona outline coerente + etichetta:

1. **Controllo Contabile** — il lavoro già esistente (vedi sotto), è la sezione più usata,
   probabilmente va per prima o comunque in evidenza.
2. **JET** (Journal Entry Testing / analisi libro giornale) — nuova sezione, vedi sotto.
3. **Sezione 3** — segnaposto, nome non ancora definito.
4. **Sezione 4** — segnaposto.
5. **Sezione 5** — segnaposto.

Nessun profilo utente, nessun avatar, nessun login: si entra direttamente nell'applicazione. Nessuna
autenticazione va disegnata in questa fase.

## Contenuto della sezione "Controllo Contabile"

Non va reinventata, solo riportata dentro la nuova struttura: lista delle pratiche/clienti aperte,
possibilità di aprirne una nuova o riprenderne una esistente, e dentro una pratica le carte di
lavoro organizzate per sezione (A, B, C... fino a I — saldi iniziali, riconciliazioni bancarie, F24 e
deleghe, e altre), con indicazione chiara per ciascuna di: stato (fatto / da fare / anomalia
rilevata), provenienza del dato (da quale documento è stato estratto), e un pulsante per esportare il
risultato in Excel. Mostra anche un'area con lo storico dei documenti caricati per la pratica
corrente.

## Contenuto della sezione "JET"

Qui serve mostrare lo stato di avanzamento reale del lavoro fatto finora su questo modulo — non è
ancora uno strumento operativo con un pulsante "avvia analisi" funzionante, ma la sezione deve dare a
chi la apre un quadro completo e credibile di cosa è stato costruito e verificato:

- Un riepilogo dell'obiettivo: cos'è il Journal Entry Testing, perché serve (identificare
  registrazioni contabili anomale nel libro giornale secondo i criteri del principio ISA 240 §A44 —
  conti insoliti, importi a cifra tonda, registrazioni fuori orario o nei giorni festivi, personale
  non autorizzato, parti correlate, e altri).
- Una timeline o elenco a fasi dello stato di avanzamento, tutte completate finora: definizione dei
  contratti dati, ingest dei file del gestionale, replica degli undici criteri di rischio storici,
  copertura della dimensione "conto" (frequenza d'uso, conti insoliti/infragruppo), correzioni di
  robustezza su dati reali.
- Due riquadri/card con i risultati dei test reali già svolti, con numeri concreti da mostrare come
  prova di funzionamento: un cliente con 213.656 registrazioni contabili (dati SAP), dove i risultati
  del nuovo strumento coincidono esattamente con quelli del foglio Excel storico usato finora dal
  team; un secondo cliente con 56.133 registrazioni in un formato di export completamente diverso
  (una stampa del gestionale, non un file Excel), ingerito e analizzato con successo.
- Uno spazio riservato, ben visibile ma chiaramente etichettato come "prossimamente" o simile, per la
  futura area operativa dove si potrà caricare un file e avviare un'analisi vera — non deve sembrare
  un errore o una sezione rotta, ma un'anticipazione di cosa arriverà.

## Sezioni segnaposto (3, 4, 5)

Pagina semplice e curata nello stesso stile del resto (non una pagina bianca "rotta"): icona,
titolo della sezione (anche solo "Sezione in arrivo"), una riga di testo che indica che il contenuto
sarà definito in seguito. Devono trasmettere che sono parte di un piano, non un errore.

## Requisiti di accessibilità e leggibilità

Target minimo di tocco/click 44×44px, contrasto testo-sfondo almeno 4.5:1, stato di focus sempre
visibile sugli elementi interattivi, spaziature su una scala di 8px, transizioni brevi (150-250ms,
easing morbido), rispetto di `prefers-reduced-motion`. Tipografia con gerarchia chiara ma sobria:
titoli di sezione non più larghi di un peso medio, mai grassetti pesanti diffusi.

## Cosa NON deve comparire

Nessun login o schermata di autenticazione. Nessun avatar o nome utente fittizio in sidebar. Nessun
colore primario diverso da quelli elencati sopra (niente viola/indaco). Nessun elemento puramente
decorativo (illustrazioni, gradient vistosi, forme geometriche di sfondo) che non aiuti a leggere i
dati più velocemente.

## Cosa generare

Alcune varianti della stessa struttura (sidebar + area contenuto), mostrando come schermate
principali: la sezione "Controllo Contabile" con una pratica aperta e le sue carte di lavoro, la
sezione "JET" con il riepilogo di avanzamento e i due risultati reali, e una vista della sidebar con
tutte e cinque le voci visibili (incluse le tre segnaposto) per valutare la gerarchia del menu.
Sia in una variante con sidebar sempre espansa, sia — se utile — con la sidebar collassabile a sole
icone per schermi più piccoli.
