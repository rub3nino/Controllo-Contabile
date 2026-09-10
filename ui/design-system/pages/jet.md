# JET — override pagina

Usa `MASTER.md` più queste regole. Fonte: `code.html`.

## Chrome

- Icona pagina 48×48, card bianca, `shadow-sm`
- Titolo `text-3xl font-bold tracking-tight` `#2f3437`
- Tag Notion colorati (blu ISA 240, giallo JET), senza bordo
- Icona pagina su fondo `#e7f3f8`
- Sezioni: icona in pastello (verde controlli, blu pratiche, arancio fonti, viola analisi, giallo risultati)
- Metriche: verde / blu / giallo-rosso come i callout di `code.html`
- Pesi Baker Tilly come select Notion (blu = 1, arancio = 4, viola = estensione)
- Riga aperta: callout con barra laterale colorata
- Toolbar sotto il titolo con `border-b #eeede9`
- Bottoni secondari bianchi `text-xs shadow-xs`; una sola CTA scura (`Avvia analisi`)

## Pagine

1. **Catalogo** — lista pratiche. Nessun KPI finto.
2. **Incarico** (click su una pratica) — titolo = cliente, chip di stato, 4 metriche vere (popolazione, sospette, controlli attivi, fonti), fonte, matrice, stato analisi, risultati.

I 15 controlli restano **una matrice**. Selezionare una voce apre i campi in riga, non una pagina nuova.

## Superfici

- Sezioni: `bg-white rounded-lg border #e9e8e4 shadow-xs`, header `#faf9f7`
- Metriche: callout `#f7f6f3` (alert `#fff7f6`, pending `#fffcf5`)
- Input bianchi, bordo `#e9e8e4`, altezza 36px
- Tabelle `.notion-table`, testo `text-xs`

## Sorgente

Carica file (dropzone o «Aggiungi file»). Tabella fonti. Duplicati solo con 2+ file.
TXT/PDF: **Usa profilo** XOR **Nuovo profilo** (tabella posizioni con etichette, non 22 placeholder).
Se la fonte è pronta: riga di stato + «Modifica configurazione». Anteprima chiusa in `<details>`.

## 15 controlli

Lista database, non card impilate. Colonne: #, Controllo, Parametro / soglia, Motore, Baker Tilly, Attivo.
Campi solo al click sulla riga (una voce alla volta). Toggle on apre quella riga.

## Sfondo

I puntini vivono sul layer fisso dello shell, non sul div che scrolla.
