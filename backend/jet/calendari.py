"""Calendari nazionali statici per JET: festività e weekend per Paese, 2024-2030.

Dataset versionato e curato manualmente, non generato automaticamente da una libreria
di terze parti: ogni data richiede verifica da fonte ufficiale prima di essere usata in
un controllo di revisione. Vedi il commento sopra ogni blocco Paese per le fonti usate.
"""

from __future__ import annotations

from datetime import date

CODICI_PAESE = ["IT", "DE", "FR", "ES", "IL", "US", "MT", "IE", "CY"]

WEEKEND_PER_PAESE: dict[str, list[int]] = {
    "IT": [5, 6],
    "DE": [5, 6],
    "FR": [5, 6],
    "ES": [5, 6],
    "IL": [4, 5],
    "US": [5, 6],
    "MT": [5, 6],
    "IE": [5, 6],
    "CY": [5, 6],
}


def _date(anno: int, giorno: str) -> date:
    """Converte una data MM-GG già verificata, mantenendo il dataset leggibile."""
    mese, giorno_del_mese = map(int, giorno.split("-"))
    return date(anno, mese, giorno_del_mese)


def _dates(anno: int, giorni: str) -> list[date]:
    return [_date(anno, giorno) for giorno in giorni.split()]


# Italia — Ministero del Lavoro, elenco delle festività nazionali; Legge
# 8 ottobre 2025 n. 151 (Gazzetta Ufficiale) per il 4 ottobre dal 2026.
_IT = {
    2024: "01-01 01-06 04-01 04-25 05-01 06-02 08-15 11-01 12-08 12-25 12-26",
    2025: "01-01 01-06 04-21 04-25 05-01 06-02 08-15 11-01 12-08 12-25 12-26",
    2026: "01-01 01-06 04-06 04-25 05-01 06-02 08-15 10-04 11-01 12-08 12-25 12-26",
    2027: "01-01 01-06 03-29 04-25 05-01 06-02 08-15 10-04 11-01 12-08 12-25 12-26",
    2028: "01-01 01-06 04-17 04-25 05-01 06-02 08-15 10-04 11-01 12-08 12-25 12-26",
    2029: "01-01 01-06 04-02 04-25 05-01 06-02 08-15 10-04 11-01 12-08 12-25 12-26",
    2030: "01-01 01-06 04-22 04-25 05-01 06-02 08-15 10-04 11-01 12-08 12-25 12-26",
}

# Germania — portale ufficiale federale Make it in Germany; sono incluse
# soltanto le festività valide in tutti i Länder, non quelle regionali.
_DE = {
    2024: "01-01 03-29 04-01 05-01 05-09 05-20 10-03 12-25 12-26",
    2025: "01-01 04-18 04-21 05-01 05-29 06-09 10-03 12-25 12-26",
    2026: "01-01 04-03 04-06 05-01 05-14 05-25 10-03 12-25 12-26",
    2027: "01-01 03-26 03-29 05-01 05-06 05-17 10-03 12-25 12-26",
    2028: "01-01 04-14 04-17 05-01 05-25 06-05 10-03 12-25 12-26",
    2029: "01-01 03-30 04-02 05-01 05-10 05-21 10-03 12-25 12-26",
    2030: "01-01 04-19 04-22 05-01 05-30 06-10 10-03 12-25 12-26",
}

# Francia — Service-Public.fr e articolo L3133-1 del Code du travail;
# copertura nazionale generale, escluse le festività locali/regionali.
_FR = {
    2024: "01-01 04-01 05-01 05-08 05-09 05-20 07-14 08-15 11-01 11-11 12-25",
    2025: "01-01 04-21 05-01 05-08 05-29 06-09 07-14 08-15 11-01 11-11 12-25",
    2026: "01-01 04-06 05-01 05-08 05-14 05-25 07-14 08-15 11-01 11-11 12-25",
    2027: "01-01 03-29 05-01 05-06 05-08 05-17 07-14 08-15 11-01 11-11 12-25",
    2028: "01-01 04-17 05-01 05-08 05-25 06-05 07-14 08-15 11-01 11-11 12-25",
    2029: "01-01 04-02 05-01 05-08 05-10 05-21 07-14 08-15 11-01 11-11 12-25",
    2030: "01-01 04-22 05-01 05-08 05-30 06-10 07-14 08-15 11-01 11-11 12-25",
}

# Spagna — Punto de Acceso General / calendari annuali del Ministerio de
# Trabajo. 2024-2026 includono solo i giorni comuni a tutto il territorio;
# 2027-2030 restano intenzionalmente vuoti in attesa dei calendari ufficiali.
_ES = {
    2024: "01-01 01-06 03-29 05-01 08-15 10-12 11-01 12-06 12-25",
    2025: "01-01 01-06 04-18 05-01 08-15 11-01 12-06 12-08 12-25",
    2026: "01-01 01-06 04-03 05-01 08-15 10-12 12-08 12-25",
    2027: "",
    2028: "",
    2029: "",
    2030: "",
}

# Israele — il portale open-data governativo pubblica le corrispondenze fra
# calendario ebraico e gregoriano, ma al momento non offre una serie ufficiale
# completa e stabile 2024-2030 di giorni non lavorativi. Nessuna data viene
# quindi attivata prima della validazione annuale richiesta dal prompt.
_IL = {anno: "" for anno in range(2024, 2031)}

# Stati Uniti — U.S. Office of Personnel Management, Federal Holidays.
# Sono riportate le date osservate dal calendario OPM per il normale orario
# lunedì-venerdì, inclusi i giorni “in lieu of” quando cadono in settimana.
_US = {
    2024: "01-01 01-15 02-19 05-27 06-19 07-04 09-02 10-14 11-11 11-28 12-25",
    2025: "01-01 01-20 02-17 05-26 06-19 07-04 09-01 10-13 11-11 11-27 12-25",
    2026: "01-01 01-19 02-16 05-25 06-19 07-03 09-07 10-12 11-11 11-26 12-25",
    2027: "01-01 01-18 02-15 05-31 06-18 07-05 09-06 10-11 11-11 11-25 12-24 12-31",
    2028: "01-17 02-21 05-29 06-19 07-04 09-04 10-09 11-10 11-23 12-25",
    2029: "01-01 01-15 02-19 05-28 06-19 07-04 09-03 10-08 11-12 11-22 12-25",
    2030: "01-01 01-21 02-18 05-27 06-19 07-04 09-02 10-14 11-11 11-28 12-25",
}

# Malta — Government of Malta, Public Holidays, disciplinate dal National
# Holidays and Other Public Holidays Act (Chapter 252).
_MT = {
    2024: "01-01 02-10 03-19 03-29 03-31 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2025: "01-01 02-10 03-19 03-31 04-18 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2026: "01-01 02-10 03-19 03-31 04-03 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2027: "01-01 02-10 03-19 03-26 03-31 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2028: "01-01 02-10 03-19 03-31 04-14 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2029: "01-01 02-10 03-19 03-30 03-31 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
    2030: "01-01 02-10 03-19 03-31 04-19 05-01 06-07 06-29 08-15 09-08 09-21 12-08 12-13 12-25",
}

# Irlanda — Workplace Relations Commission, elenco e regole dei dieci public
# holidays; Good Friday è espressamente escluso.
_IE = {
    2024: "01-01 02-05 03-17 04-01 05-06 06-03 08-05 10-28 12-25 12-26",
    2025: "01-01 02-03 03-17 04-21 05-05 06-02 08-04 10-27 12-25 12-26",
    2026: "01-01 02-02 03-17 04-06 05-04 06-01 08-03 10-26 12-25 12-26",
    2027: "01-01 02-01 03-17 03-29 05-03 06-07 08-02 10-25 12-25 12-26",
    2028: "01-01 02-07 03-17 04-17 05-01 06-05 08-07 10-30 12-25 12-26",
    2029: "01-01 02-05 03-17 04-02 05-07 06-04 08-06 10-29 12-25 12-26",
    2030: "01-01 02-04 03-17 04-22 05-06 06-03 08-05 10-28 12-25 12-26",
}

# Cipro — Department of Civil Aviation (AIP Cyprus) e CySEC, elenco delle
# general public holidays; le ricorrenze mobili seguono la Pasqua ortodossa.
_CY = {
    2024: "01-01 01-06 03-18 03-25 04-01 05-01 05-03 05-06 06-24 08-15 10-01 10-28 12-24 12-25 12-26",
    2025: "01-01 01-06 03-03 03-25 04-01 04-18 04-21 05-01 06-09 08-15 10-01 10-28 12-24 12-25 12-26",
    2026: "01-01 01-06 02-23 03-25 04-01 04-10 04-13 05-01 06-01 08-15 10-01 10-28 12-24 12-25 12-26",
    2027: "01-01 01-06 03-15 03-25 04-01 04-30 05-01 05-03 06-21 08-15 10-01 10-28 12-24 12-25 12-26",
    2028: "01-01 01-06 02-28 03-25 04-01 04-14 04-17 05-01 06-05 08-15 10-01 10-28 12-24 12-25 12-26",
    2029: "01-01 01-06 02-19 03-25 04-01 04-06 04-09 05-01 05-28 08-15 10-01 10-28 12-24 12-25 12-26",
    2030: "01-01 01-06 03-11 03-25 04-01 04-26 04-29 05-01 06-17 08-15 10-01 10-28 12-24 12-25 12-26",
}


FESTIVITA_PER_PAESE: dict[str, dict[int, list[date]]] = {
    codice: {anno: _dates(anno, giorni) if giorni else [] for anno, giorni in dati.items()}
    for codice, dati in {
        "IT": _IT,
        "DE": _DE,
        "FR": _FR,
        "ES": _ES,
        "IL": _IL,
        "US": _US,
        "MT": _MT,
        "IE": _IE,
        "CY": _CY,
    }.items()
}


def festivita(codice_paese: str, anno_da: int, anno_a: int) -> list[date]:
    """Tutte le festività del Paese fra anno_da e anno_a inclusi, ordinate."""
    if codice_paese not in FESTIVITA_PER_PAESE:
        raise ValueError(f"Codice Paese non supportato: {codice_paese!r}")
    if anno_da > anno_a:
        raise ValueError("anno_da non può essere successivo ad anno_a")
    anni_disponibili = FESTIVITA_PER_PAESE[codice_paese]
    anni_mancanti = [anno for anno in range(anno_da, anno_a + 1) if anno not in anni_disponibili]
    if anni_mancanti:
        raise ValueError(
            f"Anni non disponibili per {codice_paese}: "
            + ", ".join(map(str, anni_mancanti))
        )
    return sorted(
        giorno
        for anno in range(anno_da, anno_a + 1)
        for giorno in anni_disponibili[anno]
    )


def giorni_weekend(codice_paese: str) -> list[int]:
    """I giorni della settimana considerati weekend per il Paese (0=lunedì, 6=domenica)."""
    if codice_paese not in WEEKEND_PER_PAESE:
        raise ValueError(f"Codice Paese non supportato: {codice_paese!r}")
    return list(WEEKEND_PER_PAESE[codice_paese])


__all__ = [
    "CODICI_PAESE",
    "FESTIVITA_PER_PAESE",
    "WEEKEND_PER_PAESE",
    "festivita",
    "giorni_weekend",
]
