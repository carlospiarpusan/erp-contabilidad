-- ============================================================
-- MIGRACIÓN 001 — TABLAS MAESTRAS
-- ERP Contabilidad — Basado en Coin In
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ──────────────────────────────────────────────────────────────
-- 1. EMPRESAS (multi-tenant: todo tiene empresa_id)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE empresas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  nit           TEXT NOT NULL,
  dv            TEXT,
  razon_social  TEXT,
  direccion     TEXT,
  ciudad        TEXT DEFAULT 'Ipiales',
  departamento  TEXT DEFAULT 'Nariño',
  pais          TEXT DEFAULT 'Colombia',
  telefono      TEXT,
  email         TEXT,
  logo_url      TEXT,
  regimen       TEXT DEFAULT 'simplificado', -- simplificado | comun
  tipo_org      TEXT DEFAULT 'persona_natural',
  activa        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nit)
);

-- ──────────────────────────────────────────────────────────────
-- 2. USUARIOS Y ROLES (mejora técnica: multi-usuario con roles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL, -- admin | vendedor | contador | solo_lectura
  descripcion TEXT,
  permisos    JSONB DEFAULT '{}'::jsonb
  -- Ejemplo permisos: {"ventas":true,"compras":true,"contabilidad":false,"config":false}
);

CREATE TABLE usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol_id      UUID REFERENCES roles(id),
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  telefono    TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 3. EJERCICIOS CONTABLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE ejercicios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  año          INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  estado       TEXT DEFAULT 'activo', -- activo | cerrado
  UNIQUE(empresa_id, año)
);

-- ──────────────────────────────────────────────────────────────
-- 4. BODEGAS / ALMACENES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE bodegas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo      TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  principal   BOOLEAN DEFAULT FALSE,
  activa      BOOLEAN DEFAULT TRUE,
  UNIQUE(empresa_id, codigo)
);

-- ──────────────────────────────────────────────────────────────
-- 5. PUC — PLAN ÚNICO DE CUENTAS (Colombia)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE cuentas_puc (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  descripcion     TEXT NOT NULL,
  tipo            TEXT, -- activo|pasivo|patrimonio|ingreso|gasto|costo
  nivel           INTEGER, -- 1=clase 2=grupo 3=cuenta 4=subcuenta
  naturaleza      TEXT DEFAULT 'debito', -- debito | credito
  cuenta_padre_id UUID REFERENCES cuentas_puc(id),
  activa          BOOLEAN DEFAULT TRUE,
  UNIQUE(empresa_id, codigo)
);

-- Cuentas especiales asignadas (para asientos automáticos)
CREATE TABLE cuentas_especiales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL UNIQUE,
  -- Tipos: clientes|proveedores|acreedores|caja|banco|
  --        ingresos|costo_ventas|iva_ventas|iva_compras|inventario
  cuenta_id   UUID NOT NULL REFERENCES cuentas_puc(id)
);

-- ──────────────────────────────────────────────────────────────
-- 6. IMPUESTOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE impuestos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo               TEXT NOT NULL, -- CO19, CO05, CO0, RETEIVA, RETEFUENTE
  descripcion          TEXT NOT NULL,
  porcentaje           DECIMAL(5,2) NOT NULL DEFAULT 0,
  porcentaje_recargo   DECIMAL(5,2) DEFAULT 0,
  subcuenta_compras_id UUID REFERENCES cuentas_puc(id),
  subcuenta_ventas_id  UUID REFERENCES cuentas_puc(id),
  por_defecto          BOOLEAN DEFAULT FALSE,
  UNIQUE(empresa_id, codigo)
);

-- ──────────────────────────────────────────────────────────────
-- 7. FORMAS DE PAGO
-- ──────────────────────────────────────────────────────────────
CREATE TABLE formas_pago (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  tipo             TEXT DEFAULT 'contado', -- contado|credito|anticipado
  genera_factura   BOOLEAN DEFAULT FALSE,
  dias_vencimiento INTEGER DEFAULT 0,
  cuenta_id        UUID REFERENCES cuentas_puc(id),
  activa           BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- 8. SERIES / CONSECUTIVOS DE DOCUMENTOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE consecutivos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  descripcion        TEXT NOT NULL,
  prefijo            TEXT DEFAULT '',
  consecutivo_actual INTEGER DEFAULT 0,
  tipo               TEXT NOT NULL,
  -- factura_venta|factura_compra|nota_credito|nota_debito|
  -- pedido|cotizacion|remision|orden_compra|gasto|pos
  activo             BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- 9. FAMILIAS (categorías de productos)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE familias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT
);

-- ──────────────────────────────────────────────────────────────
-- 10. FABRICANTES / MARCAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE fabricantes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL
);

-- ──────────────────────────────────────────────────────────────
-- 11. TRANSPORTADORAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE transportadoras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  whatsapp    TEXT,
  url_rastreo TEXT,
  activa      BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- 12. TIPOS DE GASTO
-- ──────────────────────────────────────────────────────────────
CREATE TABLE tipos_gasto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  descripcion    TEXT NOT NULL,
  cuenta_id      UUID REFERENCES cuentas_puc(id),
  valor_estimado DECIMAL(15,2) DEFAULT 0
);

-- ──────────────────────────────────────────────────────────────
-- MEJORA TÉCNICA #6: AUDIT LOG (historial de cambios)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id),
  usuario_id  UUID REFERENCES auth.users(id),
  tabla       TEXT NOT NULL,
  registro_id UUID,
  accion      TEXT NOT NULL, -- INSERT | UPDATE | DELETE
  datos_antes JSONB,
  datos_nuevos JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por registro
CREATE INDEX idx_audit_registro ON audit_log(tabla, registro_id);
CREATE INDEX idx_audit_empresa ON audit_log(empresa_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- MEJORA TÉCNICA #5: NOTIFICACIONES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE notificaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  usuario_id  UUID REFERENCES auth.users(id), -- null = para todos
  tipo        TEXT NOT NULL,
  -- stock_bajo|factura_vencida|cotizacion_vencida|pago_recibido
  titulo      TEXT NOT NULL,
  mensaje     TEXT,
  leida       BOOLEAN DEFAULT FALSE,
  datos       JSONB, -- metadata adicional (id del documento, etc.)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id, leida, created_at DESC);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_empresas
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
