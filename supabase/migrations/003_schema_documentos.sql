-- ============================================================
-- MIGRACIÓN 003 — DOCUMENTOS TRANSACCIONALES
-- Facturas, Recibos, Cotizaciones, Pedidos, Remisiones,
-- Gastos, Asientos, Servicios, Garantías
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. DOCUMENTOS (cabecera genérica)
-- Cubre: factura_venta, factura_compra, cotizacion, pedido,
--        remision, orden_compra, nota_credito, nota_debito, gasto
-- ──────────────────────────────────────────────────────────────
CREATE TABLE documentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  numero              INTEGER NOT NULL,
  serie_id            UUID REFERENCES consecutivos(id),
  prefijo             TEXT DEFAULT '',
  numero_externo      TEXT,          -- # factura del proveedor en compras
  -- Tercero (solo uno aplica según tipo)
  cliente_id          UUID REFERENCES clientes(id),
  proveedor_id        UUID REFERENCES proveedores(id),
  acreedor_id         UUID REFERENCES acreedores(id),
  -- Opcionales
  colaborador_id      UUID REFERENCES colaboradores(id),
  bodega_id           UUID REFERENCES bodegas(id),
  forma_pago_id       UUID REFERENCES formas_pago(id),
  transportadora_id   UUID REFERENCES transportadoras(id),
  ejercicio_id        UUID REFERENCES ejercicios(id),
  -- Origen (trazabilidad de conversión entre documentos)
  documento_origen_id UUID REFERENCES documentos(id),
  -- Fechas
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   DATE,
  -- Totales calculados (se guardan para reportes rápidos)
  subtotal            DECIMAL(15,2) DEFAULT 0,
  total_iva           DECIMAL(15,2) DEFAULT 0,
  total_descuento     DECIMAL(15,2) DEFAULT 0,
  total               DECIMAL(15,2) DEFAULT 0,
  total_costo         DECIMAL(15,2) DEFAULT 0, -- costo de lo vendido
  -- Estado
  estado              TEXT DEFAULT 'pendiente',
  -- pendiente|pagada|cancelada|convertida|aprobada|vencida
  email_enviado       BOOLEAN DEFAULT FALSE,
  whatsapp_enviado    BOOLEAN DEFAULT FALSE,   -- MEJORA #20
  -- MEJORA #14 DIAN: campos para factura electrónica
  cufe                TEXT,                    -- código único factura electrónica
  qr_url              TEXT,
  dian_estado         TEXT,                    -- enviada|aceptada|rechazada
  -- Otros
  observaciones       TEXT,
  -- MEJORA: campo para número de aprobación en pedidos
  aprobada_por        UUID REFERENCES auth.users(id),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, tipo, numero, prefijo)
);

CREATE INDEX idx_doc_empresa_tipo ON documentos(empresa_id, tipo, estado);
CREATE INDEX idx_doc_cliente ON documentos(cliente_id, fecha DESC);
CREATE INDEX idx_doc_proveedor ON documentos(proveedor_id, fecha DESC);
CREATE INDEX idx_doc_fecha ON documentos(empresa_id, fecha DESC);
CREATE INDEX idx_doc_estado ON documentos(empresa_id, tipo, estado, fecha_vencimiento);

-- ──────────────────────────────────────────────────────────────
-- 2. LÍNEAS DE DOCUMENTOS (ítems de cada documento)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE documentos_lineas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id         UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  producto_id          UUID REFERENCES productos(id),
  variante_id          UUID REFERENCES producto_variantes(id), -- MEJORA #9
  descripcion          TEXT,            -- descripción libre si no hay producto
  cantidad             DECIMAL(15,3) NOT NULL,
  precio_unitario      DECIMAL(15,2) NOT NULL,
  precio_costo         DECIMAL(15,2) DEFAULT 0, -- costo al momento de vender
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  impuesto_id          UUID REFERENCES impuestos(id),
  subtotal             DECIMAL(15,2) NOT NULL, -- cantidad × precio sin iva
  total_descuento      DECIMAL(15,2) DEFAULT 0,
  total_iva            DECIMAL(15,2) DEFAULT 0,
  total                DECIMAL(15,2) NOT NULL,  -- total con iva
  -- MEJORA: número de lote y fecha de vencimiento por línea
  numero_lote          TEXT,
  fecha_vencimiento    DATE,
  orden                INTEGER DEFAULT 0
);

CREATE INDEX idx_lineas_documento ON documentos_lineas(documento_id);
CREATE INDEX idx_lineas_producto ON documentos_lineas(producto_id);

-- ──────────────────────────────────────────────────────────────
-- 3. RECIBOS (pagos de facturas — venta y compra)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE recibos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL, -- venta | compra
  numero        INTEGER NOT NULL,
  documento_id  UUID NOT NULL REFERENCES documentos(id),
  forma_pago_id UUID REFERENCES formas_pago(id),
  ejercicio_id  UUID REFERENCES ejercicios(id),
  valor         DECIMAL(15,2) NOT NULL,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, tipo, numero)
);

CREATE INDEX idx_recibos_documento ON recibos(documento_id);

-- ──────────────────────────────────────────────────────────────
-- 4. ASIENTOS CONTABLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE asientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ejercicio_id  UUID NOT NULL REFERENCES ejercicios(id),
  numero        INTEGER,
  tipo          TEXT DEFAULT 'automatico', -- automatico | manual
  tipo_doc      TEXT,    -- factura_venta|factura_compra|recibo|gasto|manual
  documento_id  UUID REFERENCES documentos(id),
  recibo_id     UUID REFERENCES recibos(id),
  concepto      TEXT,
  importe       DECIMAL(15,2) DEFAULT 0, -- suma total del debe (debe = haber)
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asientos_empresa ON asientos(empresa_id, ejercicio_id, fecha DESC);
CREATE INDEX idx_asientos_doc ON asientos(documento_id);

-- ──────────────────────────────────────────────────────────────
-- 5. LÍNEAS DE ASIENTOS (partidas dobles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE asientos_lineas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id  UUID NOT NULL REFERENCES asientos(id) ON DELETE CASCADE,
  cuenta_id   UUID NOT NULL REFERENCES cuentas_puc(id),
  descripcion TEXT,
  debe        DECIMAL(15,2) DEFAULT 0,
  haber       DECIMAL(15,2) DEFAULT 0,
  CONSTRAINT debe_haber_positivos CHECK (debe >= 0 AND haber >= 0),
  CONSTRAINT no_debe_y_haber CHECK (NOT (debe > 0 AND haber > 0))
);

CREATE INDEX idx_asientos_lineas ON asientos_lineas(asiento_id);
CREATE INDEX idx_asientos_cuenta ON asientos_lineas(cuenta_id);

-- ──────────────────────────────────────────────────────────────
-- 6. SERVICIOS TÉCNICOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE servicios_tecnicos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero         INTEGER NOT NULL,
  cliente_id     UUID NOT NULL REFERENCES clientes(id),
  tipo           TEXT, -- garantia | reparacion | mantenimiento
  estado         TEXT DEFAULT 'abierto', -- abierto|en_proceso|cerrado
  servicio       TEXT NOT NULL,
  direccion      TEXT,
  prioridad      TEXT DEFAULT 'normal', -- baja|normal|alta|urgente
  fecha_inicio   DATE DEFAULT CURRENT_DATE,
  fecha_promesa  DATE,
  fecha_cierre   DATE,
  tecnico_id     UUID REFERENCES colaboradores(id),
  observaciones  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero)
);

-- ──────────────────────────────────────────────────────────────
-- 7. GARANTÍAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE garantias (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero               INTEGER NOT NULL,
  cliente_id           UUID NOT NULL REFERENCES clientes(id),
  proveedor_id         UUID REFERENCES proveedores(id),
  producto_id          UUID REFERENCES productos(id),
  variante_id          UUID REFERENCES producto_variantes(id),
  numero_serie         TEXT,
  numero_rma           TEXT,
  fecha_venta          DATE,
  fecha_compra         DATE,
  estado               TEXT DEFAULT 'activa', -- activa|en_proceso|resuelta|vencida
  prioridad            TEXT DEFAULT 'normal',
  observaciones        TEXT,
  servicio_tecnico_id  UUID REFERENCES servicios_tecnicos(id),
  documento_venta_id   UUID REFERENCES documentos(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero)
);

-- ──────────────────────────────────────────────────────────────
-- 8. MOVIMIENTOS DE STOCK (trazabilidad completa)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE stock_movimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos(id),
  variante_id   UUID REFERENCES producto_variantes(id),
  bodega_id     UUID NOT NULL REFERENCES bodegas(id),
  tipo          TEXT NOT NULL,
  -- entrada_compra|salida_venta|salida_remision|entrada_devolucion|
  -- ajuste_positivo|ajuste_negativo|traslado_entrada|traslado_salida
  documento_id  UUID REFERENCES documentos(id),
  cantidad      DECIMAL(15,3) NOT NULL, -- positivo=entrada, negativo=salida
  stock_antes   DECIMAL(15,3) NOT NULL,
  stock_despues DECIMAL(15,3) NOT NULL,
  precio_costo  DECIMAL(15,2) DEFAULT 0,
  numero_lote   TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_mov_producto ON stock_movimientos(producto_id, created_at DESC);
CREATE INDEX idx_stock_mov_doc ON stock_movimientos(documento_id);

-- Triggers
CREATE TRIGGER set_updated_at_documentos
  BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
