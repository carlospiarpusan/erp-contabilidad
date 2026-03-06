-- ============================================================
-- MIGRACIÓN 017 — ÍNDICES DE PERFORMANCE
-- Optimiza listados, filtros y búsquedas frecuentes
-- ============================================================

-- Búsquedas ILIKE aceleradas (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────
-- PRODUCTOS
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_empresa_activo_descripcion
  ON productos (empresa_id, activo, descripcion);

CREATE INDEX IF NOT EXISTS idx_productos_empresa_familia_activo_desc
  ON productos (empresa_id, familia_id, activo, descripcion);

CREATE INDEX IF NOT EXISTS idx_productos_empresa_fabricante_activo_desc
  ON productos (empresa_id, fabricante_id, activo, descripcion);

CREATE INDEX IF NOT EXISTS idx_productos_descripcion_trgm
  ON productos USING gin (descripcion gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_codigo_trgm
  ON productos USING gin (codigo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras_trgm
  ON productos USING gin (codigo_barras gin_trgm_ops)
  WHERE codigo_barras IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_activo_razon
  ON clientes (empresa_id, activo, razon_social);

CREATE INDEX IF NOT EXISTS idx_clientes_razon_social_trgm
  ON clientes USING gin (razon_social gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clientes_email_trgm
  ON clientes USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_telefono_trgm
  ON clientes USING gin (telefono gin_trgm_ops)
  WHERE telefono IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- PROVEEDORES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa_activo_razon
  ON proveedores (empresa_id, activo, razon_social);

CREATE INDEX IF NOT EXISTS idx_proveedores_razon_social_trgm
  ON proveedores USING gin (razon_social gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTOS
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doc_empresa_tipo_fecha_numero
  ON documentos (empresa_id, tipo, fecha DESC, numero DESC);

CREATE INDEX IF NOT EXISTS idx_doc_empresa_tipo_estado_fecha
  ON documentos (empresa_id, tipo, estado, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_doc_empresa_tipo_cliente_fecha
  ON documentos (empresa_id, tipo, cliente_id, fecha DESC)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_empresa_tipo_proveedor_fecha
  ON documentos (empresa_id, tipo, proveedor_id, fecha DESC)
  WHERE proveedor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_numero_externo_trgm
  ON documentos USING gin (numero_externo gin_trgm_ops)
  WHERE numero_externo IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- STOCK / RECIBOS
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_alerta_minimo
  ON stock (producto_id, cantidad_minima, cantidad);

CREATE INDEX IF NOT EXISTS idx_stock_alerta_bajo
  ON stock (cantidad, cantidad_minima)
  WHERE cantidad_minima > 0;

CREATE INDEX IF NOT EXISTS idx_recibos_empresa_tipo_fecha
  ON recibos (empresa_id, tipo, fecha DESC);
