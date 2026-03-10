-- ============================================================
-- MIGRACIÓN 002 — ENTIDADES PRINCIPALES
-- Clientes, Proveedores, Colaboradores, Productos, Stock
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. COLABORADORES / VENDEDORES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE colaboradores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  email                TEXT,
  telefono             TEXT,
  porcentaje_comision  DECIMAL(5,2) DEFAULT 0,
  meta_mensual         DECIMAL(15,2) DEFAULT 0, -- MEJORA: meta de ventas
  activo               BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 2. GRUPOS DE CLIENTES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE grupos_clientes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0
);

-- ──────────────────────────────────────────────────────────────
-- 3. CLIENTES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  razon_social            TEXT NOT NULL,
  nombre_contacto         TEXT,
  tipo_documento          TEXT DEFAULT 'NIT', -- NIT|CC|CE|Pasaporte|PEP
  numero_documento        TEXT,
  dv                      TEXT,
  responsabilidad_fiscal  TEXT DEFAULT 'R-99-PN',
  aplica_retencion        BOOLEAN DEFAULT FALSE,
  grupo_id                UUID REFERENCES grupos_clientes(id),
  colaborador_id          UUID REFERENCES colaboradores(id),
  email                   TEXT,
  telefono                TEXT,
  whatsapp                TEXT, -- MEJORA: WhatsApp separado del teléfono
  direccion               TEXT,
  ciudad                  TEXT DEFAULT 'Ipiales',
  departamento            TEXT DEFAULT 'Nariño',
  pais                    TEXT DEFAULT 'Colombia',
  limite_credito          DECIMAL(15,2) DEFAULT 0, -- MEJORA: límite de crédito
  dias_credito            INTEGER DEFAULT 0,
  observaciones           TEXT,
  activo                  BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id, activo);
CREATE INDEX idx_clientes_documento ON clientes(numero_documento);

-- Direcciones adicionales por cliente
CREATE TABLE clientes_direcciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL, -- "Casa", "Bodega", "Sucursal Bogotá"
  direccion   TEXT NOT NULL,
  ciudad      TEXT,
  departamento TEXT,
  principal   BOOLEAN DEFAULT FALSE
);

-- ──────────────────────────────────────────────────────────────
-- 4. PROVEEDORES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE proveedores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  razon_social     TEXT NOT NULL,
  contacto         TEXT,
  tipo_documento   TEXT DEFAULT 'NIT',
  numero_documento TEXT,
  dv               TEXT,
  email            TEXT,
  telefono         TEXT,
  whatsapp         TEXT,
  direccion        TEXT,
  ciudad           TEXT,
  departamento     TEXT,
  observaciones    TEXT,
  activo           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 5. ACREEDORES (para gastos — diferente de proveedores)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE acreedores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  razon_social     TEXT NOT NULL,
  contacto         TEXT,
  numero_documento TEXT,
  email            TEXT,
  telefono         TEXT,
  activo           BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- 6. PRODUCTOS / ARTÍCULOS
-- Incluye mejoras: variantes, código de barras, fecha vencimiento
-- ──────────────────────────────────────────────────────────────
CREATE TABLE productos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo              TEXT NOT NULL,
  codigo_barras       TEXT,                        -- MEJORA #10: código de barras
  descripcion         TEXT NOT NULL,
  descripcion_larga   TEXT,
  precio_venta        DECIMAL(15,2) NOT NULL DEFAULT 0,
  precio_compra       DECIMAL(15,2) NOT NULL DEFAULT 0,
  precio_venta2       DECIMAL(15,2),               -- precio mayorista
  tiene_variantes     BOOLEAN DEFAULT FALSE,        -- MEJORA #9: variantes
  familia_id          UUID REFERENCES familias(id),
  fabricante_id       UUID REFERENCES fabricantes(id),
  impuesto_id         UUID REFERENCES impuestos(id),
  cuenta_venta_id     UUID REFERENCES cuentas_puc(id),
  cuenta_compra_id    UUID REFERENCES cuentas_puc(id),
  cuenta_inventario_id UUID REFERENCES cuentas_puc(id),
  imagen_url          TEXT,
  tiene_vencimiento   BOOLEAN DEFAULT FALSE,        -- para productos perecederos
  unidad_medida       TEXT DEFAULT 'UND',
  peso_gramos         INTEGER,
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

CREATE INDEX idx_productos_empresa ON productos(empresa_id, activo);
CREATE INDEX idx_productos_barras ON productos(codigo_barras) WHERE codigo_barras IS NOT NULL;

-- MEJORA #9: Variantes de producto (talla + color para fajas/brassieres)
CREATE TABLE producto_variantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sku           TEXT,                -- código único de la variante
  codigo_barras TEXT,
  talla         TEXT,                -- XS|S|M|L|XL|XXL|XXXL o numérico
  color         TEXT,
  precio_venta  DECIMAL(15,2),       -- si null, usa el del producto padre
  precio_compra DECIMAL(15,2),
  imagen_url    TEXT,
  activo        BOOLEAN DEFAULT TRUE,
  UNIQUE(producto_id, talla, color)
);

-- ──────────────────────────────────────────────────────────────
-- 7. STOCK (inventario por bodega y variante)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  variante_id      UUID REFERENCES producto_variantes(id) ON DELETE CASCADE,
  bodega_id        UUID NOT NULL REFERENCES bodegas(id) ON DELETE CASCADE,
  cantidad         DECIMAL(15,3) DEFAULT 0,
  cantidad_minima  DECIMAL(15,3) DEFAULT 0,  -- MEJORA #11: alerta stock mínimo
  cantidad_maxima  DECIMAL(15,3),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id, variante_id, bodega_id)
);

CREATE INDEX idx_stock_producto ON stock(producto_id);
CREATE INDEX idx_stock_bodega ON stock(bodega_id);

-- Vista para stock bajo (alimenta las notificaciones)
CREATE VIEW stock_bajo AS
  SELECT
    s.id,
    s.producto_id,
    s.variante_id,
    s.bodega_id,
    s.cantidad,
    s.cantidad_minima,
    p.empresa_id,
    p.codigo,
    p.descripcion,
    b.nombre AS bodega_nombre
  FROM stock s
  JOIN productos p ON p.id = s.producto_id
  JOIN bodegas b ON b.id = s.bodega_id
  WHERE s.cantidad <= s.cantidad_minima
    AND s.cantidad_minima > 0;

-- ──────────────────────────────────────────────────────────────
-- 8. LISTA DE PRECIOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE listas_precios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  tipo                 TEXT DEFAULT 'cliente', -- cliente | grupo | general
  cliente_id           UUID REFERENCES clientes(id) ON DELETE CASCADE,
  grupo_id             UUID REFERENCES grupos_clientes(id) ON DELETE CASCADE,
  producto_id          UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  variante_id          UUID REFERENCES producto_variantes(id),
  precio               DECIMAL(15,2) NOT NULL,
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  valida_desde         DATE,
  valida_hasta         DATE
);

-- Triggers updated_at
CREATE TRIGGER set_updated_at_clientes
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_productos
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_proveedores
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_stock
  BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
