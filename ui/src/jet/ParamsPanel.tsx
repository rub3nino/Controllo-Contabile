/**
 * Matrice dei 15 controlli JET: una riga = un controllo.
 * Attivo spegne il test; il peso 1–4 entra in colonna solo se il motore lo somma.
 */

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { StatusBadge } from "../components";
import type { JetParams } from "./api";

const inputClass =
  "w-full h-10 px-md rounded border border-border-subtle bg-surface text-body-md text-ink-primary outline-none focus:border-ink-secondary";
const pesoSelectClass = (tone: "blue" | "orange" | "neutral" | "gray") => {
  const toneClass =
    tone === "blue"
      ? "bg-tint-blue-bg text-tint-blue-text border-transparent"
      : tone === "orange"
      ? "bg-tint-orange-bg text-tint-orange-text border-transparent"
      : tone === "gray"
      ? "bg-tint-gray-bg text-tint-gray-text border-transparent"
      : "bg-surface border-border-subtle text-ink-primary";
  return `h-8 min-w-[4.5rem] px-sm rounded text-label-sm outline-none focus:border-ink-secondary ${toneClass}`;
};

const PAESI = [
  ["IT", "Italia"],
  ["DE", "Germania"],
  ["FR", "Francia"],
  ["ES", "Spagna"],
  ["IL", "Israele"],
  ["US", "Stati Uniti"],
  ["MT", "Malta"],
  ["IE", "Irlanda"],
  ["CY", "Cipro"],
] as const;

const WEEKEND_DAYS = [
  { n: 5, label: "Sabato" },
  { n: 6, label: "Domenica" },
  { n: 0, label: "Lunedì" },
  { n: 1, label: "Martedì" },
  { n: 2, label: "Mercoledì" },
  { n: 3, label: "Giovedì" },
  { n: 4, label: "Venerdì" },
] as const;

const ROUND_PRESETS = [10000, 100000, 1000000];

const PESI_PROPOSTI = new Set<keyof JetParams>([
  "punteggio_backdated",
  "punteggio_festivita",
  "punteggio_staff_non_autorizzato",
  "punteggio_descrizione_vuota",
  "punteggio_parte_correlata",
  "punteggio_conto_insolito_raro",
]);

type PesoKey = Extract<keyof JetParams, `punteggio_${string}`>;
type AttivoKey = Extract<keyof JetParams, `attivo_${string}`>;
type ControlStatus = "presente" | "parziale" | "assente";

type PesoSlot = {
  key: PesoKey;
  label?: string;
};

type ControlDef = {
  id: string;
  title: string;
  status: ControlStatus;
  baker: string;
  hint: string;
  flagKeys: string[];
  available: boolean;
  attivoKeys: AttivoKey[];
  pesi: PesoSlot[];
};

const CONTROLS: ControlDef[] = [
  {
    id: "01",
    title: "Impatto superiore al 10% dell’utile netto",
    status: "presente",
    baker: "Profit impact",
    hint: "Confronte |importo| con il 10% di |utile netto dopo imposte|. Senza utile il criterio resta non calcolabile.",
    flagKeys: ["flag_profit_impact"],
    available: true,
    attivoKeys: ["attivo_profit_impact"],
    pesi: [{ key: "punteggio_profit_impact" }],
  },
  {
    id: "02",
    title: "Importi superiori a 10 volte la media",
    status: "parziale",
    baker: ">10x average journal size",
    hint: "La media esce dal giornale caricato se non la imposti a mano. Ponte vuoto = calcolata in analisi.",
    flagKeys: ["flag_oltre_dieci_volte_media"],
    available: true,
    attivoKeys: ["attivo_oltre_dieci_volte_media"],
    pesi: [{ key: "punteggio_oltre_dieci_volte_media" }],
  },
  {
    id: "03",
    title: "Superamento della materialità (Global Focus)",
    status: "parziale",
    baker: "Above performance materiality",
    hint: "Il motore usa la performance materiality. La materialità di bilancio è solo di riconciliazione.",
    flagKeys: ["flag_sopra_performance_materiality"],
    available: true,
    attivoKeys: ["attivo_sopra_performance_materiality"],
    pesi: [{ key: "punteggio_sopra_performance_materiality" }],
  },
  {
    id: "04",
    title: "Cifre tonde (multipli di 10.000 / 100.000)",
    status: "parziale",
    baker: "Round sum amount",
    hint: "Importo divisibile esattamente per la soglia scelta. Senza soglia il criterio non è calcolabile.",
    flagKeys: ["flag_importo_cifra_tonda"],
    available: true,
    attivoKeys: ["attivo_importo_cifra_tonda"],
    pesi: [{ key: "punteggio_importo_cifra_tonda" }],
  },
  {
    id: "05",
    title: "Weekend e festività per Paese",
    status: "parziale",
    baker: "Weekend · Festività",
    hint: "Due criteri distinti. Se cadono sullo stesso giorno conta solo il peso maggiore, non la somma.",
    flagKeys: ["flag_weekend", "flag_festivita"],
    available: true,
    attivoKeys: ["attivo_weekend", "attivo_festivita"],
    pesi: [
      { key: "punteggio_weekend", label: "Weekend" },
      { key: "punteggio_festivita", label: "Festività" },
    ],
  },
  {
    id: "06",
    title: "Fuori orario (prima delle 8:00 / dopo le 18:00)",
    status: "presente",
    baker: "Posted outside of office hours",
    hint: "Senza ora di creazione nel file, o senza orario configurato, il criterio resta non calcolabile.",
    flagKeys: ["flag_fuori_orario"],
    available: true,
    attivoKeys: ["attivo_fuori_orario"],
    pesi: [{ key: "punteggio_fuori_orario" }],
  },
  {
    id: "07",
    title: "Registrazioni retrodatate",
    status: "parziale",
    baker: "Backdated",
    hint: "Ritardo in giorni lavorativi tra data effettiva e creazione. L’anticipo (forward dating) è informativo e non entra nel punteggio.",
    flagKeys: ["flag_backdated", "flag_forward_dating"],
    available: true,
    attivoKeys: ["attivo_backdated"],
    pesi: [{ key: "punteggio_backdated" }],
  },
  {
    id: "07b",
    title: "Finestra di chiusura",
    status: "presente",
    baker: "Fuori punteggio",
    hint: "Liste obbligatorie (finestra ultimi N giorni lavorativi e create dopo chiusura). Punteggio 0 per costruzione — spegnere ≠ peso 0.",
    flagKeys: ["flag_finestra_chiusura", "flag_creata_dopo_chiusura"],
    available: true,
    attivoKeys: ["attivo_finestra_chiusura"],
    pesi: [],
  },
  {
    id: "08",
    title: "Utenti non autorizzati",
    status: "presente",
    baker: "Posted by an unauthorised person",
    hint: "Senza elenco staff il motore non calcola il criterio. Gli utenti di sistema sono esclusi dal test.",
    flagKeys: ["flag_staff_non_autorizzato"],
    available: true,
    attivoKeys: ["attivo_staff_non_autorizzato"],
    pesi: [{ key: "punteggio_staff_non_autorizzato" }],
  },
  {
    id: "09",
    title: "Righe vuote o senza descrizione",
    status: "presente",
    baker: "Journal description is blank",
    hint: "Nessun dato cliente: descrizione assente o solo spazi. Sempre verificabile, mai «non calcolabile».",
    flagKeys: ["flag_descrizione_vuota"],
    available: true,
    attivoKeys: ["attivo_descrizione_vuota"],
    pesi: [{ key: "punteggio_descrizione_vuota" }],
  },
  {
    id: "10",
    title: "Conto insolito o raro (2–4 volte l’anno)",
    status: "parziale",
    baker: "Estensione Quadra",
    hint: "Frequenza uguale o inferiore alla soglia sulla popolazione caricata. Disattivato di default: peso proposto, non ancora nello standard Baker Tilly.",
    flagKeys: ["flag_conto_insolito_raro"],
    available: true,
    attivoKeys: ["attivo_conto_insolito_raro"],
    pesi: [{ key: "punteggio_conto_insolito_raro" }],
  },
  {
    id: "11",
    title: "Test di sequenza numerica e controllo per pagina",
    status: "parziale",
    baker: "Fuori punteggio",
    hint: "Completezza, non rischio: per i PDF il caricamento conta le pagine e verifica automaticamente l’eventuale numerazione stampata, segnalando buchi o duplicati senza punteggio. Excel e TXT saranno supportati in futuro.",
    flagKeys: [],
    available: true,
    attivoKeys: [],
    pesi: [],
  },
  {
    id: "12",
    title: "Cifre finali ripetute",
    status: "presente",
    baker: "Estensione Quadra — nessun peso ufficiale nella tabella Global Focus",
    hint: "Segnala 3 o più cifre finali uguali e non-zero; esclude gli importi tondi e i soli centesimi a ,99.",
    flagKeys: ["flag_cifre_ripetute"],
    available: true,
    attivoKeys: ["attivo_cifre_ripetute"],
    pesi: [{ key: "punteggio_cifre_ripetute" }],
  },
  {
    id: "13",
    title: "Ri-analisi mirata sui soli dati sospetti",
    status: "assente",
    baker: "Estensione Quadra",
    hint: "Ancora assente nel motore. Esiste il filtro export «da investigare», non un secondo livello automatico.",
    flagKeys: [],
    available: false,
    attivoKeys: [],
    pesi: [],
  },
  {
    id: "14",
    title: "Numero di conto superiore a 10 cifre",
    status: "presente",
    baker: "Estensione Quadra — nessun peso ufficiale nella tabella Global Focus",
    hint: "Conta esclusivamente le cifre numeriche del codice conto e segnala quando sono più di 10. Disattivato di default.",
    flagKeys: ["flag_conto_lunghezza"],
    available: true,
    attivoKeys: ["attivo_conto_lunghezza"],
    pesi: [{ key: "punteggio_conto_lunghezza" }],
  },
  {
    id: "15",
    title: "Parole chiave di frode e OCR della visura",
    status: "parziale",
    baker: "Related party / keyword match",
    hint: "Le keyword in descrizione e i nominativi dalla visura camerale (inseriti manualmente) confluiscono nello stesso criterio «parte correlata» e nello stesso peso. Nessun OCR: i nominativi vanno inseriti a mano.",
    flagKeys: ["flag_parte_correlata", "flag_conto_infragruppo_parte_correlata"],
    available: true,
    attivoKeys: ["attivo_parte_correlata"],
    pesi: [{ key: "punteggio_parte_correlata", label: "Keyword" }],
  },
];

const SCOPO_CONTROLLI: Record<
  string,
  {
    obiettivo: string;
    rischio: string;
    campi: string;
    regola: string;
    limitazioni: string;
    eccezione: string;
  }
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
    campi: "Descrizione/causale della riga; elenco di parole chiave configurate; elenco di nominativi da visura camerale inseriti manualmente.",
    regola: "La descrizione contiene, come sottostringa case-insensitive, una delle parole chiave o uno dei nominativi da visura camerale configurati.",
    limitazioni: "Non calcolabile solo se né l'elenco di parole chiave né l'elenco di nominativi da visura camerale sono configurati (entrambi assenti).",
    eccezione: "La descrizione richiama esplicitamente una parola chiave o un nominativo da visura camerale configurato.",
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
    regola: "Il conto è usato un numero di volte uguale o inferiore alla soglia configurata nell'intera popolazione caricata.",
    limitazioni: "Estensione non ancora approvata dal partner (peso proposto); disattivata di default anche a peso/soglia già precompilati.",
    eccezione: "Il conto è tra i meno utilizzati dell'intera popolazione.",
  },
  flag_cifre_ripetute: {
    obiettivo: "Individuare importi che terminano con una sequenza insolita di cifre uguali.",
    rischio: "Una ripetizione anomala nelle cifre finali può indicare un importo costruito o inserito manualmente.",
    campi: "Importo netto della riga, arrotondato a due decimali.",
    regola: "Almeno 3 cifre finali consecutive uguali e diverse da zero; la soglia è fissa e non configurabile.",
    limitazioni: "Gli zeri finali sono sempre esclusi perché coperti dal controllo cifra tonda. Un finale ,99 isolato ha solo due 9 e non è segnalato; una sequenza estesa di almeno tre 9 resta valida.",
    eccezione: "L'importo termina con almeno tre cifre non-zero uguali consecutive.",
  },
  flag_conto_infragruppo_parte_correlata: {
    obiettivo: "Individuare scritture su conti esplicitamente classificati come infragruppo o parte correlata.",
    rischio: "Le operazioni infragruppo/parti correlate sono un'area a rischio intrinseco elevato (ISA 240).",
    campi: "Conto contabile della riga; elenco dei conti classificati come infragruppo/parte correlata.",
    regola: "Il conto della riga è nell'elenco configurato.",
    limitazioni: "Estensione non ancora approvata dal partner; disattivata di default; non calcolabile senza elenco configurato.",
    eccezione: "La scrittura è su un conto classificato come infragruppo o parte correlata.",
  },
  flag_conto_lunghezza: {
    obiettivo: "Individuare scritture associate a codici conto con più di 10 cifre numeriche.",
    rischio: "Un codice conto insolitamente lungo può indicare una classificazione anomala o un dato importato non coerente.",
    campi: "Conto contabile della riga.",
    regola: "Il conto contiene più di 10 cifre numeriche; la soglia è fissa e non configurabile.",
    limitazioni: "Conta solo i caratteri numerici e ignora lettere, trattini, spazi e altri separatori; non calcolabile senza conto.",
    eccezione: "Il codice conto contiene almeno 11 cifre numeriche.",
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

function isOn(control: ControlDef, params: JetParams): boolean {
  if (!control.available || control.attivoKeys.length === 0) return false;
  return control.attivoKeys.some((key) => Boolean(params[key]));
}

function setAttivo(
  params: JetParams,
  keys: AttivoKey[],
  value: boolean,
): JetParams {
  return keys.reduce(
    (acc, key) => ({ ...acc, [key]: value }),
    params,
  );
}

function euro(n: number | null | undefined) {
  if (n == null) return null;
  const value = Number(n);
  if (Number.isNaN(value)) return null;
  return `€ ${value.toLocaleString("it-IT")}`;
}

function paramSummary(control: ControlDef, p: JetParams, on: boolean) {
  if (!control.available) return "Non nel motore";
  if (!on) return "Non applicabile";
  if (control.id === "01") {
    return euro(p.utile_netto_dopo_imposte)
      ? `Utile ${euro(p.utile_netto_dopo_imposte)}`
      : "Utile non impostato";
  }
  if (control.id === "02") {
    return euro(p.valore_medio_registrazione)
      ? `Media ${euro(p.valore_medio_registrazione)}`
      : "Media dal file (ponte vuoto)";
  }
  if (control.id === "03") {
    return euro(p.performance_materiality)
      ? `PM ${euro(p.performance_materiality)}`
      : "Performance materiality vuota";
  }
  if (control.id === "04") {
    const soglia = p.soglia_importo_cifra_tonda;
    return soglia == null
      ? "Soglia non impostata"
      : `Divisibile per ${Number(soglia).toLocaleString("it-IT")}`;
  }
  if (control.id === "05") {
    const paese = p.paese || "nessun Paese";
    const days = (p.giorni_weekend || []).length;
    const hols = p.festivita?.length || 0;
    return `${paese} · ${days} weekend · ${hols} festività`;
  }
  if (control.id === "06") {
    if (!p.orario_ufficio_inizio || !p.orario_ufficio_fine) {
      return "Orario non impostato";
    }
    return `${p.orario_ufficio_inizio} – ${p.orario_ufficio_fine}`;
  }
  if (control.id === "07") {
    return p.soglia_backdating_giorni == null
      ? "Soglia giorni vuota"
      : `Retrodatazione ≥ ${p.soglia_backdating_giorni} g lav.`;
  }
  if (control.id === "07b") {
    const giorni = p.finestra_chiusura_giorni_lavorativi;
    return p.data_chiusura
      ? `${p.data_chiusura}${giorni == null ? "" : ` · ${giorni} g lav.`}`
      : "Data chiusura vuota";
  }
  if (control.id === "08") {
    const staff = p.staff_autorizzato?.length || 0;
    const sys = p.utenti_di_sistema?.length || 0;
    return staff || sys ? `Staff ${staff} · sistema ${sys}` : "Elenchi vuoti";
  }
  if (control.id === "09") return "Descrizione vuota o solo spazi";
  if (control.id === "10") {
    return p.soglia_frequenza_insolita == null
      ? "Soglia frequenza vuota"
      : `Sotto ${p.soglia_frequenza_insolita} usi nel file`;
  }
  if (control.id === "11") return "Sequenza numerica, senza punteggio";
  if (control.id === "15") {
    const terms =
      (p.parole_chiave_parti_correlate?.length || 0) +
      (p.nominativi_visura_camerale?.length || 0);
    const accounts = p.conti_infragruppo_parte_correlata?.length || 0;
    return terms || accounts
      ? `${terms} termini · ${accounts} conti`
      : "Keyword / conti vuoti";
  }
  return "—";
}

function pesoTone(value: number | null): "blue" | "orange" | "neutral" | "gray" {
  if (value === 1) return "blue";
  if (value === 4) return "orange";
  if (value == null) return "gray";
  return "neutral";
}

function PesoSelect({
  value,
  label,
  onChange,
  optional,
}: {
  value: number | null;
  label?: string;
  onChange: (n: number | null) => void;
  optional?: boolean;
}) {
  const inScale = value === 1 || value === 2 || value === 3 || value === 4;
  const shown = optional && value == null ? "" : inScale ? String(value) : String(value ?? "");
  return (
    <label className="flex flex-col gap-xxs min-w-0" onClick={(e) => e.stopPropagation()}>
      {label && (
        <span className="text-label-sm text-ink-tertiary">{label}</span>
      )}
      <select
        aria-label={label ? `Peso ${label}` : "Peso"}
        value={shown}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={pesoSelectClass(pesoTone(inScale ? value : value == null ? null : Number(shown)))}
      >
        {optional && <option value="">—</option>}
        {!inScale && value != null && (
          <option value={value}>{value} (fuori scala)</option>
        )}
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
      </select>
    </label>
  );
}

function pesoLabel(control: ControlDef): string | null {
  if (control.pesi.length === 0) return null;
  const proposed = control.pesi.some((slot) => PESI_PROPOSTI.has(slot.key));
  const approved = control.pesi.some((slot) => !PESI_PROPOSTI.has(slot.key));
  if (proposed && approved) return "peso misto (proposto / approvato)";
  return proposed ? "peso proposto" : "peso approvato dal partner";
}

export function countActiveControls(params: JetParams) {
  return CONTROLS.filter((c) => c.available && isOn(c, params)).length;
}

export function ParamsPanel({
  params,
  setParams,
  busy,
  onSave,
}: {
  params: JetParams;
  setParams: (next: JetParams) => void;
  busy: boolean;
  onSave: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const attivi = countActiveControls(params);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <form onSubmit={submit} className="space-y-md">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h4 className="text-label-md text-ink-primary">
            Matrice dei 15 controlli
          </h4>
          <p className="mt-xxs text-body-sm text-ink-tertiary">
            {attivi} attivi · soglia approfondimento ≥ {params.soglia_da_investigare}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-md">
          <label className="block">
            <span className="block mb-xs text-label-sm text-ink-secondary">
              Soglia approfondimento
            </span>
            <div className="flex items-center gap-xs">
              <span className="text-body-sm text-ink-tertiary">≥</span>
              <input
                required
                min="0"
                type="number"
                aria-label="Soglia da investigare"
                value={params.soglia_da_investigare}
                onChange={(e) =>
                  setParams({
                    ...params,
                    soglia_da_investigare: Number(e.target.value),
                  })}
                className={`${inputClass} w-20`}
              />
            </div>
          </label>
          <label className="block min-w-[12rem]">
            <span className="block mb-xs text-label-sm text-ink-secondary">
              Paese
            </span>
            <select
              value={params.paese || ""}
              onChange={(e) =>
                setParams({ ...params, paese: e.target.value || null })}
              className={inputClass}
            >
              <option value="">Nessun Paese — manuale</option>
              {PAESI.map(([codice, nome]) => (
                <option key={codice} value={codice}>{nome}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="text-body-sm text-ink-secondary border border-border-subtle rounded p-sm">
        <strong>Attivo</strong>: il criterio è acceso e i dati necessari sono presenti.{" "}
        <strong>Disattivato</strong>: hai spento tu il criterio con l'interruttore.{" "}
        <strong>Non applicabile</strong>: il criterio è acceso ma mancano i parametri di configurazione
        (es. nessuna soglia impostata).{" "}
        <strong>Non calcolabile</strong>: il criterio è acceso e configurato, ma per una specifica riga
        mancano i dati richiesti (es. nessuna ora di creazione su quella scrittura).
        <p className="mt-xs">
          Spegnere un test non è un peso 0. Weekend e festività sullo stesso giorno
          prendono il <strong>max</strong>, non la somma: due select 4+4 non fanno 8.
        </p>
      </div>
      <div className="overflow-x-auto border border-border-subtle rounded">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th>Controllo</th>
              <th>Parametro</th>
              <th className="w-36">Peso</th>
              <th className="w-24 text-right">Attivo</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map((control) => (
              <ControlRow
                key={control.id}
                control={control}
                params={params}
                setParams={setParams}
                busy={busy}
                open={openId === control.id}
                onOpen={() =>
                  setOpenId((id) => (id === control.id ? null : control.id))}
                onActivate={() => setOpenId(control.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="text-body-sm text-ink-tertiary">
          Clicca la riga per i campi. Il peso si cambia in colonna; la soglia resta in testa, non tra i 15.
        </span>
        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-sm px-base py-sm rounded bg-ink-primary text-label-md text-white hover:bg-ink-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Salva tutti i parametri
        </button>
      </div>
    </form>
  );
}

function ControlRow({
  control,
  params,
  setParams,
  busy,
  open,
  onOpen,
  onActivate,
}: {
  control: ControlDef;
  params: JetParams;
  setParams: (next: JetParams) => void;
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  onActivate: () => void;
}) {
  const on = isOn(control, params);
  const alwaysOn = control.id === "11";
  const canToggle = control.available && control.attivoKeys.length > 0;
  const badge =
    control.status === "presente"
      ? "success"
      : control.status === "parziale"
      ? "warning"
      : "neutral";
  const badgeLabel =
    control.status === "presente"
      ? "Nel motore"
      : control.status === "parziale"
      ? "Parziale"
      : "Assente";
  const proposed = pesoLabel(control);

  return (
    <>
      <tr
        tabIndex={0}
        className={`cursor-pointer ${on || alwaysOn ? "" : "text-ink-tertiary"}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <td className="text-center font-mono tabular-nums text-label-md">
          {control.id}
        </td>
        <td>
          <div className="flex flex-col gap-xxs">
            <span className={`text-label-md ${on || alwaysOn ? "text-ink-primary" : "text-ink-secondary"}`}>
              {control.title}
            </span>
            <span className="flex flex-wrap items-center gap-xs">
              <StatusBadge variant={badge} showDot={false}>{badgeLabel}</StatusBadge>
              {proposed && (
                <span className="text-label-sm text-ink-tertiary">{proposed}</span>
              )}
            </span>
          </div>
        </td>
        <td className="text-ink-secondary">
          {paramSummary(control, params, on || alwaysOn)}
        </td>
        <td>
          {control.pesi.length === 0 ? (
            <span
              className="inline-flex h-8 items-center px-sm rounded bg-tint-gray-bg text-tint-gray-text text-label-sm"
              title="Questo controllo non entra nella somma del punteggio"
            >
              —
            </span>
          ) : (
            <div className="flex flex-wrap gap-sm">
              {control.pesi.map((slot) => (
                <PesoSelect
                  key={slot.key}
                  label={slot.label}
                  value={params[slot.key] as number | null}
                  optional={
                    slot.key === "punteggio_conto_insolito_raro" ||
                    slot.key === "punteggio_conto_infragruppo_parte_correlata"
                  }
                  onChange={(n) => setParams({ ...params, [slot.key]: n })}
                />
              ))}
            </div>
          )}
        </td>
        <td className="text-right" onClick={(e) => e.stopPropagation()}>
          {alwaysOn ? (
            <span className="text-label-sm text-ink-tertiary">Sempre</span>
          ) : (
            <label className="inline-flex items-center gap-xs text-body-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={on}
                disabled={busy || !canToggle}
                onChange={(e) => {
                  setParams(setAttivo(params, control.attivoKeys, e.target.checked));
                  if (e.target.checked) onActivate();
                }}
              />
              Attivo
            </label>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-surface-sidebar">
            <div className="space-y-md py-sm">
              <p className="text-body-sm text-ink-secondary">{control.hint}</p>
              {control.id === "05" && (
                <p className="text-body-sm text-ink-secondary border border-border-subtle rounded p-sm">
                  Weekend e festività sullo stesso giorno: il motore prende il{" "}
                  <strong>max</strong> dei due pesi, non la somma. Due select 4+4 restano 4.
                </p>
              )}
              {control.id === "07" && (
                <p className="text-body-sm text-ink-secondary">
                  La finestra di chiusura è la riga sotto: stesso gruppo di fine periodo, interruttori indipendenti.
                </p>
              )}
              {control.flagKeys.map((flagKey) => (
                <ScopeDetails key={flagKey} flagKey={flagKey} />
              ))}
              {control.available ? (
                <ControlFields
                  id={control.id}
                  params={params}
                  setParams={setParams}
                />
              ) : (
                <p className="text-body-sm text-ink-tertiary">
                  Nessun parametro da compilare: il controllo non è nel motore.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ScopeDetails({ flagKey }: { flagKey: string }) {
  const scope = SCOPO_CONTROLLI[flagKey];
  if (!scope) return null;
  return (
    <details className="text-body-sm text-ink-secondary">
      <summary className="cursor-pointer">ℹ️ Scopo — {flagKey.replace("flag_", "").replaceAll("_", " ")}</summary>
      <div className="mt-xs space-y-xs border-l border-border-subtle pl-sm">
        <p><strong>Obiettivo:</strong> {scope.obiettivo}</p>
        <p><strong>Rischio:</strong> {scope.rischio}</p>
        <p><strong>Campi:</strong> {scope.campi}</p>
        <p><strong>Regola:</strong> {scope.regola}</p>
        <p><strong>Limitazioni:</strong> {scope.limitazioni}</p>
        <p><strong>Eccezione:</strong> {scope.eccezione}</p>
      </div>
    </details>
  );
}

function ControlFields({
  id,
  params,
  setParams,
}: {
  id: string;
  params: JetParams;
  setParams: (next: JetParams) => void;
}) {
  if (id === "01") {
    return (
      <Field label="Utile netto dopo imposte">
        <input
          type="number"
          step="any"
          value={params.utile_netto_dopo_imposte ?? ""}
          placeholder="Non impostato"
          onChange={(e) =>
            setParams({
              ...params,
              utile_netto_dopo_imposte: e.target.value === ""
                ? null
                : Number(e.target.value),
            })}
          className={inputClass}
        />
      </Field>
    );
  }
  if (id === "02") {
    return (
      <Field label="Valore medio registrazione (ponte, se non vuoi la media del file)">
        <input
          type="number"
          step="any"
          value={params.valore_medio_registrazione ?? ""}
          placeholder="Calcolata in analisi se vuoto"
          onChange={(e) =>
            setParams({
              ...params,
              valore_medio_registrazione: e.target.value === ""
                ? null
                : Number(e.target.value),
            })}
          className={inputClass}
        />
      </Field>
    );
  }
  if (id === "03") {
    return (
      <div className="grid sm:grid-cols-2 gap-md">
        <Field label="Performance materiality">
          <input
            type="number"
            step="any"
            value={params.performance_materiality ?? ""}
            placeholder="Valore usato dal test"
            onChange={(e) =>
              setParams({
                ...params,
                performance_materiality: e.target.value === ""
                  ? null
                  : Number(e.target.value),
              })}
            className={inputClass}
          />
        </Field>
        <Field label="Materialità di bilancio (solo riconciliazione)">
          <input
            type="number"
            step="any"
            value={params.materialita_bilancio ?? ""}
            placeholder="Non entra nel calcolo"
            onChange={(e) =>
              setParams({
                ...params,
                materialita_bilancio: e.target.value === ""
                  ? null
                  : Number(e.target.value),
              })}
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (id === "04") {
    return <RoundSumFields params={params} setParams={setParams} />;
  }
  if (id === "05") {
    const selected = new Set(params.giorni_weekend || []);
    return (
      <div className="space-y-md">
        <div className="grid sm:grid-cols-2 gap-md">
          <label className="flex items-center gap-xs text-body-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={params.attivo_weekend}
              onChange={(e) =>
                setParams({ ...params, attivo_weekend: e.target.checked })}
            />
            Weekend attivo
          </label>
          <label className="flex items-center gap-xs text-body-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={params.attivo_festivita}
              onChange={(e) =>
                setParams({ ...params, attivo_festivita: e.target.checked })}
            />
            Festività attive
          </label>
        </div>
        <div>
          <span className="block mb-xs text-label-sm text-ink-secondary">
            Giorni weekend (il manuale sostituisce il weekend del Paese)
          </span>
          <div className="flex flex-wrap gap-xs">
            {WEEKEND_DAYS.map((d) => {
              const checked = selected.has(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(d.n);
                    else next.add(d.n);
                    const list = WEEKEND_DAYS.map((x) => x.n).filter((x) =>
                      next.has(x)
                    );
                    setParams({
                      ...params,
                      giorni_weekend: list.length ? [...list] : null,
                    });
                  }}
                  className={`h-8 px-sm rounded text-label-sm border ${
                    checked
                      ? "bg-ink-primary text-white border-ink-primary"
                      : "bg-surface text-ink-secondary border-border-subtle"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <ListInput
          label="Festività aggiuntive (si sommano al calendario del Paese)"
          type="date"
          values={params.festivita}
          onChange={(v) =>
            setParams({ ...params, festivita: v as string[] | null })}
        />
      </div>
    );
  }
  if (id === "06") {
    return (
      <div className="grid sm:grid-cols-2 gap-md">
        <Field label="Inizio orario ufficio">
          <input
            type="time"
            value={params.orario_ufficio_inizio || ""}
            onChange={(e) =>
              setParams({
                ...params,
                orario_ufficio_inizio: e.target.value || null,
              })}
            className={inputClass}
          />
        </Field>
        <Field label="Fine orario ufficio">
          <input
            type="time"
            value={params.orario_ufficio_fine || ""}
            onChange={(e) =>
              setParams({
                ...params,
                orario_ufficio_fine: e.target.value || null,
              })}
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (id === "07") {
    return (
      <Field label="Soglia retrodatazione (giorni lavorativi)">
        <input
          type="number"
          min="0"
          value={params.soglia_backdating_giorni ?? ""}
          placeholder="Non impostato"
          onChange={(e) =>
            setParams({
              ...params,
              soglia_backdating_giorni: e.target.value === ""
                ? null
                : Number(e.target.value),
            })}
          className={inputClass}
        />
      </Field>
    );
  }
  if (id === "07b") {
    return (
      <div className="grid sm:grid-cols-2 gap-md">
        <Field label="Data di chiusura">
          <input
            type="date"
            value={params.data_chiusura || ""}
            onChange={(e) =>
              setParams({ ...params, data_chiusura: e.target.value || null })}
            className={inputClass}
          />
        </Field>
        <Field label="Finestra (giorni lavorativi)">
          <input
            type="number"
            min="0"
            value={params.finestra_chiusura_giorni_lavorativi ?? ""}
            placeholder="Non impostato"
            onChange={(e) =>
              setParams({
                ...params,
                finestra_chiusura_giorni_lavorativi: e.target.value === ""
                  ? null
                  : Number(e.target.value),
              })}
            className={inputClass}
          />
        </Field>
      </div>
    );
  }
  if (id === "08") {
    return (
      <div className="grid md:grid-cols-2 gap-md">
        <ListInput
          label="Staff autorizzato"
          type="text"
          values={params.staff_autorizzato}
          onChange={(v) =>
            setParams({ ...params, staff_autorizzato: v as string[] | null })}
        />
        <ListInput
          label="Utenti di sistema (esclusi dal test)"
          type="text"
          values={params.utenti_di_sistema}
          onChange={(v) =>
            setParams({ ...params, utenti_di_sistema: v as string[] | null })}
        />
      </div>
    );
  }
  if (id === "09") {
    return (
      <p className="text-body-sm text-ink-secondary">
        Nessun campo da compilare. Il peso sta in colonna.
      </p>
    );
  }
  if (id === "11") {
    return (
      <p className="text-body-sm text-ink-secondary">
        La sequenza sul numero documento parte con l’analisi, senza peso riga.
        Il controllo per pagina o libro bollato non è nel motore.
      </p>
    );
  }
  if (id === "10") {
    return (
      <Field label="Soglia frequenza (segnala conti usati meno di N volte nel file)">
        <input
          type="number"
          min="0"
          value={params.soglia_frequenza_insolita ?? ""}
          placeholder="10"
          onChange={(e) =>
            setParams({
              ...params,
              soglia_frequenza_insolita: e.target.value === ""
                ? null
                : Number(e.target.value),
            })}
          className={inputClass}
        />
      </Field>
    );
  }
  if (id === "15") {
    return (
      <div className="space-y-md">
        <ListInput
          label="Parole chiave parti correlate (criterio con peso)"
          type="text"
          values={params.parole_chiave_parti_correlate}
          onChange={(v) =>
            setParams({
              ...params,
              parole_chiave_parti_correlate: v as string[] | null,
            })}
        />
        <ListInput
          label="Nominativi da visura camerale (manuale, stesso peso delle keyword)"
          type="text"
          values={params.nominativi_visura_camerale}
          onChange={(v) =>
            setParams({
              ...params,
              nominativi_visura_camerale: v as string[] | null,
            })}
        />
        <div className="grid md:grid-cols-[1fr_auto] gap-md items-end">
          <ListInput
            label="Conti infragruppo / parti correlate (estensione, entra nel punteggio)"
            type="text"
            values={params.conti_infragruppo_parte_correlata}
            onChange={(v) =>
              setParams({
                ...params,
                conti_infragruppo_parte_correlata: v as string[] | null,
              })}
          />
          <div className="flex flex-col gap-sm pb-sm">
            <label className="flex items-center gap-xs text-body-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={params.attivo_conto_infragruppo_parte_correlata}
                onChange={(e) =>
                  setParams({
                    ...params,
                    attivo_conto_infragruppo_parte_correlata: e.target.checked,
                  })}
              />
              Conto infragruppo attivo
            </label>
            <PesoSelect
              label="Peso conti"
              value={params.punteggio_conto_infragruppo_parte_correlata}
              optional
              onChange={(n) =>
                setParams({
                  ...params,
                  punteggio_conto_infragruppo_parte_correlata: n,
                })}
            />
          </div>
        </div>
        <p className="text-body-sm text-ink-tertiary">
          Nominativi da visura camerale: inserimento manuale, nessun OCR. Confluiscono nel peso «Keyword» sopra, non è un peso separato.
        </p>
      </div>
    );
  }
  return null;
}

function RoundSumFields({
  params,
  setParams,
}: {
  params: JetParams;
  setParams: (next: JetParams) => void;
}) {
  const soglia = params.soglia_importo_cifra_tonda;
  const preset = soglia !== null && soglia !== undefined &&
    ROUND_PRESETS.includes(Number(soglia));
  const [custom, setCustom] = useState(!preset && soglia != null);
  useEffect(() => {
    setCustom(!preset && soglia != null);
  }, [preset, soglia]);
  const selectValue = custom ? "custom" : soglia == null ? "" : String(Number(soglia));
  return (
    <Field label="Soglia importo a cifra tonda">
      <div className="space-y-sm">
        <select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === "custom") {
              setCustom(true);
              setParams({ ...params, soglia_importo_cifra_tonda: null });
              return;
            }
            setCustom(false);
            setParams({
              ...params,
              soglia_importo_cifra_tonda: Number(e.target.value),
            });
          }}
          className={inputClass}
        >
          <option value="" disabled>Seleziona una soglia</option>
          <option value="10000">10.000</option>
          <option value="100000">100.000</option>
          <option value="1000000">1.000.000</option>
          <option value="custom">Personalizzato</option>
        </select>
        {custom && (
          <input
            type="number"
            min="0"
            step="any"
            value={params.soglia_importo_cifra_tonda ?? ""}
            placeholder="Inserisci una soglia maggiore di zero"
            onChange={(e) =>
              setParams({
                ...params,
                soglia_importo_cifra_tonda: e.target.value === ""
                  ? null
                  : Number(e.target.value),
              })}
            className={inputClass}
          />
        )}
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-xs text-label-sm text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

function ListInput({
  label,
  values,
  type,
  onChange,
}: {
  label: string;
  values: (string | number)[] | null;
  type: string;
  onChange: (x: (string | number)[] | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    const value = type === "number" ? Number(draft) : draft.trim();
    onChange([...(values || []), value]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex gap-sm">
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="px-md rounded border border-border-subtle"
        >
          Aggiungi
        </button>
      </div>
      <div className="flex flex-wrap gap-xs mt-xs">
        {values?.map((v, i) => (
          <button
            type="button"
            key={`${v}-${i}`}
            onClick={() => {
              const next = values.filter((_, x) => x !== i);
              onChange(next.length ? next : null);
            }}
            className="px-sm py-xxs rounded bg-tint-gray-bg text-label-sm text-tint-gray-text"
          >
            {v} ×
          </button>
        ))}
        {values === null && (
          <span className="text-body-sm text-ink-tertiary">Non impostato</span>
        )}
      </div>
    </Field>
  );
}
