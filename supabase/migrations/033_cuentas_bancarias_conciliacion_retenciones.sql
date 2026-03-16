-- ============================================================
-- MIGRACIÓN 033 — CUENTAS BANCARIAS, CONCILIACIÓN, RETENCIONES, PAGOS
-- Módulos adicionales para ERP robusto colombiano
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CUENTAS BANCARIAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE cuentas_bancarias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,                -- "Bancolombia Ahorros"
  banco         TEXT NOT NULL,                -- "Bancolombia"
  tipo_cuenta   TEXT NOT NULL DEFAULT 'ahorros', -- ahorros | corriente
  numero_cuenta TEXT NOT NULL,
  titular       TEXT,
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  saldo_actual  DECIMAL(15,2) DEFAULT 0,
  activa        BOOLEAN DEFAULT TRUE,
  cuenta_contable_id UUID REFERENCES cuentas_puc(id), -- enlace al PUC
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero_cuenta)
);

ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_cuentas_bancarias" ON cuentas_bancarias
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX idx_cuentas_bancarias_empresa ON cuentas_bancarias(empresa_id, activa);

-- Movimientos bancarios (ingresos/egresos en la cuenta)
CREATE TABLE movimientos_bancarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cuenta_bancaria_id  UUID NOT NULL REFERENCES cuentas_bancarias(id),
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo                TEXT NOT NULL,           -- ingreso | egreso | transferencia
  concepto            TEXT NOT NULL,           -- consignacion | cheque | transferencia | nota_debito | nota_credito | interes | comision | otro
  referencia          TEXT,                    -- número cheque, ref transferencia
  descripcion         TEXT,
  monto               DECIMAL(15,2) NOT NULL,
  saldo_despues       DECIMAL(15,2),
  conciliado          BOOLEAN DEFAULT FALSE,
  documento_id        UUID REFERENCES documentos(id),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE movimientos_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_movimientos_bancarios" ON movimientos_bancarios
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX idx_mov_bancarios_cuenta ON movimientos_bancarios(cuenta_bancaria_id, fecha DESC);
CREATE INDEX idx_mov_bancarios_conciliado ON movimientos_bancarios(cuenta_bancaria_id, conciliado);

-- ──────────────────────────────────────────────────────────────
-- 2. CONCILIACIÓN BANCARIA
-- ──────────────────────────────────────────────────────────────
CREATE TABLE conciliaciones_bancarias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cuenta_bancaria_id  UUID NOT NULL REFERENCES cuentas_bancarias(id),
  fecha_inicio        DATE NOT NULL,
  fecha_fin           DATE NOT NULL,
  saldo_extracto      DECIMAL(15,2) NOT NULL,   -- saldo según extracto bancario
  saldo_libros        DECIMAL(15,2) NOT NULL,    -- saldo según nuestros libros
  diferencia          DECIMAL(15,2) NOT NULL DEFAULT 0,
  estado              TEXT DEFAULT 'borrador',   -- borrador | conciliada
  observaciones       TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conciliaciones_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_conciliaciones" ON conciliaciones_bancarias
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Items de conciliación (partidas conciliatorias)
CREATE TABLE conciliacion_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacion_id  UUID NOT NULL REFERENCES conciliaciones_bancarias(id) ON DELETE CASCADE,
  movimiento_id    UUID REFERENCES movimientos_bancarios(id),
  tipo             TEXT NOT NULL,    -- en_libros_no_banco | en_banco_no_libros | ajuste
  descripcion      TEXT NOT NULL,
  monto            DECIMAL(15,2) NOT NULL,
  conciliado       BOOLEAN DEFAULT FALSE
);

ALTER TABLE conciliacion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_conciliacion_items" ON conciliacion_items
  USING (conciliacion_id IN (
    SELECT id FROM conciliaciones_bancarias
    WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  ));

-- ──────────────────────────────────────────────────────────────
-- 3. RETENCIONES (Retefuente, ReteICA, ReteIVA)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE retenciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL,      -- retefuente | reteica | reteiva
  nombre           TEXT NOT NULL,      -- "Retefuente Compras 2.5%"
  porcentaje       DECIMAL(5,2) NOT NULL,
  base_minima      DECIMAL(15,2) DEFAULT 0,  -- base mínima en UVT o pesos
  base_uvt         DECIMAL(10,2),            -- base en UVT (se convierte a pesos)
  cuenta_contable_id UUID REFERENCES cuentas_puc(id),
  aplica_a         TEXT DEFAULT 'compras',   -- compras | ventas | ambos
  activa           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_retenciones" ON retenciones
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Retenciones aplicadas en documentos
CREATE TABLE retenciones_aplicadas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  documento_id     UUID NOT NULL REFERENCES documentos(id),
  retencion_id     UUID NOT NULL REFERENCES retenciones(id),
  base_gravable    DECIMAL(15,2) NOT NULL,
  porcentaje       DECIMAL(5,2) NOT NULL,
  valor            DECIMAL(15,2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retenciones_aplicadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_retenciones_aplicadas" ON retenciones_aplicadas
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX idx_retenciones_empresa ON retenciones(empresa_id, tipo, activa);
CREATE INDEX idx_retenciones_aplicadas_doc ON retenciones_aplicadas(documento_id);

-- ──────────────────────────────────────────────────────────────
-- 4. PAGOS A PROVEEDORES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE pagos_proveedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero              INTEGER NOT NULL,
  proveedor_id        UUID NOT NULL REFERENCES proveedores(id),
  cuenta_bancaria_id  UUID REFERENCES cuentas_bancarias(id),
  forma_pago_id       UUID REFERENCES formas_pago(id),
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  monto_total         DECIMAL(15,2) NOT NULL,
  referencia          TEXT,                   -- ref de transferencia, cheque, etc.
  observaciones       TEXT,
  estado              TEXT DEFAULT 'pendiente', -- pendiente | pagado | anulado
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero)
);

ALTER TABLE pagos_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_pagos_proveedores" ON pagos_proveedores
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Detalle: qué facturas se están pagando
CREATE TABLE pagos_proveedores_detalle (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id          UUID NOT NULL REFERENCES pagos_proveedores(id) ON DELETE CASCADE,
  documento_id     UUID NOT NULL REFERENCES documentos(id),   -- factura de compra
  monto_aplicado   DECIMAL(15,2) NOT NULL
);

ALTER TABLE pagos_proveedores_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_pagos_prov_detalle" ON pagos_proveedores_detalle
  USING (pago_id IN (
    SELECT id FROM pagos_proveedores
    WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  ));

CREATE INDEX idx_pagos_prov_empresa ON pagos_proveedores(empresa_id, fecha DESC);
CREATE INDEX idx_pagos_prov_proveedor ON pagos_proveedores(proveedor_id, estado);

-- ──────────────────────────────────────────────────────────────
-- 5. FUNCIÓN: REGISTRAR MOVIMIENTO BANCARIO
-- Actualiza saldo de la cuenta automáticamente
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_movimiento_bancario(
  p_cuenta_id UUID,
  p_tipo TEXT,
  p_concepto TEXT,
  p_monto DECIMAL,
  p_referencia TEXT DEFAULT NULL,
  p_descripcion TEXT DEFAULT NULL,
  p_documento_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_saldo DECIMAL(15,2);
  v_mov_id UUID;
BEGIN
  SELECT empresa_id, saldo_actual INTO v_empresa_id, v_saldo
  FROM cuentas_bancarias WHERE id = p_cuenta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta bancaria no encontrada'; END IF;

  -- Calcular nuevo saldo
  IF p_tipo = 'ingreso' THEN
    v_saldo := v_saldo + p_monto;
  ELSIF p_tipo IN ('egreso', 'transferencia') THEN
    v_saldo := v_saldo - p_monto;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;

  -- Insertar movimiento
  INSERT INTO movimientos_bancarios (
    empresa_id, cuenta_bancaria_id, tipo, concepto, monto,
    saldo_despues, referencia, descripcion, documento_id, created_by
  ) VALUES (
    v_empresa_id, p_cuenta_id, p_tipo, p_concepto, p_monto,
    v_saldo, p_referencia, p_descripcion, p_documento_id, auth.uid()
  ) RETURNING id INTO v_mov_id;

  -- Actualizar saldo de la cuenta
  UPDATE cuentas_bancarias SET saldo_actual = v_saldo WHERE id = p_cuenta_id;

  RETURN v_mov_id;
END;
$$;
