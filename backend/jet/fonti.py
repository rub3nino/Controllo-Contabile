"""Contratti delle fonti e dello staging multi-file JET."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from backend.jet.models import RigaGiornale

FormatoFonteJet = Literal["xlsx", "txt", "pdf"]
StatoFonteJet = Literal["da_configurare", "pronta", "esclusa", "errore"]
StrategiaDuplicatiJet = Literal["mantieni_tutti", "scarta_identiche"]
StatoImportazioneJet = Literal["completata", "errore"]


class FonteJet(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    pratica_id: str
    nome_originale: str
    percorso_relativo: str
    formato: FormatoFonteJet
    sha256: str
    dimensione_byte: int = Field(ge=0)
    attiva: bool = True
    stato: StatoFonteJet = "da_configurare"
    mappatura: dict[str, str] | None = None
    profilo_estrazione_id: str | None = None
    numero_pagine_pdf: int | None = Field(default=None, ge=1)
    numeri_pagina_rilevati: list[int] | None = None
    pagine_mancanti: list[int] | None = None
    sequenza_pagine_completa: bool | None = None
    numero_righe: int = Field(default=0, ge=0)
    errore: str | None = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(
            timespec="microseconds"
        )
    )


class ImportazioneJet(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    pratica_id: str
    fonte_id: str
    stato: StatoImportazioneJet
    numero_righe: int = Field(default=0, ge=0)
    errore: str | None = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(
            timespec="microseconds"
        )
    )


class RigaImportataJet(BaseModel):
    fonte_id: str
    numero_riga: int = Field(ge=1)
    hash_riga: str
    riga: RigaGiornale


class ConfigurazioneFonteJet(BaseModel):
    attiva: bool


class ConfigurazioneDuplicatiJet(BaseModel):
    strategia: StrategiaDuplicatiJet
