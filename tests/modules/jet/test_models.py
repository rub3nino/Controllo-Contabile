"""Test per i modelli JET."""

from datetime import date
from decimal import Decimal

import pytest

from backend.modules.jet.models import (
    JournalEntry,
    JournalEntryLine,
    JournalSample,
    JETResult,
    JETAnomaly,
    SampleConfig,
    ValidationResult,
    AnomalyType,
    AccountType,
)


class TestJournalEntryLine:
    """Test per JournalEntryLine."""
    
    def test_decimal_parsing_italian_format(self):
        """Testa il parsing di importi in formato italiano."""
        line = JournalEntryLine(
            line_number=1,
            account_code="10.01.001",
            debit="1.234,56",
            credit="0",
        )
        assert line.debit == Decimal("1234.56")
    
    def test_decimal_parsing_english_format(self):
        """Testa il parsing di importi in formato inglese."""
        line = JournalEntryLine(
            line_number=1,
            account_code="10.01.001",
            debit="1,234.56",
            credit="0",
        )
        assert line.debit == Decimal("1234.56")
    
    def test_decimal_empty_value(self):
        """Testa che valori vuoti diventino zero."""
        line = JournalEntryLine(
            line_number=1,
            account_code="10.01.001",
            debit="",
            credit=None,
        )
        assert line.debit == Decimal("0")
        assert line.credit == Decimal("0")


class TestJournalEntry:
    """Test per JournalEntry."""
    
    def test_balanced_entry(self):
        """Testa che una registrazione bilanciata sia riconosciuta."""
        entry = JournalEntry(
            entry_number=1,
            registration_date=date(2025, 9, 1),
            description="Test entry",
            lines=[
                JournalEntryLine(
                    line_number=1,
                    account_code="10.01.001",
                    debit=Decimal("1000"),
                    credit=Decimal("0"),
                ),
                JournalEntryLine(
                    line_number=2,
                    account_code="20.01.001",
                    debit=Decimal("0"),
                    credit=Decimal("1000"),
                ),
            ],
        )
        entry.compute_totals()
        
        assert entry.is_balanced()
        assert entry.balance_diff() == Decimal("0")
        assert entry.total_debit == Decimal("1000")
        assert entry.total_credit == Decimal("1000")
    
    def test_unbalanced_entry(self):
        """Testa che una registrazione sbilanciata sia riconosciuta."""
        entry = JournalEntry(
            entry_number=1,
            registration_date=date(2025, 9, 1),
            description="Unbalanced entry",
            lines=[
                JournalEntryLine(
                    line_number=1,
                    account_code="10.01.001",
                    debit=Decimal("1000"),
                    credit=Decimal("0"),
                ),
                JournalEntryLine(
                    line_number=2,
                    account_code="20.01.001",
                    debit=Decimal("0"),
                    credit=Decimal("900"),
                ),
            ],
        )
        entry.compute_totals()
        
        assert not entry.is_balanced()
        assert entry.balance_diff() == Decimal("100")


class TestSampleConfig:
    """Test per SampleConfig."""
    
    def test_default_config(self):
        """Testa la configurazione di default."""
        config = SampleConfig()
        assert config.random_count == 25
        assert config.threshold_amount is None
        assert config.focus_accounts == []
        assert config.include_unbalanced is True
    
    def test_custom_config(self):
        """Testa una configurazione personalizzata."""
        config = SampleConfig(
            random_count=50,
            threshold_amount=Decimal("10000"),
            focus_accounts=["10.01.001", "20.01.001"],
            include_round_amounts=True,
        )
        assert config.random_count == 50
        assert config.threshold_amount == Decimal("10000")
        assert len(config.focus_accounts) == 2


class TestJETAnomaly:
    """Test per JETAnomaly."""
    
    def test_to_domain_anomaly(self):
        """Testa la conversione in Anomaly del domain."""
        anomaly = JETAnomaly(
            anomaly_type=AnomalyType.UNBALANCED,
            severity="critical",
            entry_id="abc123",
            entry_number=42,
            description="Test anomaly",
        )
        
        domain_anomaly = anomaly.to_domain_anomaly()
        
        assert domain_anomaly.kind == "jet_unbalanced"
        assert domain_anomaly.severity == "critical"
        assert domain_anomaly.related_item_id == "D.1"


class TestJETResult:
    """Test per JETResult."""
    
    def test_compute_status_no_entries(self):
        """Testa lo stato con nessuna entry analizzata."""
        result = JETResult(
            pratica_id="test",
            client="Test Client",
            period="Q3 2025",
            sample=JournalSample(
                config=SampleConfig(),
                source_file="test.xlsx",
                total_entries=0,
                sample_size=0,
            ),
        )
        result.compute_status()
        
        assert result.status == "wip"
        assert "Nessuna registrazione" in result.reasoning
    
    def test_compute_status_critical_anomalies(self):
        """Testa lo stato con anomalie critiche."""
        result = JETResult(
            pratica_id="test",
            client="Test Client",
            period="Q3 2025",
            sample=JournalSample(
                config=SampleConfig(),
                source_file="test.xlsx",
                total_entries=100,
                sample_size=25,
            ),
            validations=[
                ValidationResult(entry_id="1", is_valid=True, checks_passed=["all"]),
            ],
            anomalies=[
                JETAnomaly(
                    anomaly_type=AnomalyType.UNBALANCED,
                    severity="critical",
                    entry_id="1",
                    entry_number=1,
                    description="Test",
                ),
            ],
        )
        result.compute_status()
        
        assert result.status == "wip"
        assert "1 anomalie critiche" in result.reasoning
    
    def test_compute_status_success(self):
        """Testa lo stato di successo."""
        result = JETResult(
            pratica_id="test",
            client="Test Client",
            period="Q3 2025",
            sample=JournalSample(
                config=SampleConfig(),
                source_file="test.xlsx",
                total_entries=100,
                sample_size=25,
            ),
            validations=[
                ValidationResult(entry_id="1", is_valid=True, checks_passed=["all"]),
            ],
            anomalies=[],
        )
        result.compute_status()
        
        assert result.status == "✓"
        assert "Nessuna anomalia" in result.reasoning
