"""Valutazione pura dei criteri storici del Journal Entry Testing."""

from __future__ import annotations

from decimal import Decimal

from backend.jet.models import EsitoRigaJet, ParametriClienteJet, RigaGiornale

__all__ = ["valuta_riga"]


def valuta_riga(
    riga: RigaGiornale,
    parametri: ParametriClienteJet,
) -> EsitoRigaJet:
    """Valuta una riga replicando gli undici criteri di ``Calcs1``.

    I criteri con contratto nullable restituiscono ``None`` quando manca il
    dato necessario. Un flag ``None`` non genera punti: non equivale però a
    ``False``, perché dichiara che il controllo non è stato eseguito.
    """
    importo = abs(riga.importo_netto)

    flag_profit_impact = (
        importo > Decimal("0.10") * abs(parametri.utile_netto_dopo_imposte)
        if parametri.utile_netto_dopo_imposte is not None
        else False
    )
    flag_oltre_dieci_volte_media = (
        importo > Decimal(10) * abs(parametri.valore_medio_registrazione)
        if parametri.valore_medio_registrazione is not None
        else False
    )
    flag_sopra_performance_materiality = (
        importo > abs(parametri.performance_materiality)
        if parametri.performance_materiality is not None
        else False
    )
    flag_importo_cifra_tonda = importo % Decimal(10) == 0
    flag_weekend = (
        riga.data_effettiva.weekday() in parametri.giorni_weekend
        if parametri.giorni_weekend is not None
        else False
    )
    flag_festivita = (
        riga.data_effettiva in parametri.festivita
        if parametri.festivita is not None
        else False
    )

    if (
        riga.ora_creazione is None
        or parametri.orario_ufficio_inizio is None
        or parametri.orario_ufficio_fine is None
    ):
        flag_fuori_orario = None
    else:
        flag_fuori_orario = not (
            parametri.orario_ufficio_inizio
            <= riga.ora_creazione
            <= parametri.orario_ufficio_fine
        )

    if riga.data_creazione is None or parametri.soglia_backdating_giorni is None:
        flag_backdated = None
    else:
        flag_backdated = (
            riga.data_creazione - riga.data_effettiva
        ).days >= parametri.soglia_backdating_giorni

    if (
        parametri.staff_autorizzato is None
        or riga.utente is None
        or (
            parametri.utenti_di_sistema is not None
            and riga.utente in parametri.utenti_di_sistema
        )
    ):
        flag_staff_non_autorizzato = None
    else:
        flag_staff_non_autorizzato = riga.utente not in parametri.staff_autorizzato

    descrizione = (riga.descrizione or "").strip()
    flag_parte_correlata = (
        any(
            parola.strip().casefold() in descrizione.casefold()
            for parola in parametri.parole_chiave_parti_correlate
            if parola.strip()
        )
        if parametri.parole_chiave_parti_correlate is not None
        else False
    )
    flag_descrizione_vuota = not descrizione

    flag_e_pesi = (
        (flag_profit_impact, parametri.punteggio_profit_impact),
        (flag_oltre_dieci_volte_media, parametri.punteggio_oltre_dieci_volte_media),
        (flag_sopra_performance_materiality, parametri.punteggio_sopra_performance_materiality),
        (flag_importo_cifra_tonda, parametri.punteggio_importo_cifra_tonda),
        (flag_weekend, parametri.punteggio_weekend),
        (flag_festivita, parametri.punteggio_festivita),
        (flag_fuori_orario, parametri.punteggio_fuori_orario),
        (flag_backdated, parametri.punteggio_backdated),
        (flag_staff_non_autorizzato, parametri.punteggio_staff_non_autorizzato),
        (flag_parte_correlata, parametri.punteggio_parte_correlata),
        (flag_descrizione_vuota, parametri.punteggio_descrizione_vuota),
    )
    punteggio_totale = sum(peso for flag, peso in flag_e_pesi if flag is True)

    return EsitoRigaJet(
        identificativo_registrazione=riga.identificativo_registrazione,
        flag_profit_impact=flag_profit_impact,
        flag_oltre_dieci_volte_media=flag_oltre_dieci_volte_media,
        flag_sopra_performance_materiality=flag_sopra_performance_materiality,
        flag_importo_cifra_tonda=flag_importo_cifra_tonda,
        flag_weekend=flag_weekend,
        flag_festivita=flag_festivita,
        flag_fuori_orario=flag_fuori_orario,
        flag_backdated=flag_backdated,
        flag_staff_non_autorizzato=flag_staff_non_autorizzato,
        flag_parte_correlata=flag_parte_correlata,
        flag_descrizione_vuota=flag_descrizione_vuota,
        punteggio_totale=punteggio_totale,
        da_investigare=punteggio_totale >= parametri.soglia_da_investigare,
        frequenza_utilizzo_conto=None,
        flag_conto_insolito_raro=None,
        flag_conto_infragruppo_parte_correlata=None,
    )
