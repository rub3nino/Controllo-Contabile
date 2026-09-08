from __future__ import annotations


class UserError(Exception):
    """Errore pensato per l'operatore: titolo, spiegazione, elenco di ciò che manca."""

    def __init__(self, title: str, detail: str = "", missing: list[str] | None = None):
        super().__init__(title)
        self.title = title
        self.detail = detail
        self.missing = missing or []

    def as_dict(self) -> dict:
        return {"title": self.title, "detail": self.detail, "missing": self.missing}


def from_exception(exc: BaseException) -> UserError:
    if isinstance(exc, UserError):
        return exc
    text = str(exc).strip() or exc.__class__.__name__
    low = text.lower()
    if "cartella" in low and ("non trov" in low or "not found" in low):
        return UserError(
            "Cartella documenti non trovata",
            "Il server non vede quel percorso. Su web non usare C:\\ o /Volumes dal PC: scegli la cartella dal pulsante oppure collega un path che il server può leggere.",
            ["Cartella documenti accessibile al server"],
        )
    if "fuori dalle radici" in low or "allowed" in low:
        return UserError(
            "Cartella non consentita",
            "Per sicurezza Quadra apre solo cartelle sotto il progetto o QUADRA_ALLOWED_ROOTS. Chiedi di aggiungere il disco di rete, oppure carica i file dal browser.",
            ["QUADRA_ALLOWED_ROOTS", "Oppure caricamento dal browser"],
        )
    if "nessuna pratica" in low:
        return UserError(
            "Manca la pratica",
            "Compila almeno il cliente e il trimestre a sinistra, poi scegli una cartella e premi Scansiona.",
            ["Nome cliente", "Cartella documenti"],
        )
    if "template" in low or "master" in low:
        return UserError(
            "Manca il modello Excel",
            "Non trovo Template_MASTER.xlsx nella cartella dell'applicazione. Senza quel file non si può compilare il WPS.",
            ["Template_MASTER.xlsx"],
        )
    if "paddle" in low or "ocr" in low:
        return UserError(
            "OCR non disponibile",
            f"La lettura dei PDF scansionati non è partita. Dettaglio tecnico: {text}",
            ["Runtime PaddleOCR o fallback RapidOCR"],
        )
    return UserError(
        "Qualcosa è andato storto",
        f"Operazione interrotta. Dettaglio: {text}",
        [],
    )
