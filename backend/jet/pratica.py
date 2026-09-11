"""Contratti della pratica operativa JET."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from backend.jet.fonti import StrategiaDuplicatiJet
from backend.jet.models import EsitoRigaJet, ParametriClienteJet, RigaGiornale

StatoPraticaJet = Literal[
    "bozza", "parametri_configurati", "file_caricato", "analizzato"
]


class PraticaJet(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    client: str
    period: str
    status: StatoPraticaJet = "bozza"
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )
    parametri: ParametriClienteJet | None = None
    file_originale_nome: str | None = None
    mappatura: dict[str, str] | None = None
    profilo_estrazione_id: str | None = None
    numero_pagine_pdf: int | None = Field(default=None, ge=1)
    numeri_pagina_rilevati: list[int] | None = None
    pagine_mancanti: list[int] | None = None
    sequenza_pagine_completa: bool | None = None
    strategia_duplicati: StrategiaDuplicatiJet = "mantieni_tutti"
    numero_fonti: int = Field(default=0, ge=0)
    analizzato_at: str | None = None
    numero_registrazioni: int = Field(default=0, ge=0)
    numero_da_investigare: int = Field(default=0, ge=0)
    valore_medio_registrazione_effettivo: Decimal | None = None


class CreaPraticaJet(BaseModel):
    client: str = Field(min_length=1)
    period: str = Field(min_length=1)


class MappaturaJet(BaseModel):
    mappatura: dict[str, str]


class RisultatoJet(BaseModel):
    riga: RigaGiornale
    esito: EsitoRigaJet
    fonte_id: str | None = None
    numero_riga_fonte: int | None = Field(default=None, ge=1)
    hash_riga: str | None = None


class PaginaRisultatiJet(BaseModel):
    items: list[RisultatoJet]
    total: int
    page: int
    page_size: int
    pages: int


class IntervalloSequenzaJet(BaseModel):
    precedente: str
    successivo: str
    quantita_mancanti: int = Field(ge=0)
