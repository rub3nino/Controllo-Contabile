# RITIRATO — non implementare

Questo prompt è **nullo**. Era basato su un errore di verifica mio: ho letto `ParamsPanel.tsx` (e le
sue dipendenze `NotionChrome.tsx`, `NotionTag.tsx`, `Switch.tsx`) dalla cartella di lavoro live sul Mac
senza controllare `git status` prima — quei file sono un redesign locale **non tracciato**, non fanno
parte della cronologia Git di questo branch. Il codice implementato correttamente al commit `95df9ee`
di `codex/jet-calendari-integrazione` **contiene già** il selettore Paese, direttamente in
`ui/src/jet/JetDashboard.tsx` (oggetto `EMPTY`, più un blocco `<select>` con i nove Paesi e la nota
"chiusure aggiuntive vs override" — verificato con `git diff 23b2e6d..95df9ee` e con `git show
95df9ee:ui/src/jet/JetDashboard.tsx`, non dalla cartella live).

Il Giorno 5 è quindi **approvato per intero**, backend e interfaccia inclusi — vedi la revisione datata
del 10/09/2026 corretta di conseguenza. Chi avesse già iniziato a lavorare su questo prompt deve
fermarsi: non serve nessuna modifica a `ParamsPanel.tsx` né ad alcun altro file per questa fase. Questo
file resta nel repository solo come traccia di cosa è stato ritirato e perché, non va eseguito.
