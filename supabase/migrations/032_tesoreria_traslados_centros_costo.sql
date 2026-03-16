-- ============================================================
-- MIGRACIÓN 032 — TESORERÍA, TRASLADOS, CENTROS DE COSTO
-- Módulos nuevos para ERP robusto
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CENTROS DE COSTO
-- ──────────────────────────────────────────────────────────────
CREATE TABLE centros_costo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo      TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

ALTER TABLE centros_costo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_centros_costo" ON centros_costo
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Agregar centro_costo_id a documentos (opcional en cada transacción)
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS centro_costo_id UUID REFERENCES centros_costo(id);

-- ──────────────────────────────────────────────────────────────
-- 2. TESORERÍA — CAJAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE cajas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activa      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, nombre)
);

ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_cajas" ON cajas
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Apertura y cierre de caja
CREATE TABLE cajas_turnos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  caja_id         UUID NOT NULL REFERENCES cajas(id),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id),
  fecha_apertura  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre    TIMESTAMPTZ,
  saldo_apertura  DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_cierre    DECIMAL(15,2),
  saldo_sistema   DECIMAL(15,2),  -- calculado por el sistema
  diferencia      DECIMAL(15,2),  -- saldo_cierre - saldo_sistema
  estado          TEXT DEFAULT 'abierto', -- abierto | cerrado
  observaciones   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cajas_turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_cajas_turnos" ON cajas_turnos
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX idx_cajas_turnos_estado ON cajas_turnos(empresa_id, estado, fecha_apertura DESC);

-- Movimientos de caja (ingresos/egresos)
CREATE TABLE cajas_movimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  turno_id      UUID NOT NULL REFERENCES cajas_turnos(id),
  tipo          TEXT NOT NULL, -- ingreso | egreso
  concepto      TEXT NOT NULL, -- venta | recibo | gasto | retiro | abono_inicial | otro
  monto         DECIMAL(15,2) NOT NULL,
  documento_id  UUID REFERENCES documentos(id),
  descripcion   TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cajas_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_cajas_movimientos" ON cajas_movimientos
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX idx_cajas_mov_turno ON cajas_movimientos(turno_id, created_at);

-- ──────────────────────────────────────────────────────────────
-- 3. TRASLADOS ENTRE BODEGAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE traslados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  bodega_origen_id  UUID NOT NULL REFERENCES bodegas(id),
  bodega_destino_id UUID NOT NULL REFERENCES bodegas(id),
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  estado            TEXT DEFAULT 'pendiente', -- pendiente | completado | cancelado
  observaciones     TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero),
  CHECK (bodega_origen_id <> bodega_destino_id)
);

CREATE TABLE traslados_lineas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traslado_id   UUID NOT NULL REFERENCES traslados(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos(id),
  cantidad      DECIMAL(15,3) NOT NULL CHECK (cantidad > 0)
);

ALTER TABLE traslados ENABLE ROW LEVEL SECURITY;
ALTER TABLE traslados_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_traslados" ON traslados
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "tenant_traslados_lineas" ON traslados_lineas
  USING (traslado_id IN (SELECT id FROM traslados WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "insert_traslados_lineas" ON traslados_lineas
  FOR INSERT WITH CHECK (traslado_id IN (SELECT id FROM traslados WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE INDEX idx_traslados_empresa ON traslados(empresa_id, fecha DESC);

-- ──────────────────────────────────────────────────────────────
-- 4. FUNCIÓN: EJECUTAR TRASLADO
-- Mueve stock de bodega origen a destino y registra movimientos
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ejecutar_traslado(p_traslado_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_traslado   RECORD;
  v_linea      RECORD;
  v_stock_orig DECIMAL(15,3);
  v_stock_dest DECIMAL(15,3);
  v_empresa_id UUID;
BEGIN
  -- Obtener traslado
  SELECT * INTO v_traslado FROM traslados WHERE id = p_traslado_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Traslado no encontrado'; END IF;
  IF v_traslado.estado <> 'pendiente' THEN RAISE EXCEPTION 'El traslado ya fue procesado'; END IF;

  v_empresa_id := v_traslado.empresa_id;

  -- Procesar cada línea
  FOR v_linea IN SELECT * FROM traslados_lineas WHERE traslado_id = p_traslado_id LOOP
    -- Verificar stock en origen
    SELECT COALESCE(cantidad, 0) INTO v_stock_orig
    FROM stock WHERE producto_id = v_linea.producto_id AND bodega_id = v_traslado.bodega_origen_id;

    IF v_stock_orig < v_linea.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente del producto % en bodega origen (disponible: %, solicitado: %)',
        v_linea.producto_id, v_stock_orig, v_linea.cantidad;
    END IF;

    -- Descontar de origen
    UPDATE stock SET cantidad = cantidad - v_linea.cantidad
    WHERE producto_id = v_linea.producto_id AND bodega_id = v_traslado.bodega_origen_id;

    -- Registrar movimiento salida
    INSERT INTO stock_movimientos (empresa_id, producto_id, bodega_id, tipo, cantidad, stock_antes, stock_despues, created_by)
    VALUES (v_empresa_id, v_linea.producto_id, v_traslado.bodega_origen_id, 'traslado_salida',
            -v_linea.cantidad, v_stock_orig, v_stock_orig - v_linea.cantidad, auth.uid());

    -- Agregar a destino (upsert)
    SELECT COALESCE(cantidad, 0) INTO v_stock_dest
    FROM stock WHERE producto_id = v_linea.producto_id AND bodega_id = v_traslado.bodega_destino_id;

    INSERT INTO stock (empresa_id, producto_id, bodega_id, cantidad)
    VALUES (v_empresa_id, v_linea.producto_id, v_traslado.bodega_destino_id, v_linea.cantidad)
    ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = stock.cantidad + EXCLUDED.cantidad;

    -- Registrar movimiento entrada
    INSERT INTO stock_movimientos (empresa_id, producto_id, bodega_id, tipo, cantidad, stock_antes, stock_despues, created_by)
    VALUES (v_empresa_id, v_linea.producto_id, v_traslado.bodega_destino_id, 'traslado_entrada',
            v_linea.cantidad, v_stock_dest, v_stock_dest + v_linea.cantidad, auth.uid());
  END LOOP;

  -- Marcar traslado completado
  UPDATE traslados SET estado = 'completado' WHERE id = p_traslado_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. FUNCIÓN: ABRIR TURNO DE CAJA
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION abrir_turno_caja(p_caja_id UUID, p_saldo_apertura DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_turno_id   UUID;
  v_abierto    BOOLEAN;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM cajas WHERE id = p_caja_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caja no encontrada'; END IF;

  -- Verificar que no haya un turno abierto en esta caja
  SELECT EXISTS(SELECT 1 FROM cajas_turnos WHERE caja_id = p_caja_id AND estado = 'abierto') INTO v_abierto;
  IF v_abierto THEN RAISE EXCEPTION 'Ya hay un turno abierto en esta caja'; END IF;

  INSERT INTO cajas_turnos (empresa_id, caja_id, usuario_id, saldo_apertura)
  VALUES (v_empresa_id, p_caja_id, auth.uid(), p_saldo_apertura)
  RETURNING id INTO v_turno_id;

  -- Registrar movimiento de apertura
  INSERT INTO cajas_movimientos (empresa_id, turno_id, tipo, concepto, monto, descripcion, created_by)
  VALUES (v_empresa_id, v_turno_id, 'ingreso', 'abono_inicial', p_saldo_apertura, 'Saldo de apertura', auth.uid());

  RETURN v_turno_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 6. FUNCIÓN: CERRAR TURNO DE CAJA
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cerrar_turno_caja(p_turno_id UUID, p_saldo_cierre DECIMAL, p_observaciones TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_turno       RECORD;
  v_saldo_calc  DECIMAL(15,2);
BEGIN
  SELECT * INTO v_turno FROM cajas_turnos WHERE id = p_turno_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno ya está cerrado'; END IF;

  -- Calcular saldo del sistema
  SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0)
  INTO v_saldo_calc
  FROM cajas_movimientos
  WHERE turno_id = p_turno_id;

  UPDATE cajas_turnos SET
    estado = 'cerrado',
    fecha_cierre = NOW(),
    saldo_cierre = p_saldo_cierre,
    saldo_sistema = v_saldo_calc,
    diferencia = p_saldo_cierre - v_saldo_calc,
    observaciones = p_observaciones
  WHERE id = p_turno_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 7. RPC: KARDEX — consultar movimientos de un producto
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kardex_producto(
  p_producto_id UUID,
  p_bodega_id UUID DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  fecha TIMESTAMPTZ,
  tipo TEXT,
  bodega_nombre TEXT,
  documento_numero TEXT,
  cantidad DECIMAL,
  stock_antes DECIMAL,
  stock_despues DECIMAL,
  precio_costo DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.created_at AS fecha,
    sm.tipo,
    b.nombre AS bodega_nombre,
    CASE
      WHEN d.id IS NOT NULL THEN COALESCE(d.prefijo, '') || d.numero::TEXT
      ELSE NULL
    END AS documento_numero,
    sm.cantidad,
    sm.stock_antes,
    sm.stock_despues,
    sm.precio_costo
  FROM stock_movimientos sm
  JOIN bodegas b ON b.id = sm.bodega_id
  LEFT JOIN documentos d ON d.id = sm.documento_id
  WHERE sm.producto_id = p_producto_id
    AND sm.empresa_id IN (SELECT empresa_id FROM usuarios WHERE usuarios.id = auth.uid())
    AND (p_bodega_id IS NULL OR sm.bodega_id = p_bodega_id)
    AND (p_desde IS NULL OR sm.created_at >= p_desde::TIMESTAMPTZ)
    AND (p_hasta IS NULL OR sm.created_at < (p_hasta + INTERVAL '1 day')::TIMESTAMPTZ)
  ORDER BY sm.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 8. Notas y número secuencial para traslados
-- ──────────────────────────────────────────────────────────────
ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS notas TEXT;
