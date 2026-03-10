-- ============================================================
-- MIGRACIÓN 025 — HARDENING DE ROLES, COLABORADORES Y RLS
-- - Usuarios inactivos dejan de resolver empresa/rol.
-- - Colaboradores se vinculan explícitamente con usuarios.
-- - Políticas hijas se alinean con roles reales.
-- ============================================================

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_colaboradores_usuario_unico
  ON colaboradores(usuario_id)
  WHERE usuario_id IS NOT NULL;

WITH candidate_pairs AS (
  SELECT
    c.id AS colaborador_id,
    u.id AS usuario_id,
    COUNT(*) OVER (PARTITION BY c.id) AS colaborador_matches,
    COUNT(*) OVER (PARTITION BY u.id) AS usuario_matches
  FROM colaboradores c
  JOIN usuarios u
    ON u.empresa_id = c.empresa_id
   AND u.activo = TRUE
   AND c.email IS NOT NULL
   AND u.email IS NOT NULL
   AND LOWER(c.email) = LOWER(u.email)
  WHERE c.usuario_id IS NULL
)
UPDATE colaboradores c
SET usuario_id = candidate_pairs.usuario_id
FROM candidate_pairs
WHERE c.id = candidate_pairs.colaborador_id
  AND candidate_pairs.colaborador_matches = 1
  AND candidate_pairs.usuario_matches = 1;

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id
  FROM public.usuarios
  WHERE id = auth.uid()
    AND activo = TRUE
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_rol_nombre()
RETURNS TEXT AS $$
  SELECT r.nombre
  FROM public.usuarios u
  JOIN public.roles r ON r.id = u.rol_id
  WHERE u.id = auth.uid()
    AND u.activo = TRUE
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_colaborador_ids_for_user(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID[] AS $$
  WITH usuario_actual AS (
    SELECT id, empresa_id, LOWER(email) AS email
    FROM public.usuarios
    WHERE id = COALESCE(p_user_id, auth.uid())
      AND activo = TRUE
  )
  SELECT COALESCE(array_agg(c.id), '{}'::UUID[])
  FROM public.colaboradores c
  JOIN usuario_actual u
    ON u.empresa_id = c.empresa_id
  WHERE c.usuario_id = u.id
     OR (
       c.usuario_id IS NULL
       AND c.email IS NOT NULL
       AND LOWER(c.email) = u.email
     )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "gestionar clientes_direcciones" ON clientes_direcciones;
CREATE POLICY "gestionar clientes_direcciones" ON clientes_direcciones
  FOR ALL
  USING (
    cliente_id IN (
      SELECT id
      FROM clientes
      WHERE empresa_id = get_empresa_id()
    )
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  )
  WITH CHECK (
    cliente_id IN (
      SELECT id
      FROM clientes
      WHERE empresa_id = get_empresa_id()
    )
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  );

DROP POLICY IF EXISTS "gestionar producto_variantes" ON producto_variantes;
CREATE POLICY "gestionar producto_variantes" ON producto_variantes
  FOR ALL
  USING (
    producto_id IN (
      SELECT id
      FROM productos
      WHERE empresa_id = get_empresa_id()
    )
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  )
  WITH CHECK (
    producto_id IN (
      SELECT id
      FROM productos
      WHERE empresa_id = get_empresa_id()
    )
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  );

DROP POLICY IF EXISTS "admin ve todos los documentos" ON documentos;
CREATE POLICY "ver documentos por rol" ON documentos
  FOR SELECT
  USING (
    empresa_id = get_empresa_id()
    AND (
      get_rol_nombre() IN ('admin', 'contador', 'solo_lectura')
      OR (
        get_rol_nombre() = 'vendedor'
        AND colaborador_id = ANY(public.get_colaborador_ids_for_user())
      )
    )
  );

DROP POLICY IF EXISTS "gestionar lineas documentos" ON documentos_lineas;

CREATE POLICY "insertar lineas documentos" ON documentos_lineas
  FOR INSERT
  WITH CHECK (
    documento_id IN (
      SELECT id
      FROM documentos
      WHERE empresa_id = get_empresa_id()
        AND estado IN ('borrador', 'pendiente')
    )
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  );

CREATE POLICY "actualizar lineas documentos" ON documentos_lineas
  FOR UPDATE
  USING (
    documento_id IN (
      SELECT id
      FROM documentos
      WHERE empresa_id = get_empresa_id()
        AND estado IN ('borrador', 'pendiente')
    )
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    documento_id IN (
      SELECT id
      FROM documentos
      WHERE empresa_id = get_empresa_id()
        AND estado IN ('borrador', 'pendiente')
    )
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE POLICY "eliminar lineas documentos" ON documentos_lineas
  FOR DELETE
  USING (
    documento_id IN (
      SELECT id
      FROM documentos
      WHERE empresa_id = get_empresa_id()
        AND estado IN ('borrador', 'pendiente')
    )
    AND get_rol_nombre() IN ('admin', 'contador')
  );
