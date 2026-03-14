-- ============================================================
-- MIGRACIÓN 029 — CÉDULA EN USUARIOS + FLAG CAMBIO CONTRASEÑA
-- - Agrega columna cedula (unique por empresa).
-- - Agrega flag debe_cambiar_password (true al crear usuario).
-- ============================================================

-- Agregar columna cedula
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cedula TEXT;

-- Índice parcial: cédula única dentro de cada empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cedula_empresa
  ON usuarios(empresa_id, cedula)
  WHERE cedula IS NOT NULL AND cedula != '';

-- Flag para forzar cambio de contraseña en primer inicio de sesión
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;
