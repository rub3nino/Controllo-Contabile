"""Contratti dati del Journal Entry Testing (JET), senza logica di calcolo.

Il package è intenzionalmente separato da ``backend.domain``: in questa fase
il JET non dipende dal motore di verifica di Quadra. I modelli fissano soltanto
la forma dell'input, della configurazione cliente e degli esiti che le fasi
successive produrranno.
"""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from backend.jet import calendari

__all__ = [
    "RigaGiornale",
    "ParametriClienteJet",
    "EsitoRigaJet",
    "EsitoSequenzaJet",
]


class RigaGiornale(BaseModel):
    """Una riga di libro giornale nel formato canonico del JET.

    I primi sette concetti riproducono il formato ``Data Input`` del foglio
    BTI: data effettiva, data e ora di creazione, identificativo della
    registrazione, importo netto, descrizione e utente. I campi che un
    gestionale può non esportare sono opzionali: ``None`` conserva
    esplicitamente l'informazione "dato non disponibile" e permetterà al
    motore di dichiarare un criterio non calcolabile.

    ``conto_contabile`` è incluso anche se il foglio esistente lo scarta. La
    scelta chiude il principale gap rispetto all'ISA Italia 240 §A44 e rende
    possibili i futuri test su conti insoliti/rari e infragruppo. È opzionale
    perché anche l'assenza della codifica di conto è, di per sé, un segnale
    previsto dal principio.

    ``numero_documento`` resta distinto da ``identificativo_registrazione``:
    il primo è il protocollo reale assegnato dal gestionale e sarà la base del
    test di sequenza; il secondo conserva l'identificativo canonico della riga
    usato dal foglio, che nel caso analizzato era un contatore ricostruito.
    """

    data_effettiva: date
    data_creazione: date | None = None
    ora_creazione: time | None = None
    identificativo_registrazione: str
    numero_documento: str | None = None
    importo_netto: Decimal
    descrizione: str | None = None
    utente: str | None = None
    conto_contabile: str | None = None


class ParametriClienteJet(BaseModel):
    """Configurazione per-cliente necessaria al Journal Entry Testing.

    Nessuna soglia, lista o ponderazione viene dedotta dal caso Nordson o
    nascosta in un default. Le informazioni che possono non essere fornite
    hanno valore predefinito ``None``: ciò significa "non disponibile", non
    lista vuota, zero o criterio disattivato. Le fasi di calcolo dovranno
    distinguere esplicitamente questi casi.

    Il foglio descrive dodici criteri, ma il dodicesimo è il verdetto
    ``da investigare`` ottenuto confrontando la somma con la soglia e non ha
    un punteggio proprio. Per questo sono configurabili gli undici pesi che
    entrano nella somma, mentre ``soglia_da_investigare`` configura il
    dodicesimo criterio senza introdurre un peso fittizio.

    ``valore_medio_registrazione`` è previsto perché alimenta il test
    ``>10x average``; può essere fornito dalla configurazione oppure restare
    non disponibile finché una fase successiva non lo calcola dalla
    popolazione.
    """

    materialita_bilancio: Decimal | None = None
    performance_materiality: Decimal | None = None
    utile_netto_dopo_imposte: Decimal | None = None
    valore_medio_registrazione: Decimal | None = None
    soglia_importo_cifra_tonda: Decimal | None = Field(default=None, gt=0)
    paese: str | None = None
    orario_ufficio_inizio: time | None = None
    orario_ufficio_fine: time | None = None
    giorni_weekend: list[int] | None = None
    soglia_backdating_giorni: int | None = Field(default=None, ge=0)
    festivita: list[date] | None = None
    staff_autorizzato: list[str] | None = None
    utenti_di_sistema: list[str] | None = Field(
        default=None,
        description=(
            "Account di interfacce automatiche o processi batch, esclusi dal criterio "
            "'staff non autorizzato' perché l'autorizzazione individuale non è pertinente "
            "a un processo; non sono per questo considerati preparatori autorizzati. "
            "None = nessuna esclusione implicita."
        ),
    )
    parole_chiave_parti_correlate: list[str] | None = None
    soglia_frequenza_insolita: int | None = Field(default=None, ge=0)
    conti_infragruppo_parte_correlata: list[str] | None = None
    soglia_da_investigare: int = Field(ge=0)

    punteggio_profit_impact: int = Field(ge=0)
    punteggio_oltre_dieci_volte_media: int = Field(ge=0)
    punteggio_sopra_performance_materiality: int = Field(ge=0)
    punteggio_importo_cifra_tonda: int = Field(ge=0)
    punteggio_weekend: int = Field(ge=0)
    punteggio_festivita: int = Field(ge=0)
    punteggio_fuori_orario: int = Field(ge=0)
    punteggio_backdated: int = Field(ge=0)
    punteggio_staff_non_autorizzato: int = Field(ge=0)
    punteggio_parte_correlata: int = Field(ge=0)
    punteggio_descrizione_vuota: int = Field(ge=0)
    punteggio_conto_insolito_raro: int | None = Field(default=None, ge=0)
    punteggio_conto_infragruppo_parte_correlata: int | None = Field(
        default=None, ge=0
    )

    @field_validator("paese")
    @classmethod
    def valida_paese(cls, valore: str | None) -> str | None:
        if valore is not None and valore not in calendari.CODICI_PAESE:
            raise ValueError(
                f"Codice Paese non supportato: {valore!r}; "
                f"valori ammessi: {', '.join(calendari.CODICI_PAESE)}"
            )
        return valore


class EsitoRigaJet(BaseModel):
    """Esito dei criteri JET applicati a una singola riga.

    Gli undici flag di rischio corrispondono alle condizioni che producono
    punti nel foglio; ``da_investigare`` è il dodicesimo criterio/verdetto e
    resta separato dal totale per rendere il contratto leggibile.

    I campi relativi al conto sono presenti fin dalla Fase 1 per non cambiare
    il contratto quando saranno implementati i criteri della Fase 4.
    ``frequenza_utilizzo_conto`` e i due flag sono opzionali perché, senza
    conto, storico o anagrafica infragruppo, il risultato è non calcolabile:
    ``None`` non deve essere confuso con frequenza zero o esito negativo.
    """

    identificativo_registrazione: str
    flag_profit_impact: bool | None
    flag_oltre_dieci_volte_media: bool | None
    flag_sopra_performance_materiality: bool | None
    flag_importo_cifra_tonda: bool | None
    flag_weekend: bool | None
    flag_festivita: bool | None
    flag_fuori_orario: bool | None
    flag_backdated: bool | None
    flag_staff_non_autorizzato: bool | None
    flag_parte_correlata: bool | None
    flag_descrizione_vuota: bool
    punteggio_totale: int = Field(ge=0)
    da_investigare: bool

    frequenza_utilizzo_conto: int | None = Field(default=None, ge=0)
    flag_conto_insolito_raro: bool | None = None
    flag_conto_infragruppo_parte_correlata: bool | None = None


class EsitoSequenzaJet(BaseModel):
    """Esito puntuale del test di completezza sulla numerazione ufficiale.

    I numeri sono stringhe perché i protocolli gestionali possono contenere
    zeri iniziali o caratteri non numerici. ``numero_trovato`` è ``None``
    quando il protocollo atteso manca davvero; il flag esplicito evita di
    inferire il verdetto dalla sola assenza del valore.
    """

    numero_atteso: str
    numero_trovato: str | None = None
    mancante: bool
