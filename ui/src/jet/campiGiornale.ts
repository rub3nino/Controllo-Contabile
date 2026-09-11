/** Campi canonici di una riga di giornale, nella forma usata dal motore JET. */
export const MAP_FIELDS = [
  "identificativo_registrazione",
  "numero_documento",
  "data_effettiva",
  "data_creazione",
  "ora_creazione",
  "conto_contabile",
  "importo_netto",
  "importo_dare",
  "importo_avere",
  "descrizione",
  "utente",
] as const;

export type MapField = (typeof MAP_FIELDS)[number];

export const MAP_FIELD_LABELS: Record<MapField, string> = {
  identificativo_registrazione: "Identificativo registrazione",
  numero_documento: "Numero documento",
  data_effettiva: "Data effettiva",
  data_creazione: "Data di creazione",
  ora_creazione: "Ora di creazione",
  conto_contabile: "Conto contabile",
  importo_netto: "Importo netto",
  importo_dare: "Importo Dare",
  importo_avere: "Importo Avere",
  descrizione: "Descrizione",
  utente: "Utente",
};

export type FieldGuide = {
  titolo: string;
  obbligo: "obbligatorio" | "importo" | "opzionale";
  significato: string;
  cosaInserire: string;
  excel: string;
  stampa: string;
  seManca: string;
  criteri: string;
};

export const FIELD_GUIDES: Record<MapField, FieldGuide> = {
  identificativo_registrazione: {
    titolo: "Identificativo registrazione",
    obbligo: "obbligatorio",
    significato:
      "Chiave della riga nel JET, non il protocollo fiscale. Serve a riconoscere la stessa scrittura nei risultati e nell’export. Non va confuso con il numero documento.",
    cosaInserire:
      "Un valore presente su ogni movimento: id riga, TransactionId, oppure un pezzo stabile della riga se il file non ha un id.",
    excel: "Riga N., TransactionId, ID movimento. Non usare il numero fattura se è spesso vuoto.",
    stampa:
      "Intervallo di caratteri dell’id. Se manca, usa un tratto non vuoto (es. data + sottoconto). Non i primi 10 caratteri a caso.",
    seManca: "Senza questo campo il profilo o la mappatura non si possono salvare.",
    criteri: "Non alimenta un criterio di rischio: è l’etichetta della riga.",
  },
  numero_documento: {
    titolo: "Numero documento",
    obbligo: "opzionale",
    significato:
      "Protocollo del gestionale (fattura, Doc.No.). Il test di sequenza usa questo campo, non l’id riga.",
    cosaInserire: "Solo la colonna/tratto del numero documento reale.",
    excel: "Doc.No., Num.Docum., N. documento, Document No.",
    stampa: "Fascia «Num.Docum.». Su molte stampe è vuota: il campo resta opzionale.",
    seManca: "Il test di completezza sulla numerazione non parte.",
    criteri: "Sequenza dei numeri documento, non il punteggio per riga.",
  },
  data_effettiva: {
    titolo: "Data effettiva",
    obbligo: "obbligatorio",
    significato:
      "Data a cui la scrittura si riferisce in contabilità (competenza/registrazione). Non è l’istante in cui è stato battuto Invio.",
    cosaInserire:
      "La data del movimento. Non la data di stampa in testata né la data di chiusura di bilancio.",
    excel: "Data Reg., EffectiveDate, Data registrazione.",
    stampa:
      "«Data Reg.» all’inizio della riga movimento (es. 0–10 per 02/03/2026). Non l’intestazione di pagina.",
    seManca: "Obbligatoria: senza data effettiva la riga non è una scrittura JET valida.",
    criteri: "Weekend, festività, retrodatazione come competenza.",
  },
  data_creazione: {
    titolo: "Data di creazione",
    obbligo: "opzionale",
    significato:
      "Giorno in cui la scrittura è stata inserita nel sistema. Può differire dalla competenza.",
    cosaInserire:
      "CreatedDate o la seconda Data Reg. se il file ne ha due. Se hai solo la competenza, lascia vuoto.",
    excel: "CreatedDate, Data creazione, Data Reg. [2] se le intestazioni sono duplicate.",
    stampa:
      "«Data Comp.» è competenza, non creazione di sistema: in quel caso lascia vuoto.",
    seManca: "Retrodatazione e forward dating restano non calcolabili.",
    criteri: "flag_backdated, flag_forward_dating.",
  },
  ora_creazione: {
    titolo: "Ora di creazione",
    obbligo: "opzionale",
    significato: "Ora di registrazione a sistema, confrontata con l’orario d’ufficio.",
    cosaInserire: "Un orario tipo 09:15. Non una data.",
    excel: "CreatedTime, C TIME, Ora creazione.",
    stampa: "Molte stampe non hanno l’ora: lascia vuoto.",
    seManca: "flag_fuori_orario resta non calcolabile.",
    criteri: "Fuori orario d’ufficio.",
  },
  conto_contabile: {
    titolo: "Conto contabile",
    obbligo: "opzionale",
    significato:
      "Codice di mastro/sottoconto. Non è la descrizione e non è l’etichetta del tipo documento SAP.",
    cosaInserire:
      "Il codice vero. Se ci sono più colonne «conto», scegli i codici di piano dei conti (su Nordson: Conto n., non Conto contabile).",
    excel: "Conto n., Account, Codice conto, Sottoconto.",
    stampa: "«Sottoconto» (es. 22020012).",
    seManca: "Conto raro e infragruppo restano non calcolabili.",
    criteri: "flag_conto_insolito_raro, flag_conto_infragruppo_parte_correlata.",
  },
  importo_netto: {
    titolo: "Importo netto",
    obbligo: "importo",
    significato:
      "Importo già firmato. Si usa solo se non mappi Dare/Avere. Con Dare/Avere il netto è Dare − Avere.",
    cosaInserire: "Una sola colonna numerica già netta. Non sommare Dare e Avere qui.",
    excel: "Net, Importo netto. Se hai Dare e Avere, non mappare questa.",
    stampa: "Se Dare e Avere sono due colonne, mappa quelle e lascia vuoto il netto.",
    seManca: "Va bene se hai Dare e/o Avere. Altrimenti mappatura e profilo sono rifiutati.",
    criteri: "Impatto utile, 10× media, performance materiality, cifra tonda.",
  },
  importo_dare: {
    titolo: "Importo Dare",
    obbligo: "importo",
    significato:
      "Colonna Dare. Se mappi Dare e/o Avere, il netto diventa Dare − Avere; vuoto = zero in quella sottrazione.",
    cosaInserire: "Solo i numeri in Dare (accetta 1.625,00).",
    excel: "Importo Dare, Dare, Debit.",
    stampa: "Fascia «Dare» a destra, prima di Avere.",
    seManca: "Se mappi solo Avere, Dare vale zero.",
    criteri: "Stessi criteri di importo, tramite il netto ricalcolato.",
  },
  importo_avere: {
    titolo: "Importo Avere",
    obbligo: "importo",
    significato: "Colonna Avere. Stessa regola di Dare nel netto Dare − Avere.",
    cosaInserire: "Solo i numeri in Avere. Vuoto = zero.",
    excel: "Importo Avere, Avere, Credit.",
    stampa: "Ultima fascia numerica a destra («Avere»).",
    seManca: "Opzionale se esiste Dare o l’importo netto.",
    criteri: "Stessi criteri di importo, tramite il netto ricalcolato.",
  },
  descrizione: {
    titolo: "Descrizione",
    obbligo: "opzionale",
    significato:
      "Causale. «Parte correlata» cerca qui le parole chiave; «descrizione vuota» scatta se non resta testo.",
    cosaInserire: "La causale del movimento, non l’intestazione di pagina.",
    excel: "Descrizione, JournalDescription, Causale.",
    stampa: "«Descrizione» sulla riga movimento.",
    seManca: "Parte correlata non calcolabile. Descrizione vuota resta valutabile.",
    criteri: "flag_parte_correlata, flag_descrizione_vuota.",
  },
  utente: {
    titolo: "Utente",
    obbligo: "opzionale",
    significato:
      "Account che ha inserito la scrittura, confrontato con staff autorizzato e utenti di sistema.",
    cosaInserire: "User id del gestionale. I nomi del preset sono fittizi: su un giornale vero adattali.",
    excel: "USER, UserId, Utente.",
    stampa: "Se la stampa non ha l’utente, lascia vuoto.",
    seManca: "flag_staff_non_autorizzato resta non calcolabile.",
    criteri: "flag_staff_non_autorizzato.",
  },
};

export function obbligoEtichetta(obbligo: FieldGuide["obbligo"]): string {
  if (obbligo === "obbligatorio") return "Obbligatorio";
  if (obbligo === "importo") return "Obbligatorio (netto oppure Dare/Avere)";
  return "Opzionale";
}
