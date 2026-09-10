# Quadra design system

Fonte unica: `ui/src/design/reference.html` (copia di `code.html`).
Tutti i moduli CRM (shell, controllo, JET, placeholder) usano questi token.

## Stile

Notion / carta da lavoro. Inter. Icone Material Symbols Outlined (mai emoji strutturali).
Light di default. Dark resta un override, non inverte i colori.

## Colori

| Ruolo | Hex |
|---|---|
| Background | `#faf9f6` |
| Sidebar | `#f7f6f3` |
| Sidebar hover / active | `#ebebea` |
| Card | `#ffffff` |
| Callout | `#f7f6f3` |
| Border | `#e9e8e4` |
| Border subtle | `#ecebe8` |
| Table hairline | `#eeedea` |
| Text | `#37352f` / `#2f3437` |
| Text muted | `#5f5e5b` |
| Text subtle | `#787774` |
| Primary button | `#2f3437` hover `#1a1c1b` |
| OK | bg `#e6f4ea` text `#137333` |
| Alert | bg `#fce8e6` text `#c5221f` |
| Pending | bg `#fef7e0` text `#b06000` |
| Tag | `#f1f1ef` |

## Layout

- Sidebar fissa 260px
- Header sticky 40px, backdrop-blur
- Canvas a tutta larghezza (meno sidebar). Controllo: padding 12–24px. JET: padding pagina `px-8 sm:px-12 lg:px-16 py-8` come `code.html`
- Fondo a puntini **identico al mock** (`#d5d4d0` 1px, 20px) su layer **fisso** dietro il canvas: lo sfondo non scorre con il contenuto
- Tabelle database-style (`notion-table`), thead sticky, hover riga 2.5% ink
- Click sulla riga apre il dettaglio (non un bottone 11px)
- CTA primaria **una** per schermata (Avvia compilazione / Avvia analisi)
- Azioni rare (Configura, Nuova pratica) come bottoni bianchi `text-xs` + `shadow-xs`
- JET: catalogo pratiche → workspace incarico (KPI, fonte, matrice unica dei 15, risultati). Non paginare i controlli.
- Tabella corpo 12–14px, caption ≥11px
- Focus visibile 2px inchiostro su `:focus-visible`

## Densità (2–8 ore)

Due livelli, stesso stile:
- **Comodo:** cliente vuoto → form setup visibile
- **Compatto:** pratica aperta → titolo + proprietà + tabella full-height

## Anti-pattern

- Blu SaaS, Plus Jakarta, motion-heavy, emoji come icone di pagina
- Ombre decorative sulle card (solo `shadow-xs` / dropdown)
- Controlli finti (Filtra/Ordina senza azione)
- Due bottoni primary sulla stessa schermata
