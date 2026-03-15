-- ============================================================
-- MIGRACIÓN 030 — VENTA SIN STOCK + ESTADO FACTURA AUTOMÁTICO
-- 1. Agrega permite_venta_sin_stock a bodegas
-- 2. actualizar_stock respeta el flag
-- 3. crear_factura_venta marca 'pagada' si forma_pago.tipo = 'contado'
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. COLUMNA permite_venta_sin_stock EN BODEGAS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE bodegas ADD COLUMN IF NOT EXISTS permite_venta_sin_stock BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- 2. ACTUALIZAR_STOCK — respeta permite_venta_sin_stock
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_stock(
  p_producto_id  UUID,
  p_variante_id  UUID,
  p_bodega_id    UUID,
  p_cantidad     DECIMAL,
  p_tipo         TEXT,
  p_documento_id UUID,
  p_precio_costo DECIMAL DEFAULT 0,
  p_numero_lote  TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_stock_antes DECIMAL := 0;
  v_stock_despues DECIMAL;
  v_empresa_id UUID;
  v_stock_id UUID;
  v_stock_extra_ids UUID[] := ARRAY[]::UUID[];
  v_stock_row RECORD;
  v_cantidad_minima DECIMAL := 0;
  v_permite_sin_stock BOOLEAN := FALSE;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM productos WHERE id = p_producto_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_producto_id;
  END IF;

  -- Verificar si la bodega permite venta sin stock
  SELECT COALESCE(b.permite_venta_sin_stock, FALSE)
  INTO v_permite_sin_stock
  FROM bodegas b
  WHERE b.id = p_bodega_id;

  IF p_variante_id IS NULL THEN
    INSERT INTO stock (producto_id, variante_id, bodega_id, cantidad)
    SELECT p_producto_id, NULL, p_bodega_id, 0
    WHERE NOT EXISTS (
      SELECT 1
      FROM stock s
      WHERE s.producto_id = p_producto_id
        AND s.variante_id IS NULL
        AND s.bodega_id = p_bodega_id
    );
  ELSE
    INSERT INTO stock (producto_id, variante_id, bodega_id, cantidad)
    VALUES (p_producto_id, p_variante_id, p_bodega_id, 0)
    ON CONFLICT (producto_id, variante_id, bodega_id) DO NOTHING;
  END IF;

  FOR v_stock_row IN
    SELECT s.id, s.cantidad, s.cantidad_minima
    FROM stock s
    WHERE s.producto_id = p_producto_id
      AND (s.variante_id = p_variante_id OR (s.variante_id IS NULL AND p_variante_id IS NULL))
      AND s.bodega_id = p_bodega_id
    ORDER BY s.updated_at NULLS LAST, s.id
    FOR UPDATE
  LOOP
    v_stock_antes := v_stock_antes + COALESCE(v_stock_row.cantidad, 0);
    v_cantidad_minima := GREATEST(v_cantidad_minima, COALESCE(v_stock_row.cantidad_minima, 0));

    IF v_stock_id IS NULL THEN
      v_stock_id := v_stock_row.id;
    ELSE
      v_stock_extra_ids := array_append(v_stock_extra_ids, v_stock_row.id);
    END IF;
  END LOOP;

  IF v_stock_id IS NULL THEN
    INSERT INTO stock (producto_id, variante_id, bodega_id, cantidad)
    VALUES (p_producto_id, p_variante_id, p_bodega_id, 0)
    RETURNING id INTO v_stock_id;
  END IF;

  v_stock_despues := v_stock_antes + p_cantidad;

  -- Validar stock suficiente en salidas (saltar si bodega permite venta sin stock)
  IF v_stock_despues < 0 AND NOT v_permite_sin_stock THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
      v_stock_antes, ABS(p_cantidad);
  END IF;

  UPDATE stock
  SET
    cantidad = v_stock_despues,
    cantidad_minima = GREATEST(cantidad_minima, v_cantidad_minima),
    updated_at = NOW()
  WHERE id = v_stock_id;

  IF array_length(v_stock_extra_ids, 1) IS NOT NULL THEN
    DELETE FROM stock WHERE id = ANY(v_stock_extra_ids);
  END IF;

  INSERT INTO stock_movimientos (
    empresa_id, producto_id, variante_id, bodega_id,
    tipo, documento_id, cantidad, stock_antes, stock_despues,
    precio_costo, numero_lote, created_by
  ) VALUES (
    v_empresa_id, p_producto_id, p_variante_id, p_bodega_id,
    p_tipo, p_documento_id, p_cantidad, v_stock_antes, v_stock_despues,
    p_precio_costo, p_numero_lote, auth.uid()
  );

  IF v_cantidad_minima > 0 AND v_stock_despues <= v_cantidad_minima THEN
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
-- 3. CREAR_FACTURA_VENTA — estado según forma de pago
--    contado → 'pagada', credito/sistecredito → 'pendiente'
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_factura_venta(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_serie_tipo    TEXT,
  p_cliente_id    UUID,
  p_bodega_id     UUID,
  p_forma_pago_id UUID,
  p_colaborador_id UUID,
  p_fecha         DATE,
  p_vencimiento   DATE,
  p_observaciones TEXT,
  p_lineas        JSONB
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
  v_fecha_vencimiento DATE;
  v_forma RECORD;
  v_estado TEXT;
BEGIN
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, p_serie_tipo);

  SELECT descripcion, tipo, dias_vencimiento
  INTO v_forma
  FROM formas_pago
  WHERE id = p_forma_pago_id;

  -- Determinar estado: contado → pagada, credito → pendiente
  IF v_forma.tipo = 'contado' THEN
    v_estado := 'pagada';
  ELSE
    v_estado := 'pendiente';
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_sub  := (v_linea->>'cantidad')::DECIMAL * (v_linea->>'precio_unitario')::DECIMAL;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;

    SELECT porcentaje INTO v_iva_pct
    FROM impuestos WHERE id = (v_linea->>'impuesto_id')::UUID;
    v_linea_iva  := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;

    v_subtotal   := v_subtotal + v_linea_sub;
    v_total_dcto := v_total_dcto + v_linea_dcto;
    v_total_iva  := v_total_iva + v_linea_iva;
    v_total      := v_total + v_linea_total;

    SELECT precio_compra INTO v_precio_costo
    FROM productos WHERE id = (v_linea->>'producto_id')::UUID;
    v_total_costo := v_total_costo + v_precio_costo * (v_linea->>'cantidad')::DECIMAL;
  END LOOP;

  IF public.forma_pago_es_sistecredito(p_forma_pago_id) THEN
    v_fecha_vencimiento := public.fecha_pago_sistecredito(p_fecha);
  ELSE
    v_fecha_vencimiento := COALESCE(
      p_vencimiento,
      CASE
        WHEN COALESCE(v_forma.dias_vencimiento, 0) > 0 THEN p_fecha + v_forma.dias_vencimiento
        ELSE NULL
      END
    );
  END IF;

  INSERT INTO documentos (
    empresa_id, tipo, numero, serie_id, prefijo,
    cliente_id, bodega_id, forma_pago_id, colaborador_id, ejercicio_id,
    fecha, fecha_vencimiento, subtotal, total_iva, total_descuento, total, total_costo,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'factura_venta', v_num, v_serie_id, v_prefijo,
    p_cliente_id, p_bodega_id, p_forma_pago_id, p_colaborador_id, p_ejercicio_id,
    p_fecha, v_fecha_vencimiento, v_subtotal, v_total_iva, v_total_dcto, v_total, v_total_costo,
    v_estado, p_observaciones, auth.uid()
  ) RETURNING id INTO v_doc_id;

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

  PERFORM generar_asiento_factura_venta(v_doc_id);

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.crear_factura_venta(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, DATE, DATE, TEXT, JSONB) SET search_path = public;
