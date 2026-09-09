"""Contratti dei profili per estrarre giornali TXT a colonne fisse."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from backend.jet.models import RigaGiornale

CAMPI_PROFILO = set(RigaGiornale.model_fields) | {"importo_dare", "importo_avere"}


class ProfiloEstrazione(BaseModel):
    """Profilo fixed-width con intervalli 0-based ``[inizio, fine)``.

    ``fine`` è esclusivo, come nello slicing Python. I campi non mappati non
    compaiono in ``posizioni`` e vengono quindi normalizzati a ``None``.
    """

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    nome: str = Field(min_length=1)
    riga_intestazione: int = Field(ge=0)
    intestazione_riferimento: str = Field(min_length=1)
    posizioni: dict[str, tuple[int, int]]
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )

    @field_validator("nome", "intestazione_riferimento")
    @classmethod
    def normalizza_testo(cls, valore: str) -> str:
        valore = valore.strip()
        if not valore:
            raise ValueError("Il valore non può essere vuoto")
        return valore

    @field_validator("posizioni")
    @classmethod
    def valida_posizioni(
        cls, posizioni: dict[str, tuple[int, int]]
    ) -> dict[str, tuple[int, int]]:
        sconosciuti = sorted(set(posizioni) - CAMPI_PROFILO)
        if sconosciuti:
            raise ValueError(f"Campi JET non riconosciuti: {', '.join(sconosciuti)}")
        for campo, (inizio, fine) in posizioni.items():
            if inizio < 0 or fine <= inizio:
                raise ValueError(
                    f"Intervallo non valido per {campo}: usare 0 <= inizio < fine"
                )
        return posizioni


class CreaProfiloEstrazione(BaseModel):
    nome: str = Field(min_length=1)
    posizioni: dict[str, tuple[int, int]]

    @field_validator("nome")
    @classmethod
    def normalizza_nome(cls, nome: str) -> str:
        nome = nome.strip()
        if not nome:
            raise ValueError("Il nome non può essere vuoto")
        return nome

    @field_validator("posizioni")
    @classmethod
    def valida_posizioni(
        cls, posizioni: dict[str, tuple[int, int]]
    ) -> dict[str, tuple[int, int]]:
        return ProfiloEstrazione.valida_posizioni(posizioni)
