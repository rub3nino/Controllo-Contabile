# Quadra Enterprise Architecture

## Overview

Quadra Enterprise è una piattaforma SaaS multi-tenant per studi di revisione fiscale che supporta:
- **80+ utenti concorrenti** su multipli studi
- **Autenticazione Microsoft** (Entra ID / Azure AD)
- **Isolamento dati completo** tra studi (tenant)
- **Audit logging** di ogni azione
- **Admin panel** centralizzato

## Stack Tecnologico

| Layer | Tecnologia | Motivazione |
|-------|------------|-------------|
| Frontend | React + Vite + TypeScript | SPA moderna, type-safe |
| API | FastAPI + Uvicorn | Async, alta performance, OpenAPI |
| Auth | Microsoft Entra ID | SSO con credenziali aziendali |
| Database | PostgreSQL 16 | Multi-tenant RLS, robusto |
| Cache | Redis 7 | Session, rate limit, queue |
| Storage | Azure Blob Storage | Scalabile, già in ecosistema Microsoft |
| Queue | Celery + Redis | Task asincroni (OCR, analisi) |
| Monitoring | Prometheus + Grafana | Metriche e alerting |

## Architettura Multi-Tenant

### Modello di Isolamento: Row-Level Security (RLS)

```sql
-- Ogni tabella ha tenant_id
CREATE TABLE pratiche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    client_id UUID NOT NULL,
    period VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- ...
);

-- Policy RLS che filtra automaticamente per tenant
CREATE POLICY tenant_isolation ON pratiche
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

ALTER TABLE pratiche ENABLE ROW LEVEL SECURITY;
```

### Context Injection

```python
# Middleware che imposta il tenant context
@app.middleware("http")
async def tenant_context_middleware(request: Request, call_next):
    user = request.state.user  # Da auth middleware
    if user:
        # Imposta il tenant per PostgreSQL RLS
        async with db.connection() as conn:
            await conn.execute(
                "SET app.current_tenant = $1",
                str(user.tenant_id)
            )
    return await call_next(request)
```

## Autenticazione Microsoft Entra ID

### Configurazione Azure

1. **Registra l'applicazione** in Azure Portal → Entra ID → App registrations
2. **Configura redirect URIs**: `https://quadra.tuodominio.it/auth/callback`
3. **Genera client secret**
4. **Abilita i permessi**: `openid`, `profile`, `email`, `User.Read`

### Environment Variables

```bash
# Azure AD / Entra ID
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-here
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Oppure "common" per multi-tenant

# Per multi-tenant (più studi con tenant Azure diversi)
AZURE_AUTHORITY=https://login.microsoftonline.com/common

# Redirect
AZURE_REDIRECT_URI=https://quadra.tuodominio.it/auth/callback
```

### Flusso di Login

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────┐
│ Browser │────▶│ Quadra  │────▶│ Microsoft   │────▶│ Quadra  │
│         │     │ /login  │     │ Login       │     │/callback│
└─────────┘     └─────────┘     └─────────────┘     └─────────┘
     │                                                    │
     │                                                    ▼
     │                                           ┌──────────────┐
     │                                           │ Verifica JWT │
     │                                           │ Crea session │
     │                                           │ in Redis     │
     │                                           └──────────────┘
     │                                                    │
     ◀────────────────────────────────────────────────────┘
                    Set-Cookie: session_id
```

## Schema Database

### Tabelle Principali

```sql
-- Tenant (Studio di revisione)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    azure_tenant_id VARCHAR(100),  -- Per SSO specifico
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Utenti (sincronizzati da Azure AD)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    azure_oid VARCHAR(100) UNIQUE NOT NULL,  -- Object ID da Azure
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'analyst',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clienti dello studio
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    fiscal_code VARCHAR(20),
    config JSONB DEFAULT '{}',  -- ClientConfig YAML → JSON
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pratiche
CREATE TABLE pratiche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    period VARCHAR(50) NOT NULL,  -- "III Trimestre 2025"
    status VARCHAR(20) DEFAULT 'draft',
    assigned_to UUID REFERENCES users(id),
    documents_path VARCHAR(500),  -- Blob storage path
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documenti
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pratica_id UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
    blob_path VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    item_id VARCHAR(20),  -- E.1, F.2, etc.
    classification_method VARCHAR(50),
    confidence FLOAT,
    status VARCHAR(20) DEFAULT 'pending',
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index per query frequenti
CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_pratiche_tenant_status ON pratiche(tenant_id, status);
CREATE INDEX idx_documents_pratica ON documents(pratica_id);
```

## Redis Keys Schema

```
# Session management
session:{user_id}:{session_id} = {
    "token_hash": "...",
    "tenant_id": "...",
    "role": "...",
    "ip": "...",
    "user_agent": "...",
    "created_at": "...",
    "expires_at": "..."
}
TTL: 86400 (24 ore)

# Rate limiting (sliding window)
ratelimit:{tenant_id}:api = count
TTL: 60 secondi

ratelimit:{user_id}:login = count
TTL: 300 secondi (5 minuti)

# Cache
cache:tenant:{tenant_id}:config = {...}
TTL: 300 (5 minuti)

cache:catalog = {...}
TTL: 3600 (1 ora)

# Celery queues
celery (default broker queues)
```

## API Structure

```
/auth/
    POST /login/microsoft      # Redirect a Microsoft
    GET  /callback             # OAuth callback
    POST /logout               # Invalida session
    POST /refresh              # Refresh token

/api/v1/
    GET  /me                   # Profilo utente
    
    # Pratiche
    GET    /pratiche           # Lista (filtrata per tenant + ruolo)
    POST   /pratiche           # Crea nuova
    GET    /pratiche/{id}      # Dettaglio
    PATCH  /pratiche/{id}      # Modifica
    DELETE /pratiche/{id}      # Elimina (soft delete)
    
    # Documenti
    POST   /pratiche/{id}/documents      # Upload
    GET    /pratiche/{id}/documents      # Lista
    DELETE /pratiche/{id}/documents/{doc_id}
    
    # Analisi
    POST   /pratiche/{id}/analyze        # Avvia analisi (async)
    GET    /pratiche/{id}/analysis       # Stato + risultati
    
    # Export
    GET    /pratiche/{id}/export/xlsx
    GET    /pratiche/{id}/export/pdf

/api/v1/admin/
    # Solo Super Admin / Tenant Admin
    GET    /tenants            # Lista tenant
    POST   /tenants            # Crea tenant
    GET    /tenants/{id}       # Dettaglio
    PATCH  /tenants/{id}       # Modifica
    
    GET    /users              # Lista utenti
    POST   /users              # Crea/invita utente
    PATCH  /users/{id}         # Modifica ruolo
    
    GET    /audit              # Audit log (con filtri)
    GET    /metrics            # Metriche sistema
```

## Security Checklist

### Must Have (Fase 1)
- [x] TLS 1.3 obbligatorio (Azure Front Door)
- [x] Microsoft Entra ID SSO
- [x] JWT con firma RS256
- [x] Session in Redis con TTL
- [x] Row-Level Security PostgreSQL
- [x] Audit log di ogni azione
- [x] Input validation (Pydantic strict)
- [x] CORS whitelist
- [x] Rate limiting per tenant/user
- [x] Secrets in Azure Key Vault

### Should Have (Fase 2)
- [ ] MFA enforcement (via Azure AD policy)
- [ ] IP whitelist per tenant (opzionale)
- [ ] Session invalidation on password change
- [ ] Encrypted columns per dati sensibili
- [ ] WAF rules personalizzate
- [ ] Penetration testing

### Nice to Have (Fase 3)
- [ ] SIEM integration
- [ ] SOC 2 compliance documentation
- [ ] Data residency options
- [ ] Backup encryption

## Deployment

### Azure Resources (Terraform)

```hcl
# main.tf (semplificato)
resource "azurerm_resource_group" "quadra" {
  name     = "quadra-production"
  location = "West Europe"
}

resource "azurerm_app_service" "api" {
  name                = "quadra-api"
  resource_group_name = azurerm_resource_group.quadra.name
  # ...
}

resource "azurerm_postgresql_flexible_server" "db" {
  name                = "quadra-db"
  resource_group_name = azurerm_resource_group.quadra.name
  sku_name            = "GP_Standard_D4s_v3"
  # ...
}

resource "azurerm_redis_cache" "cache" {
  name                = "quadra-cache"
  resource_group_name = azurerm_resource_group.quadra.name
  sku_name            = "Standard"
  family              = "C"
  capacity            = 1
  # ...
}

resource "azurerm_storage_account" "docs" {
  name                     = "quadradocs"
  resource_group_name      = azurerm_resource_group.quadra.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  # ...
}
```

### CI/CD (GitHub Actions)

```yaml
name: Deploy to Azure
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Build and push Docker image
        run: |
          docker build -t quadra-api .
          az acr login --name quadraregistry
          docker push quadraregistry.azurecr.io/quadra-api:${{ github.sha }}
      
      - name: Deploy to App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: quadra-api
          images: quadraregistry.azurecr.io/quadra-api:${{ github.sha }}
```

## Stima Costi Azure

| Servizio | SKU | Costo/mese |
|----------|-----|------------|
| App Service | P1v3 x 3 istanze | €300 |
| PostgreSQL Flexible | GP_D4s_v3 | €200 |
| Redis Cache | Standard C1 | €50 |
| Blob Storage | Hot, 500GB | €30 |
| Front Door + WAF | Standard | €50 |
| Monitor + Logs | - | €50 |
| Key Vault | - | €5 |
| **Totale** | | **~€700/mese** |

Con 80 utenti e fatturazione per studio, il costo può essere facilmente coperto.

## Next Steps

1. **Setup progetto** con struttura enterprise
2. **Integrazione Microsoft Entra ID** (priorità assoluta)
3. **Schema database** con RLS
4. **Migrazione API** esistenti
5. **Admin panel** base
6. **Load testing** con 80+ utenti simulati
