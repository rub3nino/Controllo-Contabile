"""Loader per il libro giornale.

Gestisce il caricamento e parsing del libro giornale da diversi formati:
- Excel (.xlsx, .xls)
- CSV
- (futuro) PDF con OCR

Il loader produce una lista di JournalEntry pronte per il campionamento.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterator

from backend.modules.jet.models import (
    JournalEntry,
    JournalEntryLine,
    AccountType,
)

logger = logging.getLogger(__name__)


class JournalLoadError(Exception):
    """Errore durante il caricamento del libro giornale."""
    pass


class ColumnMapping:
    """Mapping delle colonne del file Excel alle proprietà delle registrazioni.
    
    Il libro giornale può avere strutture diverse a seconda del gestionale.
    Questa classe permette di configurare il mapping per ogni formato.
    """
    
    # Mapping predefiniti per gestionali comuni
    DEFAULT = {
        "entry_number": ["N. Reg.", "Numero", "Nr.", "Num", "N°", "Registrazione"],
        "registration_date": ["Data Reg.", "Data", "Data Registrazione", "Dt. Reg."],
        "document_date": ["Data Doc.", "Data Documento", "Dt. Doc."],
        "description": ["Descrizione", "Causale", "Desc.", "Testo"],
        "document_ref": ["Rif. Doc.", "N. Doc.", "Documento", "Fattura"],
        "account_code": ["Conto", "Cod. Conto", "Codice", "C/C"],
        "account_name": ["Descrizione Conto", "Nome Conto", "Desc. Conto"],
        "debit": ["Dare", "D", "Addebito", "Debit"],
        "credit": ["Avere", "A", "Accredito", "Credit"],
    }
    
    def __init__(self, mapping: dict[str, list[str]] | None = None):
        self.mapping = mapping or self.DEFAULT.copy()
    
    def find_column(self, headers: list[str], field: str) -> int | None:
        """Trova l'indice della colonna per un campo dato."""
        if field not in self.mapping:
            return None
        
        candidates = self.mapping[field]
        headers_lower = [h.lower().strip() if h else "" for h in headers]
        
        for candidate in candidates:
            candidate_lower = candidate.lower().strip()
            for idx, header in enumerate(headers_lower):
                if candidate_lower in header or header in candidate_lower:
                    return idx
        return None


class JournalLoader:
    """Carica e parsa il libro giornale da file Excel.
    
    Uso:
        loader = JournalLoader()
        entries = loader.load("path/to/libro_giornale.xlsx")
    """
    
    def __init__(
        self,
        column_mapping: ColumnMapping | None = None,
        sheet_name: str | int = 0,
        header_row: int = 0,
        skip_rows: int = 0,
    ):
        """
        Args:
            column_mapping: Mapping colonne personalizzato (default: auto-detect)
            sheet_name: Nome o indice del foglio da leggere
            header_row: Riga che contiene le intestazioni (0-indexed)
            skip_rows: Righe da saltare all'inizio (dopo l'header)
        """
        self.column_mapping = column_mapping or ColumnMapping()
        self.sheet_name = sheet_name
        self.header_row = header_row
        self.skip_rows = skip_rows
        
        self._headers: list[str] = []
        self._col_indices: dict[str, int | None] = {}
    
    def load(self, file_path: str | Path) -> list[JournalEntry]:
        """Carica il libro giornale da file.
        
        Args:
            file_path: Percorso del file da caricare
            
        Returns:
            Lista di JournalEntry
            
        Raises:
            JournalLoadError: Se il file non può essere caricato/parsato
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise JournalLoadError(f"File non trovato: {file_path}")
        
        suffix = file_path.suffix.lower()
        
        if suffix in (".xlsx", ".xls"):
            return self._load_excel(file_path)
        elif suffix == ".csv":
            return self._load_csv(file_path)
        else:
            raise JournalLoadError(f"Formato non supportato: {suffix}")
    
    def _load_excel(self, file_path: Path) -> list[JournalEntry]:
        """Carica da file Excel usando openpyxl."""
        try:
            import openpyxl
        except ImportError:
            raise JournalLoadError("openpyxl non installato. Esegui: pip install openpyxl")
        
        try:
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        except Exception as e:
            raise JournalLoadError(f"Errore apertura Excel: {e}")
        
        # Seleziona il foglio
        if isinstance(self.sheet_name, int):
            if self.sheet_name >= len(wb.sheetnames):
                raise JournalLoadError(f"Foglio {self.sheet_name} non esiste (max: {len(wb.sheetnames)-1})")
            sheet = wb[wb.sheetnames[self.sheet_name]]
        else:
            if self.sheet_name not in wb.sheetnames:
                raise JournalLoadError(f"Foglio '{self.sheet_name}' non trovato. Disponibili: {wb.sheetnames}")
            sheet = wb[self.sheet_name]
        
        rows = list(sheet.iter_rows(values_only=True))
        wb.close()
        
        if len(rows) <= self.header_row:
            raise JournalLoadError("File vuoto o header_row oltre la fine del file")
        
        # Estrai headers
        self._headers = [str(h) if h else "" for h in rows[self.header_row]]
        self._detect_columns()
        
        # Verifica colonne essenziali
        if self._col_indices.get("entry_number") is None:
            logger.warning("Colonna 'entry_number' non trovata, uso indice riga")
        
        # Parsa le righe
        entries: list[JournalEntry] = []
        current_entry: JournalEntry | None = None
        
        data_start = self.header_row + 1 + self.skip_rows
        
        for row_idx, row in enumerate(rows[data_start:], start=data_start + 1):
            if self._is_empty_row(row):
                continue
            
            # Estrai i valori
            entry_num = self._get_value(row, "entry_number")
            reg_date = self._get_date(row, "registration_date")
            description = self._get_value(row, "description", "")
            account_code = self._get_value(row, "account_code", "")
            debit = self._get_decimal(row, "debit")
            credit = self._get_decimal(row, "credit")
            
            # Se c'è un nuovo numero registrazione, crea una nuova entry
            if entry_num and (current_entry is None or str(entry_num) != str(current_entry.entry_number)):
                if current_entry is not None:
                    current_entry.compute_totals()
                    entries.append(current_entry)
                
                current_entry = JournalEntry(
                    entry_number=int(entry_num) if entry_num else row_idx,
                    registration_date=reg_date or date.today(),
                    document_date=self._get_date(row, "document_date"),
                    description=description,
                    document_ref=self._get_value(row, "document_ref"),
                    source_row=row_idx,
                    source_sheet=sheet.title if hasattr(sheet, 'title') else str(self.sheet_name),
                )
            
            # Aggiungi la riga alla registrazione corrente
            if current_entry is not None and account_code:
                line = JournalEntryLine(
                    line_number=len(current_entry.lines) + 1,
                    account_code=account_code,
                    account_name=self._get_value(row, "account_name", ""),
                    debit=debit,
                    credit=credit,
                    description=description if not current_entry.description else "",
                )
                current_entry.lines.append(line)
        
        # Aggiungi l'ultima entry
        if current_entry is not None:
            current_entry.compute_totals()
            entries.append(current_entry)
        
        logger.info(f"Caricate {len(entries)} registrazioni da {file_path.name}")
        return entries
    
    def _load_csv(self, file_path: Path) -> list[JournalEntry]:
        """Carica da file CSV."""
        import csv
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f, delimiter=";")  # Assume CSV italiano
                rows = list(reader)
        except Exception as e:
            # Riprova con encoding diverso
            try:
                with open(file_path, "r", encoding="latin-1") as f:
                    reader = csv.reader(f, delimiter=";")
                    rows = list(reader)
            except Exception as e2:
                raise JournalLoadError(f"Errore lettura CSV: {e2}")
        
        if len(rows) <= self.header_row:
            raise JournalLoadError("File CSV vuoto")
        
        self._headers = rows[self.header_row]
        self._detect_columns()
        
        # Converti le righe in tuple per uniformità con Excel
        data_start = self.header_row + 1 + self.skip_rows
        entries: list[JournalEntry] = []
        current_entry: JournalEntry | None = None
        
        for row_idx, row in enumerate(rows[data_start:], start=data_start + 1):
            row_tuple = tuple(row)
            if self._is_empty_row(row_tuple):
                continue
            
            entry_num = self._get_value(row_tuple, "entry_number")
            reg_date = self._get_date(row_tuple, "registration_date")
            account_code = self._get_value(row_tuple, "account_code", "")
            debit = self._get_decimal(row_tuple, "debit")
            credit = self._get_decimal(row_tuple, "credit")
            
            if entry_num and (current_entry is None or str(entry_num) != str(current_entry.entry_number)):
                if current_entry is not None:
                    current_entry.compute_totals()
                    entries.append(current_entry)
                
                current_entry = JournalEntry(
                    entry_number=int(entry_num) if entry_num else row_idx,
                    registration_date=reg_date or date.today(),
                    description=self._get_value(row_tuple, "description", ""),
                    source_row=row_idx,
                )
            
            if current_entry is not None and account_code:
                line = JournalEntryLine(
                    line_number=len(current_entry.lines) + 1,
                    account_code=account_code,
                    account_name=self._get_value(row_tuple, "account_name", ""),
                    debit=debit,
                    credit=credit,
                )
                current_entry.lines.append(line)
        
        if current_entry is not None:
            current_entry.compute_totals()
            entries.append(current_entry)
        
        return entries
    
    def _detect_columns(self) -> None:
        """Rileva automaticamente gli indici delle colonne."""
        fields = ["entry_number", "registration_date", "document_date", 
                  "description", "document_ref", "account_code", 
                  "account_name", "debit", "credit"]
        
        for field in fields:
            self._col_indices[field] = self.column_mapping.find_column(self._headers, field)
        
        detected = [f for f, idx in self._col_indices.items() if idx is not None]
        logger.debug(f"Colonne rilevate: {detected}")
    
    def _is_empty_row(self, row: tuple) -> bool:
        """Verifica se la riga è vuota."""
        return all(v is None or str(v).strip() == "" for v in row)
    
    def _get_value(self, row: tuple, field: str, default: Any = None) -> Any:
        """Estrae un valore dalla riga."""
        idx = self._col_indices.get(field)
        if idx is None or idx >= len(row):
            return default
        
        val = row[idx]
        if val is None or str(val).strip() == "":
            return default
        return str(val).strip()
    
    def _get_date(self, row: tuple, field: str) -> date | None:
        """Estrae una data dalla riga."""
        val = self._get_value(row, field)
        if val is None:
            return None
        
        # Se è già un datetime/date
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, date):
            return val
        
        # Parse da stringa
        val = str(val).strip()
        
        # Prova vari formati
        formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
            "%d/%m/%y", "%d-%m-%y",
            "%d.%m.%Y", "%d.%m.%y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
        
        logger.warning(f"Data non parsabile: {val}")
        return None
    
    def _get_decimal(self, row: tuple, field: str) -> Decimal:
        """Estrae un importo decimale dalla riga."""
        val = self._get_value(row, field)
        if val is None:
            return Decimal("0")
        
        # Se è già un numero
        if isinstance(val, (int, float, Decimal)):
            return Decimal(str(val))
        
        # Parse da stringa
        val = str(val).strip()
        if val == "" or val == "-":
            return Decimal("0")
        
        try:
            # Rimuovi simboli valuta
            val = val.replace("€", "").replace("$", "").strip()
            
            # Gestisce formati italiani (1.234,56) e inglesi (1,234.56)
            if "," in val and "." in val:
                if val.rfind(",") > val.rfind("."):
                    # Formato italiano
                    val = val.replace(".", "").replace(",", ".")
                else:
                    # Formato inglese
                    val = val.replace(",", "")
            elif "," in val:
                val = val.replace(",", ".")
            
            return Decimal(val)
        except InvalidOperation:
            logger.warning(f"Importo non parsabile: {val}")
            return Decimal("0")


def load_journal(file_path: str | Path, **kwargs) -> list[JournalEntry]:
    """Funzione di convenienza per caricare un libro giornale.
    
    Args:
        file_path: Percorso del file
        **kwargs: Argomenti passati a JournalLoader
        
    Returns:
        Lista di JournalEntry
    """
    loader = JournalLoader(**kwargs)
    return loader.load(file_path)
