-- ============================================================
-- MIGRACIÓN 009 — HARDENING ROLES (SUPERADMIN + RLS)
-- ============================================================

-- Asegurar rol superadmin (id fijo usado por la app)
INSERT INTO roles (id, nombre, descripcion, permisos)
VALUES (
  '10000000-0000-0000-0000-000000000005',
  'superadmin',
  'Acceso global multiempresa',
  '{"ventas":true,"compras":true,"gastos":true,"contabilidad":true,"config":true,"superadmin":true,"eliminar":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Proteger catálogo de roles con RLS y permisos mínimos
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'roles'
      AND policyname = 'roles read authenticated'
  ) THEN
    CREATE POLICY "roles read authenticated" ON roles
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE roles FROM anon, authenticated;
GRANT SELECT ON TABLE roles TO authenticated;
