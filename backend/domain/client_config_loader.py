"""Caricamento delle configurazioni cliente usate dal flusso domain API."""

from __future__ import annotations

from pathlib import Path

import yaml

from backend.domain.models import ClientConfig

CLIENTS_DIR = Path(__file__).resolve().parent / "clients"


def load_client_config(client_id: str) -> ClientConfig:
    path = CLIENTS_DIR / f"{client_id}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Configurazione cliente non trovata: {client_id}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    config = ClientConfig.model_validate(data)
    if config.client_id != client_id:
        raise ValueError(
            f"Il client_id nel file {path.name} è {config.client_id!r}, atteso {client_id!r}"
        )
    return config


def list_clients() -> list[dict[str, str]]:
    clients = []
    for path in sorted(p for p in CLIENTS_DIR.glob("*.yaml") if not p.name.startswith(".")):
        config = load_client_config(path.stem)
        clients.append({"id": config.client_id, "display_name": config.display_name})
    return clients
