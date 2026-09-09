-- Quadra - Script di inizializzazione PostgreSQL
-- Eseguito automaticamente da Docker al primo avvio
--
-- Crea:
-- 1. Estensioni necessarie
-- 2. Schema base con RLS (Row-Level Security)
-- 3. Funzioni helper

-- ============================================
-- ESTENSIONI
-- ============================================

-- UUID per identificatori
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search italiano
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Crypto per hash sicuri
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- FUNZIONI HELPER
-- ============================================

-- Funzione per ottenere tenant corrente
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
    SELECT COALESCE(
        current_setting('app.current_tenant', true),
        ''
    );
$$ LANGUAGE SQL STABLE;

-- Funzione per generare timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABELLA TENANTS
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    
    -- Limiti
    max_users INT DEFAULT 10,
    max_storage_gb INT DEFAULT 10,
    max_pratiche INT DEFAULT 1000,
    
    -- Stato
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspended_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active) WHERE is_active = true;

-- ============================================
-- TABELLA USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identity (da Microsoft Entra ID)
    email VARCHAR(255) NOT NULL,
    microsoft_id VARCHAR(255), -- Object ID da Azure AD
    display_name VARCHAR(255),
    
    -- Ruolo
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    -- viewer, auditor, senior_auditor, manager, tenant_admin, super_admin
    
    -- Stato
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_microsoft ON users(microsoft_id);

-- ============================================
-- TABELLA PRATICHE
-- ============================================

CREATE TABLE IF NOT EXISTS pratiche (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identificazione
    codice VARCHAR(50) NOT NULL,
    anno INT NOT NULL,
    
    -- Cliente
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_cf VARCHAR(16),
    cliente_piva VARCHAR(11),
    
    -- Stato
    status VARCHAR(50) DEFAULT 'draft',
    -- draft, in_progress, review, completed, archived
    
    -- Assegnazione
    responsabile_id UUID REFERENCES users(id),
    team_ids UUID[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, codice, anno)
);

CREATE INDEX IF NOT EXISTS idx_pratiche_tenant ON pratiche(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pratiche_status ON pratiche(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pratiche_responsabile ON pratiche(responsabile_id);

-- ============================================
-- TABELLA DOCUMENTI
-- ============================================

CREATE TABLE IF NOT EXISTS documenti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pratica_id UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
    
    -- File info
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    
    -- Storage
    storage_path TEXT NOT NULL,
    
    -- Classificazione
    tipo VARCHAR(50), -- fattura, bilancio, libro_giornale, f24, etc.
    anno_riferimento INT,
    
    -- OCR/Processing
    ocr_status VARCHAR(50) DEFAULT 'pending',
    ocr_text TEXT,
    ocr_confidence FLOAT,
    extracted_data JSONB,
    
    -- Metadata
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documenti_tenant ON documenti(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documenti_pratica ON documenti(pratica_id);
CREATE INDEX IF NOT EXISTS idx_documenti_tipo ON documenti(tenant_id, tipo);

-- ============================================
-- TABELLA VERIFICHE (JET, F24, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS verifiche (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pratica_id UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
    
    -- Tipo verifica
    tipo VARCHAR(50) NOT NULL, -- jet, f24, fatture, bilancio
    
    -- Stato
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, running, completed, failed
    
    -- Risultati
    result JSONB,
    anomalie JSONB DEFAULT '[]',
    evidenze JSONB DEFAULT '[]',
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Utente
    created_by UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifiche_tenant ON verifiche(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verifiche_pratica ON verifiche(pratica_id);
CREATE INDEX IF NOT EXISTS idx_verifiche_tipo ON verifiche(tenant_id, tipo);

-- ============================================
-- TABELLA AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Chi
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    
    -- Cosa
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    
    -- Dettagli
    details JSONB,
    changes JSONB, -- {field: {old: x, new: y}}
    
    -- Contesto
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    
    -- Quando
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- ============================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================

-- Abilita RLS su tabelle tenant-specific
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pratiche ENABLE ROW LEVEL SECURITY;
ALTER TABLE documenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifiche ENABLE ROW LEVEL SECURITY;

-- Policy: utenti vedono solo il proprio tenant
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id::text = current_tenant_id());

CREATE POLICY tenant_isolation_pratiche ON pratiche
    USING (tenant_id::text = current_tenant_id());

CREATE POLICY tenant_isolation_documenti ON documenti
    USING (tenant_id::text = current_tenant_id());

CREATE POLICY tenant_isolation_verifiche ON verifiche
    USING (tenant_id::text = current_tenant_id());

-- Super admin bypassa RLS (da configurare con ruolo dedicato)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO quadra_admin;
-- ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pratiche_updated_at
    BEFORE UPDATE ON pratiche
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documenti_updated_at
    BEFORE UPDATE ON documenti
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_verifiche_updated_at
    BEFORE UPDATE ON verifiche
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DATI INIZIALI (opzionale)
-- ============================================

-- Tenant demo (solo in development)
-- INSERT INTO tenants (name, slug, settings) VALUES
-- ('Demo Studio', 'demo', '{"theme": "light"}')
-- ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE tenants IS 'Studi di revisione/audit firms';
COMMENT ON TABLE users IS 'Utenti con Microsoft Entra ID SSO';
COMMENT ON TABLE pratiche IS 'Pratiche di revisione contabile';
COMMENT ON TABLE documenti IS 'Documenti caricati (fatture, bilanci, etc.)';
COMMENT ON TABLE verifiche IS 'Risultati verifiche (JET, F24, etc.)';
COMMENT ON TABLE audit_log IS 'Log di tutte le azioni (compliance)';
