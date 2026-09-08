import type { Catalog } from "./api";

export const ALL_SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

export const SECTION_HELP: Record<string, { title: string; blurb: string; look_for: string }> = {
  A: { title: "Sistema di controllo interno", blurb: "Come è organizzata l'azienda e se procedure o organigramma sono cambiati.", look_for: "Organigramma, mail sulle procedure, cartelle e avvisi, fatti straordinari." },
  B: { title: "Libri obbligatori", blurb: "Controlla che i libri contabili e fiscali siano aggiornati.", look_for: "Libro giornale, libro inventari, registri IVA." },
  C: { title: "Adempimenti tributari e previdenziali", blurb: "Verifica F24, IVA periodica, fondi e pagamenti del personale.", look_for: "Quietanze F24, LIPE, fondi previdenziali, Intrastat, cedolini, bonifico stipendi." },
  D: { title: "Test su rilevazioni contabili", blurb: "Campiona le registrazioni del giornale. Si può saltare se questo trimestre non serve.", look_for: "Libro giornale o mastrini in formato testo." },
  E: { title: "Disponibilità liquide", blurb: "Confronta i saldi in banca con la contabilità.", look_for: "Estratti conto, riconciliazioni bancarie, Centrale Rischi." },
  F: { title: "Verbali organi sociali", blurb: "Legge i verbali per fatti che impattano i conti.", look_for: "Verbali assemblee, CdA, Collegio sindacale, libro soci." },
  G: { title: "Analisi situazione contabile", blurb: "Analizza il bilancino e il confronto con budget e cashflow.", look_for: "Bilancino di verifica, CE vs budget, budget e cashflow." },
  H: { title: "Colloqui con la Direzione", blurb: "Appunti dei colloqui con l'azienda. Si compila a mano.", look_for: "Note o verbali dei colloqui con la Direzione." },
  I: { title: "Operazioni particolarmente significative", blurb: "Segnala operazioni straordinarie o movimenti anomali.", look_for: "Contratti, atti M&A, nuovi prestiti, transazioni extra-business." },
};

export function sectionHelp(id: string, catalog: Catalog | null = null) {
  const api = catalog?.sections.find((section) => section.id === id);
  const local = SECTION_HELP[id];
  return {
    title: api?.title || local?.title || id,
    blurb: api?.blurb || local?.blurb || "",
    look_for: api?.look_for || local?.look_for || "",
  };
}
