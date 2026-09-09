"""Contratti della pratica operativa JET."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

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
    analizzato_at: str | None = None
    numero_registrazioni: int = Field(default=0, ge=0)
    numero_da_investigare: int = Field(default=0, ge=0)


class CreaPraticaJet(BaseModel):
    client: str = Field(min_length=1)
    period: str = Field(min_length=1)


class MappaturaJet(BaseModel):
    mappatura: dict[str, str]


class RisultatoJet(BaseModel):
    riga: RigaGiornale
    esito: EsitoRigaJet


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
