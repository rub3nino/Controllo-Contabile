"""Reporter per generare output della Sezione D.

Produce diversi formati di output:
- Markdown per documentazione
- Dati strutturati per Excel
- Integrazione con Evidence Store
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from backend.modules.jet.models import JETResult, JETAnomaly, AnomalyType


class JETReporter:
    """Genera report dall'analisi JET.
    
    Uso:
        reporter = JETReporter(result)
        reporter.to_markdown("report.md")
        data = reporter.to_section_d_data()
    """
    
    def __init__(self, result: JETResult):
        self.result = result
    
    def to_markdown(self, output_path: str | Path | None = None) -> str:
        """Genera report in formato Markdown.
        
        Args:
            output_path: Se specificato, salva il report su file
            
        Returns:
            Contenuto del report in Markdown
        """
        r = self.result
        lines = []
        
        # Header
        lines.append(f"# Test Rilevazioni Contabili (JET) — Sezione D")
        lines.append("")
        lines.append(f"**Cliente:** {r.client}")
        lines.append(f"**Periodo:** {r.period}")
        lines.append(f"**Data analisi:** {r.analyzed_at}")
        lines.append(f"**Pratica:** {r.pratica_id}")
        lines.append("")
        
        # Stato
        status_emoji = {"✓": "✅", "wip": "⏳", "✗": "❌", "N/A": "➖"}
        lines.append(f"## Stato: {status_emoji.get(r.status, '')} {r.status}")
        lines.append("")
        lines.append(f"> {r.reasoning}")
        lines.append("")
        
        # Campionamento
        lines.append("## Campionamento")
        lines.append("")
        lines.append(f"| Metrica | Valore |")
        lines.append(f"|---------|--------|")
        lines.append(f"| File analizzato | `{r.sample.source_file}` |")
        lines.append(f"| Registrazioni totali | {r.sample.total_entries:,} |")
        lines.append(f"| Registrazioni campionate | {r.sample.sample_size:,} |")
        lines.append(f"| Copertura | {r.sample.sample_percentage:.1f}% |")
        lines.append(f"| Importo campionato | €{r.sample.total_amount_sampled:,.2f} |")
        lines.append("")
        
        # Configurazione campionamento
        cfg = r.sample.config
        lines.append("### Configurazione campionamento")
        lines.append("")
        lines.append(f"- Campione casuale: {cfg.random_count} registrazioni")
        if cfg.threshold_amount:
            lines.append(f"- Soglia materialità: €{cfg.threshold_amount:,.2f}")
        if cfg.focus_accounts:
            lines.append(f"- Conti focus: {', '.join(cfg.focus_accounts)}")
        if cfg.include_unbalanced:
            lines.append("- Incluse registrazioni sbilanciate")
        lines.append("")
        
        # Risultati validazione
        lines.append("## Risultati Validazione")
        lines.append("")
        lines.append(f"| Metrica | Valore |")
        lines.append(f"|---------|--------|")
        lines.append(f"| Registrazioni validate | {r.entries_validated} |")
        lines.append(f"| Con problemi | {r.entries_with_issues} |")
        lines.append(f"| Anomalie critiche | {r.critical_anomalies} |")
        lines.append(f"| Anomalie warning | {r.warning_anomalies} |")
        lines.append("")
        
        # Dettaglio anomalie
        if r.anomalies:
            lines.append("## Anomalie Rilevate")
            lines.append("")
            
            # Raggruppa per severità
            critical = [a for a in r.anomalies if a.severity == "critical"]
            warning = [a for a in r.anomalies if a.severity == "warning"]
            info = [a for a in r.anomalies if a.severity == "info"]
            
            if critical:
                lines.append("### ❌ Critiche")
                lines.append("")
                for a in critical:
                    lines.append(f"- **Reg. {a.entry_number}** ({a.anomaly_type.value}): {a.description}")
                lines.append("")
            
            if warning:
                lines.append("### ⚠️ Warning")
                lines.append("")
                for a in warning:
                    lines.append(f"- **Reg. {a.entry_number}** ({a.anomaly_type.value}): {a.description}")
                lines.append("")
            
            if info:
                lines.append("### ℹ️ Note")
                lines.append("")
                for a in info[:10]:  # Max 10 note
                    lines.append(f"- Reg. {a.entry_number}: {a.description}")
                if len(info) > 10:
                    lines.append(f"- ... e altre {len(info) - 10} note")
                lines.append("")
        
        # Campione analizzato (prime 10 registrazioni)
        if r.sample.entries:
            lines.append("## Registrazioni Campionate (prime 10)")
            lines.append("")
            lines.append("| N° | Data | Causale | Dare | Avere | Stato |")
            lines.append("|---:|------|---------|-----:|------:|-------|")
            
            for entry in r.sample.entries[:10]:
                validation = next(
                    (v for v in r.validations if v.entry_id == entry.id),
                    None
                )
                status = "✓" if (validation and validation.is_valid) else "⚠"
                
                lines.append(
                    f"| {entry.entry_number} | {entry.registration_date} | "
                    f"{entry.description[:30]}... | "
                    f"{entry.total_debit:,.2f} | {entry.total_credit:,.2f} | {status} |"
                )
            
            if len(r.sample.entries) > 10:
                lines.append(f"| ... | ... | *altre {len(r.sample.entries) - 10} registrazioni* | ... | ... | ... |")
            lines.append("")
        
        content = "\n".join(lines)
        
        if output_path:
            Path(output_path).write_text(content, encoding="utf-8")
        
        return content
    
    def to_section_d_data(self) -> dict:
        """Genera dati strutturati per la Sezione D del WPS.
        
        Returns:
            Dizionario con i dati per la carta D
        """
        r = self.result
        
        return {
            "section": "D",
            "title": "Test rilevazioni contabili",
            "status": r.status,
            "reasoning": r.reasoning,
            
            "summary": {
                "entries_total": r.sample.total_entries,
                "entries_sampled": r.sample.sample_size,
                "sample_percentage": round(r.sample.sample_percentage, 1),
                "entries_validated": r.entries_validated,
                "entries_with_issues": r.entries_with_issues,
                "critical_anomalies": r.critical_anomalies,
                "warning_anomalies": r.warning_anomalies,
            },
            
            "source": {
                "file": r.sample.source_file,
                "analyzed_at": r.analyzed_at,
            },
            
            "anomalies": [
                {
                    "type": a.anomaly_type.value,
                    "severity": a.severity,
                    "entry_number": a.entry_number,
                    "description": a.description,
                }
                for a in r.anomalies
            ],
        }
    
    def to_json(self, output_path: str | Path | None = None) -> str:
        """Esporta il risultato completo in JSON.
        
        Args:
            output_path: Se specificato, salva su file
            
        Returns:
            JSON string
        """
        data = self.result.model_dump(mode="json")
        content = json.dumps(data, indent=2, ensure_ascii=False)
        
        if output_path:
            Path(output_path).write_text(content, encoding="utf-8")
        
        return content
    
    def to_evidence(self):
        """Converte in Evidence per l'Evidence Store.
        
        Returns:
            backend.domain.models.Evidence
        """
        from backend.domain.models import Evidence, ExtractedField
        
        r = self.result
        
        fields = [
            ExtractedField(
                kind="jet_entries_total",
                value=str(r.sample.total_entries),
            ),
            ExtractedField(
                kind="jet_entries_sampled",
                value=str(r.sample.sample_size),
            ),
            ExtractedField(
                kind="jet_critical_anomalies",
                value=str(r.critical_anomalies),
            ),
            ExtractedField(
                kind="jet_warning_anomalies",
                value=str(r.warning_anomalies),
            ),
        ]
        
        return Evidence(
            pratica_id=r.pratica_id,
            item_id="D.1",
            found=r.entries_validated > 0,
            source_path=r.sample.source_file if r.entries_validated > 0 else None,
            source_name="Libro giornale",
            fields=fields,
            method="jet_analysis",
            confidence=0.9 if r.entries_validated > 0 else 0.0,
            excerpt=f"Campionate {r.sample.sample_size} registrazioni su {r.sample.total_entries}",
            notes=r.reasoning,
        )


def generate_jet_report(result: JETResult, output_dir: str | Path) -> dict:
    """Genera tutti i report per un'analisi JET.
    
    Args:
        result: Risultato dell'analisi
        output_dir: Cartella di output
        
    Returns:
        Dizionario con i percorsi dei file generati
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    reporter = JETReporter(result)
    
    # Markdown
    md_path = output_dir / "jet_report.md"
    reporter.to_markdown(md_path)
    
    # JSON
    json_path = output_dir / "jet_result.json"
    reporter.to_json(json_path)
    
    return {
        "markdown": str(md_path),
        "json": str(json_path),
        "status": result.status,
        "reasoning": result.reasoning,
    }
