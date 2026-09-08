"""Contratti dati condivisi per il redesign di Quadra (Fase 0).

Questo modulo NON contiene logica. Definisce solo i modelli Pydantic che
faranno da interfaccia tra i livelli descritti in
`docs/piano_azione_redesign.md` (§2):

    ingestion (L1) --> Evidence --> motore di verifica (L3) --> VerificationResult
                                          |
                                          v
                                       Finding (continuità fra trimestri)

    ClientConfig (L4) alimenta sia l'ingestion che il motore di verifica,
    dicendo quali voci di catalogo/banche/soglie valgono per QUESTO cliente.

Il "principio" citato nei docstring è il principio di revisione SA Italia
250B. Le 12 verifiche numerate sono quelle elencate in
`docs/analisi_obiettivi_controllo_contabile.md` §3 — i numeri (1-12) usati
qui sono gli stessi di quella tabella, non un'invenzione di questo modulo.

Nessuno di questi modelli viene ancora scritto o letto da `backend/main.py`,
`backend/pipeline.py` o dal resto del backend esistente: sono contratti per
il lavoro futuro (Fase 1+), isolati in questo package.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from backend.models import Status

__all__ = [
    "ExtractedField",
    "Evidence",
    "Anomaly",
    "VerificationResult",
    "FindingRef",
    "Finding",
    "HumanOverride",
    "PraticaRecord",
    "ClientCatalogItem",
    "ClientBankAccount",
    "ClientConfig",
]

# Le 9 carte di lavoro A-I (stesso alfabeto di backend.catalog.SECTION_TITLES).
# Riportato come Literal qui, invece che importato da catalog.py, perché
# backend/catalog.py resta un modulo "esistente" che questa fase non tocca:
# il Literal è solo un vincolo di tipo, la fonte di verità sui titoli resta
# SECTION_TITLES.
Section = Literal["A", "B", "C", "D", "E", "F", "G", "H", "I"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    return str(uuid4())[:8]


class ExtractedField(BaseModel):
    """Un singolo campo strutturato letto da un documento.

    Un solo documento può soddisfare più campi contemporaneamente (un F24
    ha data versamento + protocollo + importo tutti sullo stesso PDF): per
    questo `Evidence.fields` è una lista di `ExtractedField`, non un singolo
    valore. `kind` è testo libero (non un Literal) perché il vocabolario dei
    campi cambia per tipo di documento e per carta di lavoro (es. "importo",
    "data_versamento", "protocollo", "saldo_ec", "saldo_coge", "ultima_pagina",
    "ultimo_numero_registrazione", "data_ultimo_verbale"...) e la Fase 0 non
    deve congelare quell'elenco: lo farà il motore di verifica in Fase 1,
    modulo per sezione. Fissare qui un Literal chiuso costringerebbe a
    rivedere questo contratto ogni volta che si aggiunge un nuovo tipo di
    dato estratto.
    """

    kind: str = Field(
        description="Nome del campo, es. 'importo', 'data_versamento', 'protocollo', 'saldo_ec'."
    )
    value: str = Field(
        description=(
            "Valore come stringa (anche per importi/date): la normalizzazione "
            "a tipi Python (Decimal, date) è compito del motore di verifica "
            "che consuma questo campo, non di questo contratto — evita di "
            "dover scegliere ora un formato numerico/data valido per ogni "
            "possibile campo futuro."
        )
    )
    unit: str | None = Field(
        default=None, description="Unità o formato, es. 'EUR', 'gg', se utile a chi consuma il campo."
    )


class Evidence(BaseModel):
    """Un fatto raccolto da un documento (o l'assenza di quel fatto).

    Corrisponde al livello 1 del piano (ingestion) e sostituisce, come
    contratto, quello che oggi produce `classify.py`/`extract.py` in modo
    implicito dentro `DocumentOut`/`ProvenanceRow`. Il vocabolario di
    `method` è lo stesso già in uso in `ProvenanceRow.method` e
    `DocumentOut.method` (visti in `backend/classify.py` ed `extract.py`):
    "filename", "folder", "content", "ocr", "pdf-text", "xlsx", "formula",
    "umano". Non è un Literal per lo stesso motivo di `ExtractedField.kind`:
    l'ingestion (stream Codex, Fase 2+) potrà aggiungere nuovi metodi di
    estrazione senza dover riaprire questo contratto.

    **Perché esiste anche `found=False`:** il principio SA 250B (verifiche
    5, 7, 8 — vedi §3 dell'analisi) richiede di accertare non solo "cosa
    c'è" ma anche "cosa manca": un `item_id` per cui non è stata trovata
    nessuna prova è un fatto positivo (abbiamo guardato, non c'è), non
    un'assenza di dato. Per questo un'Evidence con `found=False` è un record
    esplicito — non semplicemente "nessuna riga in tabella per questo
    item_id" — ed è la base per calcolare lo stato `wip` (vedi
    `TEMPLATE_RULES.md` §4: documento assente = wip, mai vuoto e basta).
    """

    id: str = Field(default_factory=_new_id)
    pratica_id: str = Field(
        description="Pratica (cliente+periodo) a cui appartiene questa evidenza. Chiave per l'evidence store (Fase 1)."
    )
    item_id: str = Field(
        description=(
            "Voce di catalogo soddisfatta (o cercata), es. 'E.1'. Sempre presente: "
            "anche un'Evidence con found=False deve dire QUALE voce non è stata trovata."
        )
    )

    found: bool = Field(
        default=True,
        description="False = si è cercata questa voce di catalogo e non è stata trovata (vedi motivazione nella docstring della classe).",
    )

    source_path: str | None = Field(default=None, description="Percorso file di origine, se found=True.")
    source_name: str | None = Field(default=None, description="Nome file di origine, se found=True.")

    fields: list[ExtractedField] = Field(
        default_factory=list,
        description="Dati strutturati estratti da questo documento per questa voce (vuoto se found=False o se il documento non ha campi strutturati, es. un verbale).",
    )

    method: str = Field(
        description="Come è stata ottenuta: 'filename' | 'folder' | 'content' | 'ocr' | 'pdf-text' | 'xlsx' | 'formula' | 'umano' | altro (vocabolario di ProvenanceRow.method)."
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Affidabilità della classificazione/estrazione, 0-1.")
    excerpt: str = Field(default="", description="Estratto testuale breve usato per giustificare item_id/fields, come in ProvenanceRow.excerpt.")
    notes: str = Field(default="", description="Nota libera, es. motivo per cui found=False ('nessun file con estratto conto Intesa nel trimestre').")

    collected_at: str = Field(default_factory=_now, description="Timestamp ISO di quando questa evidenza è stata raccolta/calcolata.")


class Anomaly(BaseModel):
    """Una carenza del tipo 'c'è ma non torna', non 'manca'.

    Distinta da 'voce mancante' (quella si esprime con `Evidence(found=False)`
    e finisce in `VerificationResult.missing_items`): qui il documento esiste,
    ma il suo contenuto non è coerente con quanto atteso. Esempi concreti dal
    caso Ferrero (`TEMPLATE_RULES.md` §7.5, §7.3, §11): scostamento saldo
    banca/contabilità fuori soglia (verifica 7/8), F24 con un addendo a più
    decimali (`2947.008`, un errore umano nel file Ferrero, §11 punto 9),
    versamento F24 fuori dai tempi attesi (verifica 8).

    `kind` è testo libero come `ExtractedField.kind`, stesso motivo: il
    motore di verifica (Fase 1) definirà il vocabolario reale per sezione;
    qui si fissa solo la forma (tipo + descrizione + severità), non
    l'elenco chiuso dei tipi, perché la dashboard (Fase 3) deve poter
    raggruppare/filtrare per tipo senza dover leggere solo `description`
    in linguaggio naturale.
    """

    kind: str = Field(description="Tipo di anomalia, es. 'saldo_banca_scostamento', 'f24_importo_decimali', 'versamento_in_ritardo'.")
    description: str = Field(description="Descrizione in linguaggio naturale, con i valori concreti (es. 'saldo e/c Intesa: 12.400 vs co.ge 11.900, scostamento 500€').")
    severity: Literal["info", "warning", "critical"] = Field(description="Gravità, stesso vocabolario di LogEvent.level (info/warn/error in backend/models.py, qui esteso a 'critical').")
    related_item_id: str | None = Field(default=None, description="Voce di catalogo coinvolta, se pertinente (es. 'F.1').")


class VerificationResult(BaseModel):
    """Esito calcolato per una sezione (A-I) di una pratica.

    È l'output del livello 3 (motore di verifica, Fase 1) e l'input
    principale della dashboard (Fase 3) e del renderer Excel (Fase 3b).
    Sostituisce, come contratto, quello che oggi `TEMPLATE_RULES.md` §4.1
    chiama "regola di calcolo (conservativa)" per lo status INDICE
    `F10:F18` — ma qui lo stato porta con sé la motivazione e le prove,
    non solo il codice ✓/wip/✗/N/A.

    `status` riusa `backend.models.Status` (richiesto esplicitamente: non
    ridefinire il Literal). Nota che `Status` include anche `""` (vuoto) per
    compatibilità con l'uso esistente in `AppState.checklist`; per un
    `VerificationResult` calcolato ci si aspetta sempre uno dei quattro
    codici veri, non la stringa vuota — ma il tipo resta lo stesso per non
    biforcare il vocabolario di stato tra vecchio e nuovo sistema.
    """

    id: str = Field(default_factory=_new_id)
    pratica_id: str
    client: str = Field(description="Duplicato di comodo (come in ProvenanceRow): evita un join per leggere client/period nella dashboard.")
    period: str

    section: Section = Field(description="Lettera A-I della carta di lavoro (vedi backend.catalog.SECTION_TITLES per i titoli).")

    status: Status = Field(description="Stato finale della sezione: ✓ | wip | ✗ | N/A (stesso Literal di backend.models.Status).")
    reasoning: str = Field(
        description=(
            "Motivazione in linguaggio naturale del perché di questo stato, "
            "es. 'manca l'estratto conto Intesa Sanpaolo del trimestre corrente' "
            "— non solo 'wip'. Deve restare leggibile da un revisore senza dover "
            "aprire evidence/anomalies."
        )
    )

    evidence: list[Evidence] = Field(
        default_factory=list,
        description="Le Evidence (trovate o assenti) che hanno contribuito al calcolo di questo stato.",
    )
    missing_items: list[str] = Field(
        default_factory=list,
        description="item_id di catalogo ancora mancanti per questa sezione (sottoinsieme delle Evidence con found=False qui incluse).",
    )
    anomalies: list[Anomaly] = Field(
        default_factory=list,
        description="Anomalie strutturate trovate (non solo 'manca qualcosa': 'c'è ma non torna').",
    )

    computed_at: str = Field(default_factory=_now, description="Timestamp ISO del calcolo. Un nuovo calcolo produce un nuovo VerificationResult, non un update in-place (storico per verifiche 11/12).")

    @field_validator("status")
    @classmethod
    def _status_non_vuoto(cls, v: Status) -> Status:
        """Fix da revisione Fase 0 (docs/reviews/fase0_review.md, punto 5):
        ``Status`` resta il Literal condiviso di backend.models (non va
        ridefinito), ma un VerificationResult *calcolato* deve sempre avere
        uno dei quattro stati veri — "" è ammesso dal tipo solo per
        compatibilità con AppState.checklist esistente, non ha senso qui.
        """
        if v == "":
            raise ValueError("VerificationResult.status non può essere '' — usa uno tra ✓ | wip | ✗ | N/A")
        return v


class FindingRef(BaseModel):
    """Puntatore a 'in quale pratica' è successo qualcosa.

    Usato sia per dire dove un Finding è stato rilevato la prima volta, sia
    per dire dove è stata verificata la sua chiusura. Un piccolo modello
    dedicato invece di stringhe sparse, per non dover ricordare a mano quali
    campi (pratica_id/client/period) vanno sempre insieme.
    """

    pratica_id: str
    client: str
    period: str


class Finding(BaseModel):
    """Una carenza/anomalia che deve sopravvivere al cambio di trimestre.

    Nasce per chiudere un buco esplicito del processo attuale: oggi ogni
    pratica riparte da un master vuoto (`TEMPLATE_RULES.md`, decisione
    Ruben 2026-09-08) e non c'è modo di sapere, al trimestre T, se quanto
    segnalato a T-1 è stato sistemato. Questo è esattamente ciò che il
    principio SA 250B richiede ai punti 11 e 12 (vedi
    `docs/analisi_obiettivi_controllo_contabile.md` §3):

        11. la direzione ha sistemato le CARENZE PROCEDURALI segnalate alla verifica precedente?
        12. la direzione ha CORRETTO GLI ERRORI CONTABILI segnalati in precedenza?

    `kind` distingue le due famiglie (più un residuo 'altro' per casi che
    non sono né l'uno né l'altro, es. una nota di continuità generica).

    **Modello di continuità:** ogni riga di `Finding` è lo stato di UNA
    pratica su UN problema, non un record mutabile che si aggiorna sul
    posto. Quando lo stesso problema si ripresenta (o si verifica) al
    trimestre successivo, si crea una NUOVA riga con `previous_finding_id`
    che punta alla riga del trimestre precedente: così una fase futura può
    risalire la catena e rispondere a "cosa era aperto l'ultima volta, ed è
    stato chiuso?" (piano §2, livello 3) senza perdere lo storico di ogni
    passaggio. `first_raised` resta fisso lungo tutta la catena (copiato,
    non ricalcolato) per poter rispondere subito "da quanto tempo è aperto"
    senza risalire la catena ogni volta.
    """

    id: str = Field(default_factory=_new_id)

    client: str
    pratica_id: str = Field(description="Pratica in cui QUESTA riga è stata registrata (lo stato che descrive è relativo a questa pratica).")
    period: str

    section: Section = Field(description="Carta di lavoro A-I a cui il finding è collegato.")
    sa250b_check: int | None = Field(
        default=None,
        ge=1,
        le=12,
        description="Numero (1-12) della verifica del principio a cui questo finding risponde, se pertinente (tipicamente 11 o 12; vedi docs/analisi_obiettivi_controllo_contabile.md §3). None se il collegamento non è a una singola verifica numerata.",
    )
    kind: Literal["carenza_procedurale", "errore_contabile", "altro"] = Field(
        description="Famiglia del finding: carenza procedurale (verifica 11) o errore nelle scritture contabili (verifica 12); 'altro' per casi che non rientrano in nessuna delle due."
    )

    description: str = Field(description="Descrizione in linguaggio naturale della carenza/anomalia.")
    status: Literal["aperto", "in_corso", "sistemato"] = Field(description="Stato di questo finding in QUESTA pratica.")

    first_raised: FindingRef = Field(description="Pratica in cui questo problema è stato rilevato la prima volta (fisso lungo tutta la catena di continuità).")
    previous_finding_id: str | None = Field(
        default=None,
        description="id del Finding della pratica precedente che rappresenta lo stesso problema (catena di continuità). None se rilevato per la prima volta in questa pratica.",
    )
    resolved_in: FindingRef | None = Field(
        default=None,
        description="Pratica in cui è stata verificata la chiusura, solo quando status='sistemato'. None finché resta aperto/in corso.",
    )

    created_at: str = Field(default_factory=_now)


class HumanOverride(BaseModel):
    """Decisione umana valida per una singola pratica.

    Modella separatamente ciò che ``TEMPLATE_RULES.md`` §4 distingue:
    ``✗`` significa che l'operatore ha scelto di saltare il controllo in
    questo trimestre; ``N/A`` significa che il controllo non si applica.
    Quest'ultimo è ammesso qui solo come eccezione ad hoc della pratica,
    mentre la non applicabilità strutturale del cliente resta in
    ``ClientConfig.applicable_items``. Una decisione può riguardare una
    singola voce di catalogo oppure un'intera sezione A-I.
    """

    id: str = Field(default_factory=_new_id)
    pratica_id: str
    scope: Literal["item", "section"] = Field(
        description="Ambito della decisione: singola voce di catalogo o intera sezione."
    )
    target: str = Field(
        description="item_id (es. 'E.5') se scope='item', lettera A-I se scope='section'."
    )
    decision: Literal["✗", "N/A"]
    note: str = Field(default="", description="Motivazione libera della decisione umana.")
    decided_by: str | None = Field(default=None, description="Nome o iniziali di chi ha deciso, se disponibili.")
    decided_at: str | None = Field(default=None, description="Timestamp ISO della decisione, se disponibile.")


class PraticaRecord(BaseModel):
    """Identità persistita di una pratica usata dal flusso domain API.

    Finora pratica, cliente, periodo e cartella erano parametri passati a
    mano al motore. L'API deve poterli recuperare usando il solo id senza
    dipendere dallo stato globale del flusso Excel esistente.
    """

    id: str
    client_id: str
    client: str = Field(description="Nome visualizzato letto dal ClientConfig.")
    period: str
    documents_dir: str
    created_at: str = Field(default_factory=_now)


class ClientCatalogItem(BaseModel):
    """Una voce di catalogo NON standard, specifica di un cliente.

    Le 24 voci standard (A.1...G.2, vedi `backend/catalog.py:ITEM_LABELS` e
    `regole/schema.yaml:richiesta_doc.items`) restano la base comune. Questo
    modello serve per i casi che il caso Ferrero segnala come aperti e che
    NON sono semplicemente "applicabile/non applicabile" ma libri/documenti
    in più che il template standard non prevede — esempio reale:
    'Libro verbali del Collegio sindacale', manca in `TEMPLATE_RULES.md`
    §7.6 come riga della carta F e resta lì come APERTO. Con questo modello
    un cliente può aggiungerlo senza toccare `catalog.py`.
    """

    id: str = Field(description="Codice scelto per questo cliente, es. 'F.5' o un codice libero se non si vuole collidere con lo schema standard.")
    label: str = Field(description="Descrizione, come ITEM_LABELS.")
    section: Section = Field(description="Carta di lavoro A-I a cui appartiene.")
    note: str | None = Field(default=None, description="Motivo per cui è stato aggiunto, per chi onboarda il cliente in futuro.")
    hints: list[str] = Field(
        default_factory=list,
        description=(
            "Parole chiave per riconoscere un file su questa voce (nome file e/o testo "
            "estratto), stesso ruolo di `EXTRA_HINTS` in backend/catalog.py ma per-cliente "
            "invece che globale. Campo aggiunto in Fase 2 (backend/domain/client_classify.py): "
            "senza hints una voce extra esiste nel catalogo del cliente ma nessun meccanismo "
            "può classificarci un file contro. Lista vuota = nessuna parola chiave nota, la "
            "voce resta raggiungibile solo per assegnazione manuale (come DocumentPatch.item_id "
            "in backend/models.py oggi)."
        ),
    )


class ClientBankAccount(BaseModel):
    """Una riga dell'anagrafica banche di un cliente (carta E).

    Stessa forma delle 17 righe Ferrero in `regole/schema.yaml:working_papers.E.master_banche_ferrero`
    e `TEMPLATE_RULES.md` §7.5: è la chiave di matching fra bilancino
    (saldo co.ge) ed estratto conto (saldo e/c) per la verifica 7/8 del
    principio (aggiornamento e coerenza della contabilità).
    """

    coge: str = Field(description="Codice conto co.ge, chiave di matching con il bilancino (colonna A della tabella E).")
    banca: str = Field(description="Nome banca, come compare su estratto conto e nel matching per nome file.")
    numero_conto: str = Field(description="IBAN o numero conto come riportato nel file cliente (colonna D della tabella E).")


class ClientConfig(BaseModel):
    """Configurazione di un cliente: cosa cambia rispetto al catalogo standard.

    Livello 4 del piano. Onboardare un cliente diverso da Ferrero deve
    voler dire scrivere/estendere questo oggetto, non toccare
    `backend/catalog.py`, `fill.py` o `extract.py` (vedi piano §4, Fase 2 e
    Fase 4). Guarda `backend/domain/examples/ferrero.yaml` per un'istanza
    reale popolata dal caso Ferrero.

    **Le soglie di materialità sono `| None` di proposito.** Sono
    esplicitamente indicate come APERTE in `TEMPLATE_RULES.md` §13 punto 4
    ("Soglia in euro per segnalare check bancario ≠ 0 e variazioni G
    'significative'") e Ruben ha chiesto di non inventare un numero. Il
    default `None` significa "nessuna soglia automatica: ogni scostamento
    ≠ 0 in E, o qualsiasi variazione in G, resta segnalato per revisione
    umana finché qualcuno non decide e imposta un valore." Il motore di
    verifica (Fase 1) deve trattare `None` come "soglia non impostata", non
    come "soglia zero" — sono semanticamente diversi (zero soglia vorrebbe
    dire "segnala tutto", che è comunque il comportamento di fatto con
    None, ma zero implicherebbe una decisione presa che non è stata presa).
    """

    client_id: str = Field(description="Slug stabile del cliente, es. 'ferrero'. Usato come chiave, non cambia se il nome legale cambia.")
    display_name: str = Field(description="Ragione sociale per intestazioni/output, es. 'Gruppo Ferrero S.p.A.'.")

    applicable_items: list[str] = Field(
        description=(
            "item_id delle 24 voci standard che si applicano a questo cliente. "
            "Le voci standard NON in questa lista sono N/A per il cliente (non "
            "wip, non mancanti: strutturalmente non esistono per lui — es. un "
            "cliente senza Intrastat non ha 'E.5' in lista). Sostituisce, a "
            "livello di configurazione cliente, la lista `na_items` che oggi "
            "in PraticaIn.na_items va impostata a mano ogni pratica."
        )
    )
    extra_items: list[ClientCatalogItem] = Field(
        default_factory=list,
        description="Voci di catalogo non standard aggiunte per questo cliente (es. libro Collegio sindacale).",
    )

    banks: list[ClientBankAccount] = Field(
        default_factory=list,
        description="Anagrafica banche del cliente per la carta E (17 righe nel caso Ferrero).",
    )
    fondi_previdenziali: list[str] = Field(
        default_factory=list,
        description=(
            "Nomi dei fondi previdenziali applicabili (es. 'QUADRIFOR', 'BB PREV IMPIEGATI'...). "
            "Il mapping fondo -> riga/voce di catalogo resta APERTO "
            "(TEMPLATE_RULES.md §7.3: 'mapping esatto fondo <-> riga. Non è scritto nel file') "
            "e non viene deciso qui: questo campo fissa solo l'elenco, non la logica di match."
        ),
    )

    soglia_scostamento_bancario_eur: float | None = Field(
        default=None,
        description=(
            "Soglia in euro sopra la quale uno scostamento |saldo co.ge - saldo e/c| "
            "in carta E (colonna 'Check') genera un'anomalia invece di essere "
            "silenziosamente accettato. None = nessuna soglia automatica, tutto "
            "scostamento ≠ 0 resta segnalato per revisione umana (vedi docstring di classe)."
        ),
    )
    soglia_variazione_significativa_g_pct: float | None = Field(
        default=None,
        description=(
            "Soglia percentuale (assunzione: %Chg della carta G, non un importo assoluto — "
            "APERTO se questa assunzione è corretta, vedi TEMPLATE_RULES.md §7.7) sopra la "
            "quale una variazione di conto tra periodo corrente e comparativo viene segnalata "
            "come 'significativa'. None = nessuna soglia automatica, stessa logica del campo "
            "precedente."
        ),
    )
