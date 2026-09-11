# Prompt — JET: interruttori nell'interfaccia, legenda, scopo dei controlli (Giorno 8/15, parte 2 di 2) (Quadra — modulo JET)

## Contesto

Il prompt 35 (parte 1, motore) introduce quattordici campi `attivo_<nome>` in `ParametriClienteJet`,
già collegati alla logica di `valuta_riga`, ma senza alcun modo per l'utente di cambiarli
dall'interfaccia — restano al loro valore di default finché questo prompt non li espone. Questo prompt
è **solo interfaccia**, non tocca `backend/`.

Include anche un punto emerso da un'analisi che Ruben ha chiesto separatamente a Codex sull'intero
flusso JET: manca un oggetto strutturato che, per ciascun controllo, esponga scopo, rischio coperto,
campi richiesti, regola applicata e limiti — oggi questa informazione esiste solo nella documentazione
del codice, non nell'interfaccia. Lo aggiungiamo qui come pannello informativo statico.

**Non incluso in questo prompt** (segnalato dalla stessa analisi, ma rimandato): l'indicatore di
copertura ("quanti test erano calcolabili" in testa ai risultati) richiede un'aggregazione sul lato
backend su tutta la popolazione analizzata, non solo sulla pagina di risultati corrente — non ancora
scoperto in questa sessione come `backend/jet/pratica.py`/`store.py`/`api.py` gestiscono l'aggregazione
dei risultati. Sarà un prompt a parte (parte 3), scritto dopo aver letto quel codice, non indovinato ora.

## Cosa implementare

Tutto in `ui/src/jet/JetDashboard.tsx`, verificato sul commit `07757bf` (la punta consolidata del
lavoro JET). Nessuna modifica a `backend/` né a `ui/src/jet/api.ts` (i tipi `attivo_*` in `JetParams`
sono già presenti dal prompt 35, se già implementato — se non ancora, questo prompt comunque presuppone
che lo saranno, dato che dipende da quello).

**1. Interruttori sui pesi esistenti.** Nella sezione "Pesi dei criteri e soglia", il ciclo
`WEIGHTS.map(([key, label, optional]) => ...)` genera un `<Field>` per riga di `WEIGHTS`. Ogni chiave
`punteggio_X` ha un corrispondente `attivo_X` (stessa parte finale del nome, verificato: è così per
tutti gli undici criteri standard più i due di conto). Deriva la chiave dell'interruttore
meccanicamente, non a mano una per una:

```tsx
{WEIGHTS.map(([key, label, optional]) => {
  const attivoKey = key.replace("punteggio_", "attivo_") as keyof JetParams;
  return (
    <Field key={key} label={`${label}${optional ? " (opzionale)" : ""}`}>
      <label className="flex items-center gap-xs mb-xs text-body-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={Boolean(params[attivoKey])}
          onChange={(e) =>
            setParams({ ...params, [attivoKey]: e.target.checked })}
        />
        Attivo
      </label>
      <input
        required={!optional}
        min="0"
        type="number"
        value={(params[key] as number | null) ?? ""}
        placeholder="Non impostato"
        onChange={(e) =>
          setParams({
            ...params,
            [key]: e.target.value === "" && optional
              ? null
              : Number(e.target.value),
          })}
        className={inputClass}
      />
    </Field>
  );
})}
```

**2. Interruttore per la finestra di chiusura.** `attivo_finestra_chiusura` non ha una riga
corrispondente in `WEIGHTS` (il controllo non ha un peso proprio, è a punteggio zero per costruzione).
Aggiungi un `<Field label="Finestra di chiusura — attiva">` con lo stesso pattern di checkbox, vicino al
campo "Data di chiusura" già esistente (introdotto dal prompt 34).

**3. Precompilamento conto insolito/raro.** Nell'oggetto `EMPTY`, imposta
`punteggio_conto_insolito_raro: 4` e `soglia_frequenza_insolita: 10` (oggi sono `null`) — il peso e la
soglia sono pronti ma il controllo resta spento, perché `attivo_conto_insolito_raro` di default è
`false` (dal prompt 35). Non toccare gli altri valori di `EMPTY`.

**4. Legenda a quattro stati.** Un blocco di testo statico, vicino alla sezione "Pesi dei criteri e
soglia" (sopra o sotto, valuta tu in base allo spazio):

```tsx
<div className="text-body-sm text-ink-secondary border border-border-subtle rounded p-sm mb-md">
  <strong>Attivo</strong>: il criterio è acceso e i dati necessari sono presenti.{" "}
  <strong>Disattivato</strong>: hai spento tu il criterio con l'interruttore.{" "}
  <strong>Non applicabile</strong>: il criterio è acceso ma mancano i parametri di configurazione
  (es. nessuna soglia impostata).{" "}
  <strong>Non calcolabile</strong>: il criterio è acceso e configurato, ma per una specifica riga
  mancano i dati richiesti (es. nessuna ora di creazione su quella scrittura).
</div>
```

**5. Etichette "peso proposto" / "peso approvato dal partner".** Aggiungi un set con le chiavi dei
criteri il cui peso non ha ancora conferma esplicita dal partner (dalla decisione già presa nel piano
di sprint: backdating, festività, staff non autorizzato, descrizione vuota, parte correlata/keyword,
conto insolito/raro — **ho aggiunto anche conto infragruppo/parte correlata per coerenza**, essendo
un'estensione non standard analoga: se Ruben non è d'accordo su quest'ultima, va tolta, segnalalo nel
riepilogo invece di deciderlo tu):

```tsx
const PESI_PROPOSTI = new Set<keyof JetParams>([
  "punteggio_backdated",
  "punteggio_festivita",
  "punteggio_staff_non_autorizzato",
  "punteggio_descrizione_vuota",
  "punteggio_parte_correlata",
  "punteggio_conto_insolito_raro",
  "punteggio_conto_infragruppo_parte_correlata",
]);
```

Nel `label` del `<Field>` del punto 1, aggiungi l'etichetta corrispondente:

```tsx
label={`${label}${optional ? " (opzionale)" : ""} — ${
  PESI_PROPOSTI.has(key) ? "peso proposto" : "peso approvato dal partner"
}`}
```

**6. Pannello "scopo del controllo".** Nuova costante, fuori dal componente, con un'informazione
sintetica per ciascuno dei controlli (chiave = lo stesso nome usato in `FLAG_NAMES`, così un domani è
riusabile anche lato risultati):

```tsx
const SCOPO_CONTROLLI: Record<
  string,
  { obiettivo: string; rischio: string; campi: string; regola: string; limitazioni: string; eccezione: string }
> = {
  flag_profit_impact: {
    obiettivo: "Individuare scritture il cui importo pesa in modo rilevante sull'utile netto.",
    rischio: "Gestione del risultato (earnings management) tramite scritture di importo elevato.",
    campi: "Importo netto della riga; utile netto dopo imposte del cliente.",
    regola: "Importo assoluto > 10% dell'utile netto dopo imposte (valore assoluto).",
    limitazioni: "Non calcolabile se l'utile netto dopo imposte non è stato inserito.",
    eccezione: "La scrittura, da sola, sposterebbe il risultato riportato di oltre il 10% se errata.",
  },
  flag_oltre_dieci_volte_media: {
    obiettivo: "Individuare importi anomali rispetto alla dimensione tipica delle registrazioni.",
    rischio: "Scritture anomale per importo, spesso indice di errore o intervento fuori dal flusso ordinario.",
    campi: "Importo netto della riga; media assoluta delle registrazioni (manuale o calcolata sulla popolazione).",
    regola: "Importo assoluto > 10 volte la media assoluta delle registrazioni.",
    limitazioni: "La media, se automatica, esclude gli zeri ed è 'non disponibile' (mai zero) su popolazione vuota o tutta a zero.",
    eccezione: "L'importo è un multiplo estremo rispetto al resto della popolazione caricata.",
  },
  flag_sopra_performance_materiality: {
    obiettivo: "Segnalare le scritture che superano da sole la performance materiality dell'incarico.",
    rischio: "Un singolo errore in quella scrittura potrebbe essere materiale per il bilancio.",
    campi: "Importo netto della riga; performance materiality del cliente.",
    regola: "Importo assoluto > performance materiality.",
    limitazioni: "Oggi la performance materiality si inserisce a mano; l'import dal file Global Focus non è collegato.",
    eccezione: "L'importo della scrittura, da solo, supera già la soglia di materialità operativa.",
  },
  flag_importo_cifra_tonda: {
    obiettivo: "Individuare importi 'tondi' non giustificati.",
    rischio: "Scritture stimate o inserite senza un giustificativo con importo puntuale.",
    campi: "Importo netto della riga; soglia di arrotondamento configurata.",
    regola: "Importo divisibile esattamente per la soglia configurata.",
    limitazioni: "Senza soglia impostata, non calcolabile — nessun default nel motore.",
    eccezione: "L'importo è un multiplo esatto della soglia scelta.",
  },
  flag_weekend: {
    obiettivo: "Individuare scritture contabilizzate in un giorno non lavorativo standard.",
    rischio: "Registrazioni fuori dal normale flusso operativo.",
    campi: "Data effettiva; giorni di weekend (dal Paese selezionato, o impostati a mano — il manuale sostituisce interamente quello del Paese).",
    regola: "Il giorno della settimana della data effettiva è un giorno di weekend configurato.",
    limitazioni: "Non calcolabile senza Paese né lista manuale di giorni weekend.",
    eccezione: "La scrittura risulta contabilizzata in un giorno tipicamente non lavorativo.",
  },
  flag_festivita: {
    obiettivo: "Individuare scritture contabilizzate in un giorno festivo.",
    rischio: "Attività contabile fuori dal flusso operativo standard.",
    campi: "Data effettiva; calendario festività del Paese, più eventuali festività manuali (si sommano, non sostituiscono).",
    regola: "La data effettiva coincide con una festività del calendario effettivo.",
    limitazioni: "Non calcolabile se il Paese è impostato ma il calendario per quell'anno non è compilato e non ci sono festività manuali. Weekend e festività sullo stesso giorno contano solo il peso maggiore, non la somma.",
    eccezione: "La scrittura risulta contabilizzata in un giorno festivo.",
  },
  flag_fuori_orario: {
    obiettivo: "Individuare scritture create fuori dall'orario di lavoro dichiarato.",
    rischio: "Attività contabile in orari insoliti, potenzialmente fuori dalla supervisione normale.",
    campi: "Ora di creazione; orario d'ufficio inizio/fine (precompilato 8:00–18:00, sempre modificabile).",
    regola: "L'ora di creazione cade fuori dall'intervallo configurato.",
    limitazioni: "Non calcolabile senza ora di creazione nel file o senza orario configurato.",
    eccezione: "La scrittura è stata creata fuori dall'orario di lavoro dichiarato.",
  },
  flag_backdated: {
    obiettivo: "Individuare scritture registrate un numero significativo di giorni lavorativi dopo la data a cui si riferiscono.",
    rischio: "Ritardo anomalo nella contabilizzazione, possibile scrittura preparata a posteriori.",
    campi: "Data effettiva e data di creazione; soglia in giorni lavorativi (default 1); calendario del Paese, se impostato.",
    regola: "Scarto in giorni lavorativi ≥ soglia. Senza Paese, o senza calendario disponibile per gli anni coinvolti, si usano i giorni di calendario — il metodo usato è registrato riga per riga.",
    limitazioni: "Se la creazione precede la data effettiva non è retrodatazione ma 'anticipo' (vedi sotto).",
    eccezione: "La scrittura è stata registrata con un ritardo anomalo.",
  },
  flag_forward_dating: {
    obiettivo: "Segnalare, a titolo informativo, le scritture create prima della data a cui si riferiscono.",
    rischio: "Pattern meno tipico della retrodatazione, utile da poter isolare in revisione.",
    campi: "Data effettiva e data di creazione della riga.",
    regola: "Data di creazione antecedente alla data effettiva.",
    limitazioni: "Non contribuisce mai al punteggio: è informativo per costruzione, non un peso a zero.",
    eccezione: "La scrittura risulta creata prima della data a cui si riferisce.",
  },
  flag_staff_non_autorizzato: {
    obiettivo: "Individuare scritture inserite da un utente non nell'elenco staff autorizzato.",
    rischio: "Intervento contabile da personale non abilitato per quel cliente.",
    campi: "Utente della riga; elenco staff autorizzato; elenco utenti di sistema (esclusi dal test).",
    regola: "L'utente non è nello staff autorizzato e non è un utente di sistema.",
    limitazioni: "Non calcolabile senza elenco staff configurato o senza utente riportato dal file.",
    eccezione: "La scrittura è stata inserita da qualcuno non autorizzato per questa pratica.",
  },
  flag_parte_correlata: {
    obiettivo: "Individuare scritture la cui descrizione richiama parti correlate o infragruppo.",
    rischio: "Le operazioni con parti correlate sono un'area a rischio intrinseco elevato (ISA 240).",
    campi: "Descrizione/causale della riga; elenco di parole chiave configurate.",
    regola: "La descrizione contiene per intero una delle parole chiave (corrispondenza esatta).",
    limitazioni: "Non calcolabile senza elenco di parole chiave configurato.",
    eccezione: "La descrizione richiama esplicitamente una parte correlata nota.",
  },
  flag_descrizione_vuota: {
    obiettivo: "Individuare scritture senza descrizione o causale.",
    rischio: "Assenza di motivazione documentale, requisito minimo di tracciabilità.",
    campi: "Descrizione/causale della riga.",
    regola: "La descrizione, tolti gli spazi, è vuota.",
    limitazioni: "A differenza degli altri, non è mai 'non calcolabile': è sempre verificabile.",
    eccezione: "La scrittura non riporta alcuna motivazione testuale.",
  },
  flag_conto_insolito_raro: {
    obiettivo: "Individuare scritture su conti usati raramente nell'anno.",
    rischio: "Un conto usato poche volte può nascondere un'operazione fuori standard.",
    campi: "Conto contabile; frequenza di utilizzo nella popolazione; soglia di frequenza insolita.",
    regola: "Il conto è usato meno volte della soglia configurata nell'intera popolazione caricata.",
    limitazioni: "Estensione non ancora approvata dal partner (peso proposto); disattivata di default anche a peso/soglia già precompilati.",
    eccezione: "Il conto è tra i meno utilizzati dell'intera popolazione.",
  },
  flag_conto_infragruppo_parte_correlata: {
    obiettivo: "Individuare scritture su conti esplicitamente classificati come infragruppo o parte correlata.",
    rischio: "Le operazioni infragruppo/parti correlate sono un'area a rischio intrinseco elevato (ISA 240).",
    campi: "Conto contabile della riga; elenco dei conti classificati come infragruppo/parte correlata.",
    regola: "Il conto della riga è nell'elenco configurato.",
    limitazioni: "Estensione non ancora approvata dal partner; disattivata di default; non calcolabile senza elenco configurato.",
    eccezione: "La scrittura è su un conto classificato come infragruppo o parte correlata.",
  },
  flag_finestra_chiusura: {
    obiettivo: "Isolare le scritture negli ultimi giorni lavorativi prima della chiusura, e quelle registrate dopo la chiusura con competenza nel periodo già chiuso.",
    rischio: "Le rettifiche last-minute e le scritture fuori tempo massimo sono l'area classica delle manipolazioni di fine periodo (ISA 240 §A44).",
    campi: "Data effettiva e di creazione; data di chiusura (default 31/12 dell'anno della pratica); finestra in giorni lavorativi (default 5); calendario del Paese, obbligatorio.",
    regola: "Finestra: la data effettiva cade negli ultimi N giorni lavorativi fino alla chiusura inclusa. Creata dopo chiusura: creazione successiva alla chiusura, competenza nel periodo chiuso.",
    limitazioni: "Due liste obbligatorie separate, non subordinate al punteggio. Richiede sempre il Paese: nessun metodo alternativo a giorni di calendario per questo controllo.",
    eccezione: "La scrittura cade nella finestra critica di chiusura, o è stata registrata a periodo già chiuso.",
  },
};
```

Rendering: un piccolo pulsante/icona "i" accanto a ciascun `<Field>` della sezione pesi (punto 1) e
accanto al campo finestra di chiusura (punto 2), che apre/mostra (anche solo con `title=` come tooltip
nativo, se preferisci restare semplice) il contenuto di `SCOPO_CONTROLLI[flagKey]` — dove `flagKey` si
deriva da `key` sostituendo `punteggio_` con `flag_` (stesso schema mnemonico usato per `attivoKey`).
Non serve un componente elaborato: anche un `<details><summary>ℹ️</summary>...</details>` accanto al
`Field` va bene, l'importante è che il contenuto sia raggiungibile senza ingombrare la vista principale
del form.

## Cosa NON fare

- Non toccare `backend/` in nessun file.
- Non implementare l'indicatore di copertura: è rimandato alla parte 3, dopo aver letto
  `pratica.py`/`store.py`/`api.py`.
- Non inventare testo diverso da quello fornito per `SCOPO_CONTROLLI`: è contenuto metodologico
  (riferimenti ISA 240), non copy libero — se noti un'imprecisione, segnalala nel riepilogo invece di
  correggerla di tua iniziativa.
- Non cambiare `PESI_PROPOSTI` rispetto alla lista data, salvo la nota esplicita sopra su conto
  infragruppo (che resta comunque da confermare con Ruben, non da decidere tu).
- Non introdurre alcuna logica di disabilitazione del campo peso quando l'interruttore è spento: il
  campo resta sempre modificabile, anche se il criterio è disattivato (permette di precompilare un
  valore pronto per quando verrà riacceso, come nel caso del conto insolito/raro).

## Verifica richiesta prima della consegna

Nessuna modifica al backend, quindi non serve rilanciare la suite Python. Serve il controllo TypeScript
in un checkout pulito (`git archive`, non la cartella live): il comando esatto del progetto
(`npx tsc --noEmit` dalla cartella `ui/`, o quanto risulta da `package.json`/CI). Incolla l'output
letterale, anche se pulito.

## Consegna

**Da qui in avanti, commit diretti su `jet/sprint-15-controlli`** (non più un branch nuovo per fase) —
verifica prima che quel branch sia già stato allineato al lavoro del prompt 35 (parte 1); se non lo è
ancora, aspetta o segnalalo invece di procedere su una base incompleta. Nessun push né PR, come sempre.
Nel riepilogo: file toccati (solo `ui/src/jet/JetDashboard.tsx`), conferma che il controllo TypeScript
passa in ambiente pulito, e qualunque dubbio sul contenuto di `SCOPO_CONTROLLI`/`PESI_PROPOSTI` invece di
risolverlo autonomamente.
