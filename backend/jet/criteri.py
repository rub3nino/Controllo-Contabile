"""Valutazione pura dei criteri storici del Journal Entry Testing."""

from __future__ import annotations

from collections import Counter
from decimal import Decimal

from backend.jet import calendari
from backend.jet.models import EsitoRigaJet, ParametriClienteJet, RigaGiornale

__all__ = [
    "calcola_frequenza_conti",
    "calcola_media_assoluta_registrazioni",
    "valuta_riga",
]


def calcola_frequenza_conti(righe: list[RigaGiornale]) -> dict[str, int]:
    """Conta l'uso dei conti presenti, ignorando le righe senza codifica."""
    return dict(
        Counter(
            riga.conto_contabile
            for riga in righe
            if riga.conto_contabile is not None
        )
    )


def calcola_media_assoluta_registrazioni(
    righe: list[RigaGiornale],
) -> Decimal | None:
    """Media dei valori assoluti degli importi sulla popolazione caricata.

    Gli importi pari a zero sono esclusi dal denominatore. Restituisce ``None``
    quando non c'è alcun valore utilizzabile (popolazione vuota o tutti zero),
    mai zero: zero implicherebbe erroneamente che qualunque importo sia
    "oltre 10 volte la media".
    """
    valori = [abs(r.importo_netto) for r in righe if r.importo_netto != 0]
    if not valori:
        return None
    return sum(valori) / Decimal(len(valori))


def valuta_riga(
    riga: RigaGiornale,
    parametri: ParametriClienteJet,
    frequenze_conto: dict[str, int] | None = None,
    media_registrazione_popolazione: Decimal | None = None,
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
        else None
    )
    media_registrazione = (
        parametri.valore_medio_registrazione
        if parametri.valore_medio_registrazione is not None
        else media_registrazione_popolazione
    )
    flag_oltre_dieci_volte_media = (
        importo > Decimal(10) * abs(media_registrazione)
        if media_registrazione is not None
        else None
    )
    flag_sopra_performance_materiality = (
        importo > abs(parametri.performance_materiality)
        if parametri.performance_materiality is not None
        else None
    )
    flag_importo_cifra_tonda = (
        importo % parametri.soglia_importo_cifra_tonda == 0
        if parametri.soglia_importo_cifra_tonda is not None
        else None
    )
    weekend_effettivo = (
        parametri.giorni_weekend
        if parametri.giorni_weekend is not None
        else (
            calendari.giorni_weekend(parametri.paese)
            if parametri.paese is not None
            else None
        )
    )
    festivita_effettiva = None
    if parametri.paese is not None:
        anno = riga.data_effettiva.year
        base = calendari.festivita(parametri.paese, anno, anno)
        if not base and not parametri.festivita:
            festivita_effettiva = None
        else:
            festivita_effettiva = sorted(set(base) | set(parametri.festivita or []))
    elif parametri.festivita is not None:
        festivita_effettiva = parametri.festivita

    flag_weekend = (
        riga.data_effettiva.weekday() in weekend_effettivo
        if weekend_effettivo is not None
        else None
    )
    flag_festivita = (
        riga.data_effettiva in festivita_effettiva
        if festivita_effettiva is not None
        else None
    )

    festivita_periodo = None
    if (
        parametri.paese is not None
        and riga.data_creazione is not None
        and riga.data_creazione > riga.data_effettiva
    ):
        try:
            base_periodo = calendari.festivita(
                parametri.paese, riga.data_effettiva.year, riga.data_creazione.year
            )
        except ValueError:
            # Il dataset copre solo 2024-2030 (scelta di scope della Fase calendari): una
            # scrittura con date fuori da questo intervallo non deve far crashare l'intera
            # valutazione, ricade sui giorni di calendario come un Paese senza dati.
            base_periodo = None
        if base_periodo or parametri.festivita:
            festivita_periodo = sorted(set(base_periodo or []) | set(parametri.festivita or []))

    festivita_chiusura = None
    if (
        parametri.paese is not None
        and parametri.data_chiusura is not None
        and riga.data_effettiva <= parametri.data_chiusura
    ):
        try:
            base_chiusura = calendari.festivita(
                parametri.paese, riga.data_effettiva.year, parametri.data_chiusura.year
            )
        except ValueError:
            base_chiusura = None
        if base_chiusura or parametri.festivita:
            festivita_chiusura = sorted(
                set(base_chiusura or []) | set(parametri.festivita or [])
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
        flag_forward_dating = None
        metodo_calcolo_backdating = None
    elif riga.data_creazione < riga.data_effettiva:
        flag_backdated = False
        flag_forward_dating = True
        metodo_calcolo_backdating = None
    else:
        if festivita_periodo is not None:
            scarto = calendari.giorni_lavorativi_tra(
                riga.data_effettiva, riga.data_creazione, weekend_effettivo, festivita_periodo
            )
            metodo_calcolo_backdating = "giorni_lavorativi"
        else:
            scarto = (riga.data_creazione - riga.data_effettiva).days
            metodo_calcolo_backdating = "giorni_calendario"
        flag_backdated = scarto >= parametri.soglia_backdating_giorni
        flag_forward_dating = False

    if (
        parametri.data_chiusura is None
        or parametri.finestra_chiusura_giorni_lavorativi is None
        or parametri.paese is None
    ):
        flag_finestra_chiusura = None
    elif riga.data_effettiva > parametri.data_chiusura:
        flag_finestra_chiusura = False
    elif festivita_chiusura is None:
        flag_finestra_chiusura = None
    else:
        scarto_chiusura = calendari.giorni_lavorativi_tra(
            riga.data_effettiva,
            parametri.data_chiusura,
            weekend_effettivo,
            festivita_chiusura,
        )
        flag_finestra_chiusura = (
            scarto_chiusura < parametri.finestra_chiusura_giorni_lavorativi
        )

    if riga.data_creazione is None or parametri.data_chiusura is None:
        flag_creata_dopo_chiusura = None
    else:
        flag_creata_dopo_chiusura = (
            riga.data_creazione > parametri.data_chiusura
            and riga.data_effettiva <= parametri.data_chiusura
        )

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
        else None
    )
    flag_descrizione_vuota = not descrizione

    if frequenze_conto is None or riga.conto_contabile is None:
        frequenza_utilizzo_conto = None
        flag_conto_insolito_raro = None
    else:
        frequenza_utilizzo_conto = frequenze_conto.get(riga.conto_contabile, 0)
        flag_conto_insolito_raro = (
            frequenza_utilizzo_conto < parametri.soglia_frequenza_insolita
            if parametri.soglia_frequenza_insolita is not None
            else None
        )

    if (
        parametri.conti_infragruppo_parte_correlata is None
        or riga.conto_contabile is None
    ):
        flag_conto_infragruppo_parte_correlata = None
    else:
        flag_conto_infragruppo_parte_correlata = (
            riga.conto_contabile
            in parametri.conti_infragruppo_parte_correlata
        )

    flag_e_pesi = (
        (flag_profit_impact, parametri.punteggio_profit_impact),
        (flag_oltre_dieci_volte_media, parametri.punteggio_oltre_dieci_volte_media),
        (flag_sopra_performance_materiality, parametri.punteggio_sopra_performance_materiality),
        (flag_importo_cifra_tonda, parametri.punteggio_importo_cifra_tonda),
        (flag_fuori_orario, parametri.punteggio_fuori_orario),
        (flag_backdated, parametri.punteggio_backdated),
        (flag_staff_non_autorizzato, parametri.punteggio_staff_non_autorizzato),
        (flag_parte_correlata, parametri.punteggio_parte_correlata),
        (flag_descrizione_vuota, parametri.punteggio_descrizione_vuota),
        (flag_conto_insolito_raro, parametri.punteggio_conto_insolito_raro),
        (
            flag_conto_infragruppo_parte_correlata,
            parametri.punteggio_conto_infragruppo_parte_correlata,
        ),
    )
    punteggio_totale = sum(
        peso for flag, peso in flag_e_pesi if flag is True and peso is not None
    )
    if flag_weekend is True and flag_festivita is True:
        contributo_weekend_festivita = max(
            parametri.punteggio_weekend, parametri.punteggio_festivita
        )
    elif flag_weekend is True:
        contributo_weekend_festivita = parametri.punteggio_weekend
    elif flag_festivita is True:
        contributo_weekend_festivita = parametri.punteggio_festivita
    else:
        contributo_weekend_festivita = 0
    punteggio_totale += contributo_weekend_festivita

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
        flag_forward_dating=flag_forward_dating,
        metodo_calcolo_backdating=metodo_calcolo_backdating,
        flag_finestra_chiusura=flag_finestra_chiusura,
        flag_creata_dopo_chiusura=flag_creata_dopo_chiusura,
        flag_staff_non_autorizzato=flag_staff_non_autorizzato,
        flag_parte_correlata=flag_parte_correlata,
        flag_descrizione_vuota=flag_descrizione_vuota,
        punteggio_totale=punteggio_totale,
        da_investigare=punteggio_totale >= parametri.soglia_da_investigare,
        frequenza_utilizzo_conto=frequenza_utilizzo_conto,
        flag_conto_insolito_raro=flag_conto_insolito_raro,
        flag_conto_infragruppo_parte_correlata=flag_conto_infragruppo_parte_correlata,
    )
