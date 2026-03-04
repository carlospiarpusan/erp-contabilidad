-- ============================================================
-- MIGRACIÓN 005 — FUNCIONES DE NEGOCIO
-- Lógica contable y de inventario encapsulada en PostgreSQL
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CONSECUTIVO ATÓMICO
-- Obtiene y reserva el siguiente número de una serie
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION siguiente_consecutivo(
  p_empresa_id UUID,
  p_tipo       TEXT
) RETURNS TABLE(numero INTEGER, prefijo TEXT, serie_id UUID) AS $$
DECLARE
  v_serie RECORD;
BEGIN
  -- Bloquear la fila para evitar duplicados concurrentes
  SELECT id, prefijo, consecutivo_actual
  INTO v_serie
  FROM consecutivos
  WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND activo = TRUE
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe serie de consecutivo para tipo: %', p_tipo;
  END IF;

  -- Incrementar
  UPDATE consecutivos
  SET consecutivo_actual = consecutivo_actual + 1
  WHERE id = v_serie.id;

  RETURN QUERY SELECT
    (v_serie.consecutivo_actual + 1)::INTEGER,
    v_serie.prefijo,
    v_serie.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 2. ACTUALIZAR STOCK
-- Mueve cantidades entre documentos y registra el movimiento
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_stock(
  p_producto_id  UUID,
  p_variante_id  UUID,
  p_bodega_id    UUID,
  p_cantidad     DECIMAL, -- positivo=entrada, negativo=salida
  p_tipo         TEXT,
  p_documento_id UUID,
  p_precio_costo DECIMAL DEFAULT 0,
  p_numero_lote  TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_stock_antes DECIMAL;
  v_stock_despues DECIMAL;
  v_empresa_id UUID;
BEGIN
  -- Obtener empresa_id del producto
  SELECT empresa_id INTO v_empresa_id FROM productos WHERE id = p_producto_id;

  -- Obtener stock actual (crea registro si no existe)
  INSERT INTO stock (producto_id, variante_id, bodega_id, cantidad)
  VALUES (p_producto_id, p_variante_id, p_bodega_id, 0)
  ON CONFLICT (producto_id, variante_id, bodega_id) DO NOTHING;

  SELECT cantidad INTO v_stock_antes
  FROM stock
  WHERE producto_id = p_producto_id
    AND (variante_id = p_variante_id OR (variante_id IS NULL AND p_variante_id IS NULL))
    AND bodega_id = p_bodega_id
  FOR UPDATE;

  v_stock_despues := v_stock_antes + p_cantidad;

  -- Validar stock suficiente en salidas
  IF v_stock_despues < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
      v_stock_antes, ABS(p_cantidad);
  END IF;

  -- Actualizar stock
  UPDATE stock
  SET cantidad = v_stock_despues, updated_at = NOW()
  WHERE producto_id = p_producto_id
    AND (variante_id = p_variante_id OR (variante_id IS NULL AND p_variante_id IS NULL))
    AND bodega_id = p_bodega_id;

  -- Registrar movimiento (trazabilidad)
  INSERT INTO stock_movimientos (
    empresa_id, producto_id, variante_id, bodega_id,
    tipo, documento_id, cantidad, stock_antes, stock_despues,
    precio_costo, numero_lote, created_by
  ) VALUES (
    v_empresa_id, p_producto_id, p_variante_id, p_bodega_id,
    p_tipo, p_documento_id, p_cantidad, v_stock_antes, v_stock_despues,
    p_precio_costo, p_numero_lote, auth.uid()
  );

  -- Verificar si quedó por debajo del mínimo → crear notificación
  IF v_stock_despues <= (
    SELECT cantidad_minima FROM stock
    WHERE producto_id = p_producto_id AND bodega_id = p_bodega_id
  ) THEN
    INSERT INTO notificaciones (empresa_id, tipo, titulo, mensaje, datos)
    VALUES (
      v_empresa_id,
      'stock_bajo',
      'Stock bajo: ' || (SELECT descripcion FROM productos WHERE id = p_producto_id),
      'El producto tiene ' || v_stock_despues || ' unidades disponibles.',
      jsonb_build_object('producto_id', p_producto_id, 'bodega_id', p_bodega_id, 'cantidad', v_stock_despues)
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 3. GENERAR ASIENTO — FACTURA DE VENTA
-- DB Clientes / CR Ingresos + CR IVA
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generar_asiento_factura_venta(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc         RECORD;
  v_asiento_id  UUID;
  v_num         INTEGER;
  v_cuenta      RECORD;
BEGIN
  SELECT d.*, c.codigo AS serie_codigo
  INTO v_doc
  FROM documentos d
  LEFT JOIN consecutivos c ON c.id = d.serie_id
  WHERE d.id = p_documento_id;

  -- Número de asiento
  SELECT numero INTO v_num FROM siguiente_consecutivo(v_doc.empresa_id, 'asiento');

  -- Crear asiento cabecera
  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    v_doc.empresa_id, v_doc.ejercicio_id, v_num,
    'automatico', 'factura_venta', p_documento_id,
    'FV ' || v_doc.prefijo || v_doc.numero::TEXT || ' - ' ||
    COALESCE((SELECT razon_social FROM clientes WHERE id = v_doc.cliente_id), 'CONSUMIDOR'),
    v_doc.fecha, v_doc.total
  ) RETURNING id INTO v_asiento_id;

  -- DÉBITO: Clientes (Cuentas por cobrar)
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'clientes';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Cuentas por cobrar', v_doc.total, 0);

  -- CRÉDITO: Ingresos
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'ingresos';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Ingresos por ventas', 0, v_doc.subtotal);

  -- CRÉDITO: IVA (si aplica)
  IF v_doc.total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'iva_ventas';

    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA Generado', 0, v_doc.total_iva);
  END IF;

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 4. GENERAR ASIENTO — RECIBO DE CAJA (pago de factura)
-- DB Caja/Banco / CR Clientes
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generar_asiento_recibo_venta(
  p_recibo_id UUID
) RETURNS UUID AS $$
DECLARE
  v_recibo      RECORD;
  v_doc         RECORD;
  v_asiento_id  UUID;
  v_num         INTEGER;
  v_cuenta_db   UUID; -- caja o banco según forma de pago
  v_cuenta_cr   UUID; -- clientes
BEGIN
  SELECT r.*, fp.tipo AS forma_tipo, fp.cuenta_id AS fp_cuenta_id
  INTO v_recibo
  FROM recibos r
  LEFT JOIN formas_pago fp ON fp.id = r.forma_pago_id
  WHERE r.id = p_recibo_id;

  SELECT * INTO v_doc FROM documentos WHERE id = v_recibo.documento_id;

  SELECT numero INTO v_num FROM siguiente_consecutivo(v_recibo.empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    recibo_id, concepto, fecha, importe
  ) VALUES (
    v_recibo.empresa_id, v_recibo.ejercicio_id, v_num,
    'automatico', 'recibo_venta', p_recibo_id,
    'RC ' || v_recibo.numero::TEXT || ' - Pago factura ' || v_doc.numero::TEXT,
    v_recibo.fecha, v_recibo.valor
  ) RETURNING id INTO v_asiento_id;

  -- Cuenta DÉBITO: caja o banco (según cuenta de la forma de pago)
  v_cuenta_db := COALESCE(
    v_recibo.fp_cuenta_id,
    (SELECT cuenta_id FROM cuentas_especiales WHERE empresa_id = v_recibo.empresa_id AND tipo = 'caja')
  );

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_db, 'Recaudo efectivo/banco', v_recibo.valor, 0);

  -- CRÉDITO: Clientes
  SELECT cuenta_id INTO v_cuenta_cr
  FROM cuentas_especiales WHERE empresa_id = v_recibo.empresa_id AND tipo = 'clientes';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_cr, 'Pago recibido cliente', 0, v_recibo.valor);

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 5. GENERAR ASIENTO — FACTURA DE COMPRA
-- DB Inventario + DB IVA / CR Proveedores
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generar_asiento_factura_compra(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc         RECORD;
  v_asiento_id  UUID;
  v_num         INTEGER;
  v_cuenta      RECORD;
BEGIN
  SELECT * INTO v_doc FROM documentos WHERE id = p_documento_id;

  SELECT numero INTO v_num FROM siguiente_consecutivo(v_doc.empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    v_doc.empresa_id, v_doc.ejercicio_id, v_num,
    'automatico', 'factura_compra', p_documento_id,
    'FC ' || COALESCE(v_doc.numero_externo, v_doc.numero::TEXT) || ' - ' ||
    COALESCE((SELECT razon_social FROM proveedores WHERE id = v_doc.proveedor_id), ''),
    v_doc.fecha, v_doc.total
  ) RETURNING id INTO v_asiento_id;

  -- DÉBITO: Inventario (mercancía)
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'inventario';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Entrada de mercancía', v_doc.subtotal, 0);

  -- DÉBITO: IVA descontable
  IF v_doc.total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'iva_compras';

    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA Descontable', v_doc.total_iva, 0);
  END IF;

  -- CRÉDITO: Proveedores
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'proveedores';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Deuda con proveedor', 0, v_doc.total);

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 6. CREAR FACTURA VENTA COMPLETA (transacción atómica)
-- Llama a todo lo anterior en una sola operación
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_factura_venta(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_serie_tipo    TEXT,       -- 'factura_venta' | 'pos'
  p_cliente_id    UUID,
  p_bodega_id     UUID,
  p_forma_pago_id UUID,
  p_colaborador_id UUID,
  p_fecha         DATE,
  p_vencimiento   DATE,
  p_observaciones TEXT,
  p_lineas        JSONB       -- [{producto_id, variante_id, cantidad, precio, descuento, impuesto_id}]
) RETURNS UUID AS $$
DECLARE
  v_doc_id      UUID;
  v_num         INTEGER;
  v_prefijo     TEXT;
  v_serie_id    UUID;
  v_subtotal    DECIMAL := 0;
  v_total_iva   DECIMAL := 0;
  v_total_dcto  DECIMAL := 0;
  v_total       DECIMAL := 0;
  v_total_costo DECIMAL := 0;
  v_linea       JSONB;
  v_linea_sub   DECIMAL;
  v_linea_dcto  DECIMAL;
  v_linea_iva   DECIMAL;
  v_linea_total DECIMAL;
  v_iva_pct     DECIMAL;
  v_precio_costo DECIMAL;
  v_producto    RECORD;
BEGIN
  -- 1. Obtener consecutivo
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, p_serie_tipo);

  -- 2. Pre-calcular totales de las líneas
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_sub  := (v_linea->>'cantidad')::DECIMAL * (v_linea->>'precio_unitario')::DECIMAL;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;

    -- IVA
    SELECT porcentaje INTO v_iva_pct
    FROM impuestos WHERE id = (v_linea->>'impuesto_id')::UUID;
    v_linea_iva  := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;

    v_subtotal   := v_subtotal + v_linea_sub;
    v_total_dcto := v_total_dcto + v_linea_dcto;
    v_total_iva  := v_total_iva + v_linea_iva;
    v_total      := v_total + v_linea_total;

    -- Costo
    SELECT precio_compra INTO v_precio_costo
    FROM productos WHERE id = (v_linea->>'producto_id')::UUID;
    v_total_costo := v_total_costo + v_precio_costo * (v_linea->>'cantidad')::DECIMAL;
  END LOOP;

  -- 3. Crear documento cabecera
  INSERT INTO documentos (
    empresa_id, tipo, numero, serie_id, prefijo,
    cliente_id, bodega_id, forma_pago_id, colaborador_id, ejercicio_id,
    fecha, fecha_vencimiento, subtotal, total_iva, total_descuento, total, total_costo,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'factura_venta', v_num, v_serie_id, v_prefijo,
    p_cliente_id, p_bodega_id, p_forma_pago_id, p_colaborador_id, p_ejercicio_id,
    p_fecha, p_vencimiento, v_subtotal, v_total_iva, v_total_dcto, v_total, v_total_costo,
    'pendiente', p_observaciones, auth.uid()
  ) RETURNING id INTO v_doc_id;

  -- 4. Crear líneas + mover stock
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_sub  := (v_linea->>'cantidad')::DECIMAL * (v_linea->>'precio_unitario')::DECIMAL;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;

    SELECT porcentaje INTO v_iva_pct
    FROM impuestos WHERE id = (v_linea->>'impuesto_id')::UUID;
    v_linea_iva  := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;

    SELECT precio_compra INTO v_precio_costo
    FROM productos WHERE id = (v_linea->>'producto_id')::UUID;

    INSERT INTO documentos_lineas (
      documento_id, producto_id, variante_id, descripcion,
      cantidad, precio_unitario, precio_costo, descuento_porcentaje,
      impuesto_id, subtotal, total_descuento, total_iva, total
    ) VALUES (
      v_doc_id,
      (v_linea->>'producto_id')::UUID,
      (v_linea->>'variante_id')::UUID,
      v_linea->>'descripcion',
      (v_linea->>'cantidad')::DECIMAL,
      (v_linea->>'precio_unitario')::DECIMAL,
      v_precio_costo,
      COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0),
      (v_linea->>'impuesto_id')::UUID,
      v_linea_sub, v_linea_dcto, v_linea_iva, v_linea_total
    );

    -- Descontar stock
    PERFORM actualizar_stock(
      (v_linea->>'producto_id')::UUID,
      (v_linea->>'variante_id')::UUID,
      p_bodega_id,
      -(v_linea->>'cantidad')::DECIMAL,
      'salida_venta',
      v_doc_id,
      v_precio_costo
    );
  END LOOP;

  -- 5. Generar asiento contable
  PERFORM generar_asiento_factura_venta(v_doc_id);

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 7. KPIs DEL DASHBOARD (función de lectura rápida)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_kpis_dashboard(
  p_empresa_id UUID,
  p_año        INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'facturas_activas', COUNT(*) FILTER (WHERE estado = 'pendiente'),
    'total_facturado',  COALESCE(SUM(total), 0),
    'costos_ventas',    COALESCE(SUM(total_costo), 0),
    'ganancias',        COALESCE(SUM(total) - SUM(total_costo), 0),
    'margen_porcentaje',
      CASE WHEN SUM(total) > 0
        THEN ROUND(((SUM(total) - SUM(total_costo)) / SUM(total) * 100)::NUMERIC, 2)
        ELSE 0
      END
  ) INTO v_result
  FROM documentos
  WHERE empresa_id = p_empresa_id
    AND tipo = 'factura_venta'
    AND estado != 'cancelada'
    AND EXTRACT(YEAR FROM fecha) = p_año;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 8. RESUMEN MENSUAL (para estadísticas)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_resumen_mensual(
  p_empresa_id UUID,
  p_año        INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
) RETURNS TABLE(
  mes INTEGER, ventas DECIMAL, compras DECIMAL,
  costos DECIMAL, gastos DECIMAL, ganancias DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH meses AS (SELECT generate_series(1, 12) AS mes),
  ventas_mes AS (
    SELECT EXTRACT(MONTH FROM fecha)::INTEGER AS mes,
           SUM(total) AS total, SUM(total_costo) AS costo
    FROM documentos
    WHERE empresa_id = p_empresa_id AND tipo = 'factura_venta'
      AND estado != 'cancelada' AND EXTRACT(YEAR FROM fecha) = p_año
    GROUP BY 1
  ),
  compras_mes AS (
    SELECT EXTRACT(MONTH FROM fecha)::INTEGER AS mes, SUM(total) AS total
    FROM documentos
    WHERE empresa_id = p_empresa_id AND tipo = 'factura_compra'
      AND estado != 'cancelada' AND EXTRACT(YEAR FROM fecha) = p_año
    GROUP BY 1
  ),
  gastos_mes AS (
    SELECT EXTRACT(MONTH FROM fecha)::INTEGER AS mes, SUM(total) AS total
    FROM documentos
    WHERE empresa_id = p_empresa_id AND tipo = 'gasto'
      AND EXTRACT(YEAR FROM fecha) = p_año
    GROUP BY 1
  )
  SELECT
    m.mes,
    COALESCE(v.total, 0)   AS ventas,
    COALESCE(c.total, 0)   AS compras,
    COALESCE(v.costo, 0)   AS costos,
    COALESCE(g.total, 0)   AS gastos,
    COALESCE(v.total, 0) - COALESCE(v.costo, 0) - COALESCE(g.total, 0) AS ganancias
  FROM meses m
  LEFT JOIN ventas_mes v ON v.mes = m.mes
  LEFT JOIN compras_mes c ON c.mes = m.mes
  LEFT JOIN gastos_mes  g ON g.mes = m.mes
  ORDER BY m.mes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
