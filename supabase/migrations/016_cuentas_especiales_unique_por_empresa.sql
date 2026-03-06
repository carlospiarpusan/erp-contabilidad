-- ============================================================
-- MIGRACIÓN 012 — CUENTAS ESPECIALES: UNIQUE POR EMPRESA
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cuentas_especiales_tipo_key'
  ) THEN
    ALTER TABLE cuentas_especiales
      DROP CONSTRAINT cuentas_especiales_tipo_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cuentas_especiales_empresa_tipo_key'
  ) THEN
    ALTER TABLE cuentas_especiales
      ADD CONSTRAINT cuentas_especiales_empresa_tipo_key UNIQUE (empresa_id, tipo);
  END IF;
END $$;
