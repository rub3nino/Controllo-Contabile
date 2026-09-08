"""Motore di verifica (livello 3 del piano, Fase 1).

Traduce in codice la "regola di calcolo (conservativa)" già scritta in
linguaggio naturale in `regole/TEMPLATE_RULES.md` §4.1, usando i contratti
di Fase 0 (`backend/domain/models.py`) invece delle celle INDICE!F10:F18.

Semplificazioni deliberate di questa fase (segnalate anche nel riepilogo
consegnato a Ruben, non solo qui):

1. **Nessuna verifica dei "campi meccanici compilati"** (TEMPLATE_RULES.md
   §4.1: es. per E serve almeno un saldo e/c, per C almeno gli F24 del
   trimestre, per G almeno una riga di bilancino). Il `✓` qui sotto richiede
   solo che ogni voce di catalogo collegata sia stata trovata
   (`Evidence(found=True)`), non che i dati strutturati al suo interno siano
   completi — quella lettura più fine dipende da `extract.py`, che questa
   fase non integra.
2. **Nessuna `Anomaly` generata.** Le due soglie di materialità in
   `ClientConfig` sono `None` per decisione esplicita di Ruben
   (`TEMPLATE_RULES.md` §13.4): finché restano `None`, `_check_anomalies`
   ritorna sempre una lista vuota. Non è un bug, è il comportamento
   corretto per "soglia non impostata" (vedi docstring di `ClientConfig`).
"""

from __future__ import annotations

from backend.catalog import SECTION_ITEMS
from backend.domain.models import Anomaly, ClientConfig, Evidence, HumanOverride, Section, VerificationResult

# Sezioni di solo giudizio umano (TEMPLATE_RULES.md §4.1, §7.1/§7.4/§7.8/§7.9,
# e piano_azione_redesign.md §4: A, D, H, I sono le più vicine a un giudizio
# professionale). L'app non assegna mai ✓ da sola per queste, anche se ogni
# voce collegata risulta trovata: "Colloqui (H): ... L'app non marca H come ✓
# da sola" è la formulazione esplicita della regola in TEMPLATE_RULES.md.
JUDGMENT_ONLY_SECTIONS: frozenset[str] = frozenset({"A", "D", "H", "I"})


def _connected_item_is_skipped(item_id: str, overrides: list[HumanOverride]) -> bool:
    """Vero se un override della pratica esclude la voce dal calcolo."""
    return any(o.scope == "item" and o.target == item_id for o in overrides)


def check_anomalies(
    section: Section, evidences: list[Evidence], client_config: ClientConfig
) -> list[Anomaly]:
    """Sempre `[]` in Fase 1 — vedi punto 3 del docstring di modulo.

    Punto di estensione per la Fase 2+: quando
    `client_config.soglia_scostamento_bancario_eur` /
    `soglia_variazione_significativa_g_pct` verranno impostate (decisione di
    Ruben, non automatica), questa funzione dovrà leggere i campi
    strutturati delle `Evidence` di sezione E/G (saldo_ec, saldo_coge,
    amount_chg...) e confrontarli con la soglia per generare `Anomaly` di
    tipo scostamento/variazione. Oggi quei campi strutturati non sono
    nemmeno popolati dall'adapter di ingestion (Fase 1 non li estrae), quindi
    anche con una soglia impostata questa funzione non avrebbe ancora dati
    su cui lavorare.
    """
    return []


def evaluate_section(
    *,
    section: Section,
    pratica_id: str,
    client: str,
    period: str,
    evidences: list[Evidence],
    overrides: list[HumanOverride] | None = None,
    client_config: ClientConfig,
    section_items: dict[str, list[str]] | None = None,
) -> VerificationResult:
    """Calcola il `VerificationResult` di UNA sezione (A-I) per una pratica.

    `evidences` è la lista di `Evidence` dell'intera pratica (non
    pre-filtrata per sezione): questa funzione la filtra da sola sulle voci
    di catalogo collegate alla sezione, così il chiamante (es.
    `evaluate_pratica` qui sotto) non deve ripetere la logica di filtro per
    ogni sezione.
    """
    items_by_section = section_items if section_items is not None else SECTION_ITEMS
    pratica_overrides = [o for o in (overrides or []) if o.pratica_id == pratica_id]
    section_override = next(
        (o for o in pratica_overrides if o.scope == "section" and o.target == section),
        None,
    )
    if section_override is not None:
        return VerificationResult(
            pratica_id=pratica_id,
            client=client,
            period=period,
            section=section,
            status=section_override.decision,
            reasoning=section_override.note or "Decisione umana applicata all'intera sezione.",
        )

    applicable = set(client_config.applicable_items)
    # "voci collegate" = intersezione fra SECTION_ITEMS[sezione] e le voci
    # applicabili a QUESTO cliente (backend.catalog.SECTION_ITEMS resta
    # generico per tutti i clienti, il filtro per cliente è compito nostro).
    connected = [i for i in items_by_section.get(section, []) if i in applicable]
    connected.extend(i.id for i in client_config.extra_items if i.section == section and i.id not in connected)

    by_item: dict[str, list[Evidence]] = {}
    for ev in evidences:
        by_item.setdefault(ev.item_id, []).append(ev)

    def item_found(item_id: str) -> bool:
        return any(ev.found for ev in by_item.get(item_id, []))

    missing_items = [
        i for i in connected
        if not item_found(i) and not _connected_item_is_skipped(i, pratica_overrides)
    ]
    relevant_evidence = [ev for ev in evidences if ev.item_id in connected]

    if not connected:
        # Caso H (nessuna voce in checklist) o cliente per cui tutte le voci
        # di questa sezione sono N/A: resta sempre wip, mai un ✓ vacuo
        # (TEMPLATE_RULES.md §4.1: "Resta wip finché un umano non mette ✓ o ✗").
        status: str = "wip"
        reasoning = (
            "Nessuna voce di catalogo collegata a questa sezione per questo cliente "
            "(sezione di solo giudizio umano, oppure tutte le voci collegate sono N/A "
            "per questo cliente): resta wip finché un umano non decide."
        )
    elif all(_connected_item_is_skipped(i, pratica_overrides) for i in connected):
        status = "✗"
        reasoning = "Tutte le voci collegate sono state saltate per scelta (controllo non richiesto questo trimestre)."
    elif not missing_items and section not in JUDGMENT_ONLY_SECTIONS:
        status = "✓"
        reasoning = f"Tutte le voci collegate ({', '.join(connected)}) sono state trovate."
    elif not missing_items and section in JUDGMENT_ONLY_SECTIONS:
        status = "wip"
        reasoning = (
            f"Tutte le voci collegate ({', '.join(connected)}) sono state trovate, ma questa è "
            "una sezione di giudizio umano (A/D/H/I): l'app non assegna ✓ da sola "
            "(TEMPLATE_RULES.md §4.1)."
        )
    else:
        status = "wip"
        reasoning = f"Mancano ancora: {', '.join(missing_items)}."

    return VerificationResult(
        pratica_id=pratica_id,
        client=client,
        period=period,
        section=section,
        status=status,  # type: ignore[arg-type]
        reasoning=reasoning,
        evidence=relevant_evidence,
        missing_items=missing_items,
        anomalies=check_anomalies(section, relevant_evidence, client_config),
    )


def evaluate_pratica(
    *,
    pratica_id: str,
    client: str,
    period: str,
    evidences: list[Evidence],
    overrides: list[HumanOverride] | None = None,
    client_config: ClientConfig,
    section_items: dict[str, list[str]] | None = None,
) -> dict[str, VerificationResult]:
    """Calcola il `VerificationResult` per tutte le 9 sezioni A-I in un colpo.

    Comodità per l'uso end-to-end (Fase 3, dashboard): evita di dover
    elencare a mano le 9 lettere ad ogni chiamata.
    """
    items_by_section = section_items if section_items is not None else SECTION_ITEMS
    return {
        section: evaluate_section(
            section=section,
            pratica_id=pratica_id,
            client=client,
            period=period,
            evidences=evidences,
            overrides=overrides,
            client_config=client_config,
            section_items=items_by_section,
        )
        for section in items_by_section
    }
