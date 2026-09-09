# Primo test reale JET su un cliente diverso da Nordson — ALUK GROUP S.P.A.

Tre file: libro giornale set-nov 2025, dic 2025-feb 2026, mar-mag 2026 (9 mesi, probabilmente il
periodo del controllo). Formato completamente diverso da Nordson: non un export Excel SAP, ma una
stampa a larghezza fissa del gestionale (due righe di testo per movimento, intestazioni di stampa
ripetute, totali di controllo a fondo pagina). Ho scritto un parser dedicato (non ho toccato
`backend/jet/`, che ho usato così com'è, esattamente come approvato) e l'ho eseguito qui, nel mio
ambiente, non sul tuo Mac: **il device è momentaneamente disconnesso** mentre scrivo, quindi questo
lavoro non è ancora committato nel repository — lo farò appena si riconnette, non ho perso nulla nel
frattempo.

## Il parser — verificato, non solo scritto

Il formato è a colonne di larghezza fissa non allineate in modo ovvio (le descrizioni contengono
spazi multipli, gli importi Dare/Avere sono due colonne separate che a volte si sovrappongono per un
carattere quando il numero è lungo). Ho individuato le posizioni esatte leggendo l'intestazione di
stampa carattere per carattere, non per split su spazi.

Non mi sono fidato del parser solo perché non dava errori: ogni file di stampa riporta i propri
totali di controllo ("TOTALI STAMPA: Dare / Avere / Saldo"). Ho sommato indipendentemente Dare e
Avere di tutte le righe estratte e confrontato con quei totali:

| Periodo | Righe estratte | Dare calcolato | Dare dichiarato | Coerente |
|---|---:|---:|---:|---|
| Set-Nov 2025 | 20.518 | 205.214.044,41 | 205.214.044,41 | sì |
| Dic 2025-Feb 2026 | 17.022 | 79.166.897,12 | 79.166.897,12 | sì |
| Mar-Mag 2026 | 18.593 | 65.817.332,68 | 65.817.332,68 | sì |

Coincidenza esatta sui tre periodi, zero anomalie di parsing su 56.133 righe totali. Non è una prova
assoluta che ogni singolo campo sia letto bene, ma è una prova forte che la lettura degli importi e
la segmentazione riga-per-riga sono corrette su tutta la popolazione, non solo su un campione.

## Popolazione complessiva

56.133 registrazioni, dal 01/09/2025 al 31/05/2026. Ho mappato ogni riga a `RigaGiornale` (lo stesso
contratto usato per Nordson) e fatto girare `backend/jet/` senza modificarlo.

## Criteri calcolabili senza configurazione specifica del cliente

| Criterio | Righe | % |
|---|---:|---:|
| Importo a cifra tonda | 4.219 | 7,52% |
| Registrato nel weekend | 1.839 | 3,28% |
| Descrizione vuota | 0 | 0,00% |
| Senza numero documento | 7.407 | 13,20% |

## Dimensione conto — diversa da Nordson, non un errore

1.664 conti distinti, ma solo il 26% ha un codice puramente numerico. A differenza di Nordson, qui
non è un problema di colonna sbagliata: questo gestionale usa correttamente codici alfanumerici per
i sottoconti di fornitori/clienti (es. `F0002239` = TIM SPA, `C0008321` = un cliente) accanto ai
conti generali numerici — è la convenzione normale di questo sistema, non un'etichetta di documento
mascherata da conto come era "Conto contabile" in Nordson. La distribuzione di frequenza è comunque
utile: 209 conti usati una sola volta, 711 sotto 5 utilizzi (1.549 righe, il 2,8% della popolazione)
— un punto di partenza ragionevole per una soglia di rarità, ma la decisione resta tua/del cliente,
come da prassi già stabilita.

## Cosa non ho calcolato, e perché — due categorie diverse

**Strutturalmente non disponibile in questo formato di export** (non è mancanza di configurazione,
è che il dato proprio non c'è nella stampa): fuori orario, backdated, staff non autorizzato. Questo
export non contiene né l'ora/data di creazione a sistema né l'utente che ha registrato — a
differenza dell'export SAP di Nordson. Se in futuro serve testare questi tre criteri su questo
cliente, serve chiedere al gestionale un export diverso (se esiste) che porti quei campi.

**Non fornito per questo cliente, ma potenzialmente disponibile**: profit impact, oltre 10 volte la
media, sopra performance materiality (servono cifre di bilancio reali), festività (calendario),
parti correlate (parole chiave), conto insolito/infragruppo (soglia di rarità e lista conti). Non li
ho stimati — sarebbe stato inventare dati, la stessa disciplina seguita fin dall'inizio del
progetto. Se vuoi un output di audit vero e proprio (non solo diagnostico) su ALUK, servono questi
parametri da te o dal team di incarico.

## Due problemi reali trovati testando su dati veri, non sintetici

**1. `verifica_sequenza` va in crash su numerazioni reali eterogenee.** Ho provato a testare la
sequenza dei numeri documento e lo script si è bloccato fino a essere terminato dal sistema per
esaurimento memoria. Causa: il campo "Num.Docum." di questo gestionale non è un'unica serie
sequenziale — mescola veri numeri di fattura/protocollo (es. "756", piccoli) con altri riferimenti
completamente diversi che sono comunque solo cifre, come codici di mandato RID/SDD
("4220425800055956", 16 cifre). La funzione oggi presume che qualunque valore numerico faccia parte
di un'unica sequenza densa e prova a enumerare tutti i "buchi" fra il minimo e il massimo — con un
salto da poche centinaia a 16 cifre, il numero di "buchi" da generare è dell'ordine di 10 alla 19,
un numero che nessun programma può materializzare. Non è un problema specifico di ALUK: qualunque
cliente con più tipologie di documento nello stesso campo può riprodurlo. Va corretto prima di poter
usare questo test in modo affidabile su dati reali arbitrari.

**2. Un'incoerenza di contratto che avevamo già toccato in Fase 3, più ampia di quanto pensassi.**
Quando `staff_autorizzato`/`orario_ufficio`/`soglia_backdating_giorni` non sono configurati,
`valuta_riga` restituisce correttamente `None` (non calcolabile) — l'avevamo corretto insieme prima
della Fase 3. Ma per gli altri criteri che dipendono da configurazione opzionale — profit impact,
oltre 10x media, sopra performance materiality, festività, parti correlate — la stessa assenza di
configurazione produce `False`, cioè "controllato e risultato negativo", non "non controllato". Con
un cliente come ALUK che oggi non ha nessuno di questi parametri, un report che mostra "0 righe sopra
performance materiality" sarebbe falso e fuorviante — in realtà quel criterio non è mai stato
valutato. Andrebbe reso coerente: stesso trattamento `None` già usato per gli altri tre.

## Cosa consiglio

Nessuna modifica al lavoro già approvato su Nordson — questi due problemi non lo riguardano (Nordson
ha sempre avuto tutti i parametri configurati, e la sua sequenza usa un contatore denso, non
soggetto al bug). Preparo un prompt mirato e piccolo per correggere entrambi i punti prima di fidarci
del modulo su qualunque cliente reale futuro, ALUK compreso. Fammi sapere anche se vuoi che chieda
(o che tu mi fornisca) i parametri mancanti di ALUK per un vero output di audit, oppure se per ora
questo livello diagnostico ti basta per la presentazione/verifica che avevi in mente.
