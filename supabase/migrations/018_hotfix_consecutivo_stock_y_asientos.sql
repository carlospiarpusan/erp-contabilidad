-- ============================================================
-- MIGRACIÓN 018 — HOTFIX CONSECUTIVO, STOCK Y ASIENTOS MASIVOS
-- Corrige:
-- 1) Ambigüedad de prefijo en siguiente_consecutivo.
-- 2) Duplicados con variante NULL en stock + notificación stock_bajo.
-- 3) Búsqueda de asientos de recibos usando recibo_id.
-- ============================================================

CREATE OR REPLACE FUNCTION siguiente_consecutivo(
  p_empresa_id UUID,
  p_tipo       TEXT
) RETURNS TABLE(numero INTEGER, prefijo TEXT, serie_id UUID) AS $$
DECLARE
  v_serie RECORD;
BEGIN
  SELECT c.id, c.prefijo, c.consecutivo_actual
  INTO v_serie
  FROM consecutivos c
  WHERE c.empresa_id = p_empresa_id
    AND c.tipo = p_tipo
    AND c.activo = TRUE
  ORDER BY c.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe serie de consecutivo para tipo: %', p_tipo;
  END IF;

  UPDATE consecutivos
  SET consecutivo_actual = consecutivo_actual + 1
  WHERE id = v_serie.id;

  RETURN QUERY SELECT
    (v_serie.consecutivo_actual + 1)::INTEGER,
    v_serie.prefijo,
    v_serie.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM productos WHERE id = p_producto_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_producto_id;
  END IF;

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

  IF v_stock_despues < 0 THEN
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


CREATE OR REPLACE FUNCTION generar_asientos_masivo(
  p_empresa_id UUID
) RETURNS TABLE(
  tipo        TEXT,
  documento   TEXT,
  asiento_id  UUID
) AS $$
DECLARE
  v_row     RECORD;
  v_asiento UUID;
BEGIN
  FOR v_row IN
    SELECT d.id, d.prefijo, d.numero
    FROM documentos d
    WHERE d.empresa_id = p_empresa_id
      AND d.tipo = 'factura_venta'
      AND d.estado != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id
          AND a.tipo_doc = 'factura_venta'
      )
    ORDER BY d.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_factura_venta(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'factura_venta'::TEXT, (v_row.prefijo || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error generando asiento para FV %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  FOR v_row IN
    SELECT r.id, r.numero
    FROM recibos r
    WHERE r.empresa_id = p_empresa_id
      AND r.tipo = 'venta'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.recibo_id = r.id
          AND a.tipo_doc = 'recibo_venta'
      )
    ORDER BY r.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_recibo_venta(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'recibo_venta'::TEXT, ('RC-' || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error generando asiento para RC %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  FOR v_row IN
    SELECT d.id, d.prefijo, d.numero
    FROM documentos d
    WHERE d.empresa_id = p_empresa_id
      AND d.tipo = 'factura_compra'
      AND d.estado != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id
          AND a.tipo_doc = 'factura_compra'
      )
    ORDER BY d.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_factura_compra(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'factura_compra'::TEXT, (v_row.prefijo || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error generando asiento para FC %: %', v_row.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION contar_sin_asiento(
  p_empresa_id UUID
) RETURNS TABLE(
  tipo        TEXT,
  pendientes  BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT 'facturas_venta'::TEXT,
           COUNT(*)::BIGINT
    FROM documentos d
    WHERE d.empresa_id = p_empresa_id
      AND d.tipo = 'factura_venta'
      AND d.estado != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id AND a.tipo_doc = 'factura_venta'
      );

  RETURN QUERY
    SELECT 'recibos_caja'::TEXT,
           COUNT(*)::BIGINT
    FROM recibos r
    WHERE r.empresa_id = p_empresa_id
      AND r.tipo = 'venta'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.recibo_id = r.id AND a.tipo_doc = 'recibo_venta'
      );

  RETURN QUERY
    SELECT 'facturas_compra'::TEXT,
           COUNT(*)::BIGINT
    FROM documentos d
    WHERE d.empresa_id = p_empresa_id
      AND d.tipo = 'factura_compra'
      AND d.estado != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id AND a.tipo_doc = 'factura_compra'
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
