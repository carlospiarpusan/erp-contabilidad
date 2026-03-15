-- ============================================================
-- MIGRACIÓN 031 — CONFIGURACIÓN FACTURACIÓN ELECTRÓNICA (DATAICO)
-- ============================================================

CREATE TABLE configuracion_fe (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  proveedor        TEXT NOT NULL DEFAULT 'dataico',  -- proveedor FE
  activa           BOOLEAN DEFAULT FALSE,
  ambiente         TEXT DEFAULT 'pruebas',            -- pruebas | produccion
  auth_token       TEXT,
  account_id       TEXT,
  prefijo          TEXT,                              -- prefijo numeración DIAN
  resolucion       TEXT,                              -- número resolución DIAN
  fecha_resolucion DATE,                              -- fecha resolución
  rango_desde      INTEGER,                           -- rango autorizado desde
  rango_hasta      INTEGER,                           -- rango autorizado hasta
  send_dian        BOOLEAN DEFAULT TRUE,
  send_email       BOOLEAN DEFAULT TRUE,
  email_copia      TEXT,                              -- email copia de FE
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE configuracion_fe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracion_fe_tenant" ON configuracion_fe
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
