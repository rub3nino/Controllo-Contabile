"""Persistenza SQLite separata per pratiche e risultati JET."""

from __future__ import annotations

import hashlib
import sqlite3
from collections.abc import Iterable, Iterator
from pathlib import Path

from backend.jet.fonti import FonteJet, ImportazioneJet, RigaImportataJet
from backend.jet.models import EsitoRigaJet, EsitoSequenzaJet, RigaGiornale
from backend.jet.pratica import IntervalloSequenzaJet, PraticaJet, RisultatoJet
from backend.jet.profilo import ProfiloEstrazione


class JetStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS pratica_jet (
                    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_pratica_jet_created
                    ON pratica_jet(created_at DESC);
                CREATE TABLE IF NOT EXISTS profilo_estrazione_jet (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    intestazione_riferimento TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_profilo_estrazione_intestazione
                    ON profilo_estrazione_jet(intestazione_riferimento);
                CREATE INDEX IF NOT EXISTS idx_profilo_estrazione_created
                    ON profilo_estrazione_jet(created_at DESC);
                CREATE TABLE IF NOT EXISTS fonte_jet (
                    id TEXT PRIMARY KEY,
                    pratica_id TEXT NOT NULL,
                    attiva INTEGER NOT NULL,
                    stato TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_fonte_jet_pratica
                    ON fonte_jet(pratica_id, created_at, id);
                CREATE TABLE IF NOT EXISTS importazione_jet (
                    id TEXT PRIMARY KEY,
                    pratica_id TEXT NOT NULL,
                    fonte_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_importazione_jet_fonte
                    ON importazione_jet(fonte_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS riga_importata_jet (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pratica_id TEXT NOT NULL,
                    fonte_id TEXT NOT NULL,
                    numero_riga INTEGER NOT NULL,
                    hash_riga TEXT NOT NULL,
                    data TEXT NOT NULL,
                    UNIQUE(fonte_id, numero_riga)
                );
                CREATE INDEX IF NOT EXISTS idx_riga_importata_pratica
                    ON riga_importata_jet(pratica_id, fonte_id, numero_riga);
                CREATE INDEX IF NOT EXISTS idx_riga_importata_hash
                    ON riga_importata_jet(pratica_id, hash_riga);
                CREATE TABLE IF NOT EXISTS risultato_jet (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pratica_id TEXT NOT NULL,
                    da_investigare INTEGER NOT NULL,
                    conto_contabile TEXT,
                    punteggio_totale INTEGER NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_risultato_jet_pratica
                    ON risultato_jet(pratica_id);
                CREATE INDEX IF NOT EXISTS idx_risultato_jet_filtri
                    ON risultato_jet(pratica_id, da_investigare, conto_contabile, punteggio_totale);
                CREATE TABLE IF NOT EXISTS sequenza_mancante_jet (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pratica_id TEXT NOT NULL, numero_atteso TEXT NOT NULL, data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sequenza_mancante_pratica
                    ON sequenza_mancante_jet(pratica_id);
                CREATE TABLE IF NOT EXISTS sequenza_intervallo_jet (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pratica_id TEXT NOT NULL,
                    precedente TEXT NOT NULL, successivo TEXT NOT NULL,
                    quantita_mancanti INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sequenza_intervallo_pratica
                    ON sequenza_intervallo_jet(pratica_id);
                """
            )
            self._migrate_legacy_sources(conn)

    def _migrate_legacy_sources(self, conn: sqlite3.Connection) -> None:
        """Registra come fonte l'eventuale file singolo delle pratiche precedenti."""
        for row in conn.execute("SELECT data FROM pratica_jet").fetchall():
            pratica = PraticaJet.model_validate_json(row["data"])
            if not pratica.file_originale_nome:
                continue
            exists = conn.execute(
                "SELECT 1 FROM fonte_jet WHERE pratica_id = ? LIMIT 1", (pratica.id,)
            ).fetchone()
            if not exists:
                path = (
                    self.path.parent
                    / "pratiche"
                    / pratica.id
                    / "inbox"
                    / pratica.file_originale_nome
                )
                digest = (
                    hashlib.sha256(path.read_bytes()).hexdigest()
                    if path.is_file()
                    else "legacy-missing"
                )
                source_id = hashlib.sha256(
                    f"{pratica.id}:{pratica.file_originale_nome}".encode()
                ).hexdigest()[:12]
                formato = Path(pratica.file_originale_nome).suffix.lower().lstrip(".")
                ready = (
                    pratica.mappatura is not None
                    or pratica.profilo_estrazione_id is not None
                )
                fonte = FonteJet(
                    id=source_id,
                    pratica_id=pratica.id,
                    nome_originale=pratica.file_originale_nome,
                    percorso_relativo=pratica.file_originale_nome,
                    formato=formato,
                    sha256=digest,
                    dimensione_byte=path.stat().st_size if path.is_file() else 0,
                    stato="pronta" if ready else "da_configurare",
                    mappatura=pratica.mappatura,
                    profilo_estrazione_id=pratica.profilo_estrazione_id,
                    created_at=pratica.created_at,
                )
                conn.execute(
                    "INSERT INTO fonte_jet "
                    "(id, pratica_id, attiva, stato, created_at, data) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        fonte.id,
                        fonte.pratica_id,
                        1,
                        fonte.stato,
                        fonte.created_at,
                        fonte.model_dump_json(),
                    ),
                )
            numero_fonti = conn.execute(
                "SELECT COUNT(*) FROM fonte_jet WHERE pratica_id = ?", (pratica.id,)
            ).fetchone()[0]
            if pratica.numero_fonti != numero_fonti:
                pratica = pratica.model_copy(update={"numero_fonti": numero_fonti})
                conn.execute(
                    "UPDATE pratica_jet SET data = ? WHERE id = ?",
                    (pratica.model_dump_json(), pratica.id),
                )

    def save_pratica(self, pratica: PraticaJet) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO pratica_jet (id, created_at, data) VALUES (?, ?, ?)",
                (pratica.id, pratica.created_at, pratica.model_dump_json()),
            )

    def get_pratica(self, pratica_id: str) -> PraticaJet | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM pratica_jet WHERE id = ?", (pratica_id,)
            ).fetchone()
        return PraticaJet.model_validate_json(row["data"]) if row else None

    def list_pratiche(self) -> list[PraticaJet]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM pratica_jet ORDER BY created_at DESC, rowid DESC"
            ).fetchall()
        return [PraticaJet.model_validate_json(row["data"]) for row in rows]

    def save_fonte(self, fonte: FonteJet) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO fonte_jet "
                "(id, pratica_id, attiva, stato, created_at, data) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    fonte.id,
                    fonte.pratica_id,
                    int(fonte.attiva),
                    fonte.stato,
                    fonte.created_at,
                    fonte.model_dump_json(),
                ),
            )

    def get_fonte(self, fonte_id: str) -> FonteJet | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM fonte_jet WHERE id = ?", (fonte_id,)
            ).fetchone()
        return FonteJet.model_validate_json(row["data"]) if row else None

    def list_fonti(self, pratica_id: str) -> list[FonteJet]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM fonte_jet WHERE pratica_id = ? "
                "ORDER BY created_at ASC, id ASC",
                (pratica_id,),
            ).fetchall()
        return [FonteJet.model_validate_json(row["data"]) for row in rows]

    def latest_fonte(self, pratica_id: str) -> FonteJet | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM fonte_jet WHERE pratica_id = ? "
                "ORDER BY created_at DESC, rowid DESC LIMIT 1",
                (pratica_id,),
            ).fetchone()
        return FonteJet.model_validate_json(row["data"]) if row else None

    def delete_fonte(self, fonte_id: str) -> FonteJet | None:
        fonte = self.get_fonte(fonte_id)
        if fonte is None:
            return None
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM riga_importata_jet WHERE fonte_id = ?", (fonte_id,)
            )
            conn.execute("DELETE FROM importazione_jet WHERE fonte_id = ?", (fonte_id,))
            conn.execute("DELETE FROM fonte_jet WHERE id = ?", (fonte_id,))
        return fonte

    def replace_staging(
        self, fonte: FonteJet, righe: Iterable[RigaGiornale]
    ) -> tuple[FonteJet, ImportazioneJet]:
        records: list[tuple[int, str, str]] = []
        for numero, riga in enumerate(righe, start=1):
            data = riga.model_dump_json()
            records.append((numero, hashlib.sha256(data.encode()).hexdigest(), data))
        fonte = fonte.model_copy(
            update={
                "stato": "pronta",
                "numero_righe": len(records),
                "errore": None,
            }
        )
        importazione = ImportazioneJet(
            pratica_id=fonte.pratica_id,
            fonte_id=fonte.id,
            stato="completata",
            numero_righe=len(records),
        )
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM riga_importata_jet WHERE fonte_id = ?", (fonte.id,)
            )
            conn.executemany(
                "INSERT INTO riga_importata_jet "
                "(pratica_id, fonte_id, numero_riga, hash_riga, data) VALUES (?, ?, ?, ?, ?)",
                (
                    (fonte.pratica_id, fonte.id, numero, digest, data)
                    for numero, digest, data in records
                ),
            )
            conn.execute(
                "INSERT INTO importazione_jet (id, pratica_id, fonte_id, created_at, data) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    importazione.id,
                    importazione.pratica_id,
                    importazione.fonte_id,
                    importazione.created_at,
                    importazione.model_dump_json(),
                ),
            )
            conn.execute(
                "INSERT OR REPLACE INTO fonte_jet "
                "(id, pratica_id, attiva, stato, created_at, data) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    fonte.id,
                    fonte.pratica_id,
                    int(fonte.attiva),
                    fonte.stato,
                    fonte.created_at,
                    fonte.model_dump_json(),
                ),
            )
        return fonte, importazione

    def clear_staging(self, fonte_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM riga_importata_jet WHERE fonte_id = ?", (fonte_id,)
            )

    def list_importazioni(self, pratica_id: str) -> list[ImportazioneJet]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM importazione_jet WHERE pratica_id = ? "
                "ORDER BY created_at DESC, rowid DESC",
                (pratica_id,),
            ).fetchall()
        return [ImportazioneJet.model_validate_json(row["data"]) for row in rows]

    def iter_staged_rows(
        self, pratica_id: str, *, scarta_identiche: bool = False
    ) -> Iterator[RigaImportataJet]:
        seen: set[str] = set()
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT r.fonte_id, r.numero_riga, r.hash_riga, r.data "
                "FROM riga_importata_jet r JOIN fonte_jet f ON f.id = r.fonte_id "
                "WHERE r.pratica_id = ? AND f.attiva = 1 AND f.stato = 'pronta' "
                "ORDER BY f.created_at ASC, f.id ASC, r.numero_riga ASC",
                (pratica_id,),
            )
            for row in rows:
                if scarta_identiche and row["hash_riga"] in seen:
                    continue
                if scarta_identiche:
                    seen.add(row["hash_riga"])
                yield RigaImportataJet(
                    fonte_id=row["fonte_id"],
                    numero_riga=row["numero_riga"],
                    hash_riga=row["hash_riga"],
                    riga=RigaGiornale.model_validate_json(row["data"]),
                )

    def save_profilo(self, profilo: ProfiloEstrazione) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO profilo_estrazione_jet "
                "(id, nome, intestazione_riferimento, created_at, data) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    profilo.id,
                    profilo.nome,
                    profilo.intestazione_riferimento,
                    profilo.created_at,
                    profilo.model_dump_json(),
                ),
            )

    def get_profilo(self, profilo_id: str) -> ProfiloEstrazione | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM profilo_estrazione_jet WHERE id = ?", (profilo_id,)
            ).fetchone()
        return ProfiloEstrazione.model_validate_json(row["data"]) if row else None

    def list_profili(self) -> list[ProfiloEstrazione]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM profilo_estrazione_jet "
                "ORDER BY created_at DESC, rowid DESC"
            ).fetchall()
        return [ProfiloEstrazione.model_validate_json(row["data"]) for row in rows]

    def find_profilo_by_intestazione(
        self, intestazione: str
    ) -> ProfiloEstrazione | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM profilo_estrazione_jet "
                "WHERE intestazione_riferimento = ? "
                "ORDER BY created_at DESC, rowid DESC LIMIT 1",
                (intestazione.strip(),),
            ).fetchone()
        return ProfiloEstrazione.model_validate_json(row["data"]) if row else None

    def delete_profilo(self, profilo_id: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM profilo_estrazione_jet WHERE id = ?", (profilo_id,)
            )
        return cursor.rowcount > 0

    @staticmethod
    def _record(
        item: RisultatoJet | tuple[RigaGiornale, EsitoRigaJet],
    ) -> tuple[int, str | None, int, str]:
        payload = (
            item
            if isinstance(item, RisultatoJet)
            else RisultatoJet(riga=item[0], esito=item[1])
        )
        return (
            int(payload.esito.da_investigare),
            payload.riga.conto_contabile,
            payload.esito.punteggio_totale,
            payload.model_dump_json(),
        )

    def replace_analysis(
        self,
        pratica: PraticaJet,
        risultati: Iterable[RisultatoJet | tuple[RigaGiornale, EsitoRigaJet]],
        mancanti: Iterable[EsitoSequenzaJet],
        intervalli: Iterable[IntervalloSequenzaJet],
    ) -> None:
        """Sostituisce risultati, sequenza e riepilogo pratica in una transazione."""
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM risultato_jet WHERE pratica_id = ?", (pratica.id,)
            )
            conn.executemany(
                "INSERT INTO risultato_jet "
                "(pratica_id, da_investigare, conto_contabile, punteggio_totale, data) "
                "VALUES (?, ?, ?, ?, ?)",
                ((pratica.id, *self._record(item)) for item in risultati),
            )
            conn.execute(
                "DELETE FROM sequenza_mancante_jet WHERE pratica_id = ?", (pratica.id,)
            )
            conn.executemany(
                "INSERT INTO sequenza_mancante_jet (pratica_id, numero_atteso, data) VALUES (?, ?, ?)",
                (
                    (pratica.id, item.numero_atteso, item.model_dump_json())
                    for item in mancanti
                ),
            )
            conn.execute(
                "DELETE FROM sequenza_intervallo_jet WHERE pratica_id = ?",
                (pratica.id,),
            )
            conn.executemany(
                "INSERT INTO sequenza_intervallo_jet "
                "(pratica_id, precedente, successivo, quantita_mancanti) VALUES (?, ?, ?, ?)",
                (
                    (pratica.id, i.precedente, i.successivo, i.quantita_mancanti)
                    for i in intervalli
                ),
            )
            conn.execute(
                "INSERT OR REPLACE INTO pratica_jet (id, created_at, data) VALUES (?, ?, ?)",
                (pratica.id, pratica.created_at, pratica.model_dump_json()),
            )

    def query_results(
        self,
        pratica_id: str,
        *,
        da_investigare: bool | None = None,
        conto_contabile: str | None = None,
        punteggio_minimo: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[RisultatoJet], int]:
        clauses = ["pratica_id = ?"]
        args: list[object] = [pratica_id]
        if da_investigare is not None:
            clauses.append("da_investigare = ?")
            args.append(int(da_investigare))
        if conto_contabile is not None:
            clauses.append("conto_contabile = ?")
            args.append(conto_contabile)
        if punteggio_minimo is not None:
            clauses.append("punteggio_totale >= ?")
            args.append(punteggio_minimo)
        where = " AND ".join(clauses)
        with self._connect() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM risultato_jet WHERE {where}", args
            ).fetchone()[0]
            rows = conn.execute(
                f"SELECT data FROM risultato_jet WHERE {where} "
                "ORDER BY punteggio_totale DESC, id ASC LIMIT ? OFFSET ?",
                [*args, limit, offset],
            ).fetchall()
        return [RisultatoJet.model_validate_json(row["data"]) for row in rows], total

    def iter_export_results(
        self,
        pratica_id: str,
        *,
        da_investigare: bool | None = None,
        conto_contabile: str | None = None,
        punteggio_minimo: int | None = None,
        batch_size: int = 1000,
    ) -> Iterator[RisultatoJet]:
        """Itera i risultati per id, senza il costo crescente di OFFSET."""
        clauses = ["pratica_id = ?"]
        args: list[object] = [pratica_id]
        if da_investigare is not None:
            clauses.append("da_investigare = ?")
            args.append(int(da_investigare))
        if conto_contabile is not None:
            clauses.append("conto_contabile = ?")
            args.append(conto_contabile)
        if punteggio_minimo is not None:
            clauses.append("punteggio_totale >= ?")
            args.append(punteggio_minimo)
        clauses.append("id > ?")
        where = " AND ".join(clauses)
        last_id = 0
        with self._connect() as conn:
            while True:
                rows = conn.execute(
                    f"SELECT id, data FROM risultato_jet WHERE {where} "
                    "ORDER BY id ASC LIMIT ?",
                    [*args, last_id, batch_size],
                ).fetchall()
                if not rows:
                    return
                last_id = rows[-1]["id"]
                for row in rows:
                    yield RisultatoJet.model_validate_json(row["data"])

    def sequence(
        self, pratica_id: str
    ) -> tuple[list[EsitoSequenzaJet], list[IntervalloSequenzaJet]]:
        with self._connect() as conn:
            mancanti = conn.execute(
                "SELECT data FROM sequenza_mancante_jet WHERE pratica_id = ? ORDER BY id",
                (pratica_id,),
            ).fetchall()
            intervalli = conn.execute(
                "SELECT precedente, successivo, quantita_mancanti FROM sequenza_intervallo_jet "
                "WHERE pratica_id = ? ORDER BY id",
                (pratica_id,),
            ).fetchall()
        return (
            [EsitoSequenzaJet.model_validate_json(r["data"]) for r in mancanti],
            [IntervalloSequenzaJet(**dict(r)) for r in intervalli],
        )
