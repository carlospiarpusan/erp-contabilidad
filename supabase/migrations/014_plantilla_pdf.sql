-- ============================================================
-- MIGRACIÓN 014 — PLANTILLA PDF EN EMPRESA
-- ============================================================
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS plantilla_pdf TEXT DEFAULT 'clasica'
    CHECK (plantilla_pdf IN ('clasica', 'moderna', 'minimalista', 'compacta'));
