-- ============================================================
-- 039: Multi-empresa por usuario (junction table)
-- Permite que un usuario acceda a múltiples empresas
-- ============================================================

-- Tabla junction: qué empresas puede acceder cada usuario y con qué rol
CREATE TABLE IF NOT EXISTS usuario_empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol_id      UUID NOT NULL REFERENCES roles(id),
  es_principal BOOLEAN DEFAULT FALSE,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_ue_usuario ON usuario_empresas(usuario_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_ue_empresa ON usuario_empresas(empresa_id) WHERE activo = TRUE;

-- RLS: usuarios ven sus propias membresías
ALTER TABLE usuario_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver propias membresías"
  ON usuario_empresas FOR SELECT
  USING (usuario_id = auth.uid());

-- Solo service role gestiona membresías (INSERT/UPDATE/DELETE)
REVOKE INSERT, UPDATE, DELETE ON usuario_empresas FROM authenticated;

-- Seed: cada usuario existente obtiene su empresa actual como entrada principal
INSERT INTO usuario_empresas (usuario_id, empresa_id, rol_id, es_principal, activo)
SELECT id, empresa_id, rol_id, TRUE, TRUE
FROM usuarios
WHERE activo = TRUE
  AND empresa_id IS NOT NULL
  AND rol_id IS NOT NULL
ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

-- Función helper para obtener empresas de un usuario
CREATE OR REPLACE FUNCTION get_usuario_empresas(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  empresa_id UUID,
  empresa_nombre TEXT,
  empresa_nit TEXT,
  rol_id UUID,
  rol_nombre TEXT,
  es_principal BOOLEAN
) AS $$
  SELECT
    ue.empresa_id,
    e.nombre::TEXT,
    e.nit::TEXT,
    ue.rol_id,
    r.nombre::TEXT,
    ue.es_principal
  FROM usuario_empresas ue
  JOIN empresas e ON e.id = ue.empresa_id AND e.activa = TRUE
  JOIN roles r ON r.id = ue.rol_id
  WHERE ue.usuario_id = COALESCE(p_user_id, auth.uid())
    AND ue.activo = TRUE
  ORDER BY ue.es_principal DESC, e.nombre;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
