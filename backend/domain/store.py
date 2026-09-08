"""Evidence store — livello 2 del piano: persistenza per Evidence,
VerificationResult e Finding (backend/domain/models.py), fuori dal repository
git (sotto storage/, riusando backend.workspace.storage_root come le
pratiche esistenti).

**Scelta tecnica: sqlite3 della standard library, non SQLAlchemy/SQLModel.**
Ogni tabella qui è "id + poche colonne indicizzate per filtrare + il JSON
del modello Pydantic intero" — non ci sono join relazionali da esprimere,
solo salva/leggi per pratica_id/client. Un ORM aggiungerebbe una dipendenza
nuova e uno strato in più per un problema che `sqlite3` +
`model_dump_json()`/`model_validate_json()` risolve in poche righe, nello
stesso stile già usato da `ProvenanceLog` (backend/provenance.py), che
scrive `ProvenanceRow` senza un ORM. Se in Fase 2+ emergono query
relazionali reali (join fra evidence/finding/pratiche/clienti), vale la
pena reintrodurre la domanda.

`VerificationResult` è per contratto immutabile (Fase 0: "un nuovo calcolo
produce un nuovo record, mai un update"): `save_verification_result` fa
sempre un `INSERT`, mai un `UPDATE`/`REPLACE` — un id duplicato è un bug del
chiamante (dovrebbe essere impossibile, `id` ha un `default_factory` a
uuid4) e deve fallire rumorosamente, non essere silenziosamente sovrascritto.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from backend.domain.models import Evidence, Finding, VerificationResult


class EvidenceStore:
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
                CREATE TABLE IF NOT EXISTS evidence (
                    id TEXT PRIMARY KEY,
                    pratica_id TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_evidence_pratica ON evidence(pratica_id);

                CREATE TABLE IF NOT EXISTS verification_result (
                    id TEXT PRIMARY KEY,
                    pratica_id TEXT NOT NULL,
                    section TEXT NOT NULL,
                    computed_at TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_vr_pratica_section
                    ON verification_result(pratica_id, section);

                CREATE TABLE IF NOT EXISTS finding (
                    id TEXT PRIMARY KEY,
                    client TEXT NOT NULL,
                    pratica_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_finding_client_status ON finding(client, status);
                """
            )

    # ---------- Evidence ----------

    def save_evidence(self, evidence: Evidence) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO evidence (id, pratica_id, item_id, data) VALUES (?, ?, ?, ?)",
                (evidence.id, evidence.pratica_id, evidence.item_id, evidence.model_dump_json()),
            )

    def save_evidences(self, evidences: list[Evidence]) -> None:
        with self._connect() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO evidence (id, pratica_id, item_id, data) VALUES (?, ?, ?, ?)",
                [(e.id, e.pratica_id, e.item_id, e.model_dump_json()) for e in evidences],
            )

    def evidence_for_pratica(self, pratica_id: str) -> list[Evidence]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM evidence WHERE pratica_id = ?", (pratica_id,)
            ).fetchall()
        return [Evidence.model_validate_json(r["data"]) for r in rows]

    # ---------- VerificationResult (append-only) ----------

    def save_verification_result(self, result: VerificationResult) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO verification_result (id, pratica_id, section, computed_at, data) "
                "VALUES (?, ?, ?, ?, ?)",
                (result.id, result.pratica_id, result.section, result.computed_at, result.model_dump_json()),
            )

    def save_verification_results(self, results: list[VerificationResult]) -> None:
        for r in results:
            self.save_verification_result(r)

    def latest_verification_result(self, pratica_id: str, section: str) -> VerificationResult | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM verification_result WHERE pratica_id = ? AND section = ? "
                "ORDER BY computed_at DESC, rowid DESC LIMIT 1",
                (pratica_id, section),
            ).fetchone()
        return VerificationResult.model_validate_json(row["data"]) if row else None

    def latest_verification_results(self, pratica_id: str) -> dict[str, VerificationResult]:
        """Un VerificationResult per sezione: l'ultimo calcolato, per computed_at.

        Se una sezione è stata calcolata più volte (storico per le
        verifiche 11/12), le versioni precedenti restano nello store ma non
        in questo dizionario — usa `evidence_for_pratica`/query dirette se
        serve lo storico completo.
        """
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT section, data FROM verification_result WHERE pratica_id = ? "
                "ORDER BY computed_at ASC, rowid ASC",
                (pratica_id,),
            ).fetchall()
        latest: dict[str, VerificationResult] = {}
        for r in rows:
            latest[r["section"]] = VerificationResult.model_validate_json(r["data"])
        return latest

    # ---------- Finding ----------

    def save_finding(self, finding: Finding) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO finding (id, client, pratica_id, status, data) VALUES (?, ?, ?, ?, ?)",
                (finding.id, finding.client, finding.pratica_id, finding.status, finding.model_dump_json()),
            )

    def open_findings_for_client(self, client: str) -> list[Finding]:
        """Finding non `sistemato` per un cliente, indipendentemente dalla
        pratica in cui sono stati sollevati — la query che serve alle
        verifiche 11/12 del principio ("cosa era aperto l'ultima volta?").
        """
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM finding WHERE client = ? AND status != 'sistemato'",
                (client,),
            ).fetchall()
        return [Finding.model_validate_json(r["data"]) for r in rows]
