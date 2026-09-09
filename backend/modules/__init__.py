"""Moduli specializzati per le verifiche contabili.

Ogni modulo corrisponde a una o più carte di lavoro (A-I) e implementa
la logica specifica per quella sezione. I moduli comunicano con il resto
del sistema attraverso:

- Evidence Store (backend/domain/store.py) per salvare findings ed evidenze
- Verification Engine (backend/domain/verification_engine.py) per lo stato delle sezioni
- Client Config (backend/domain/clients/*.yaml) per le soglie cliente-specifiche

Moduli disponibili:
- jet: Journal Entry Testing (Sezione D) - Test rilevazioni contabili
"""

from backend.modules import jet

__all__ = ["jet"]
