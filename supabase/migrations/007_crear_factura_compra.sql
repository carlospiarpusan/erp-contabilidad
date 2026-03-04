-- ============================================================
-- MIGRACIÓN 007 — FACTURA DE COMPRA + PAGO PROVEEDOR
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CREAR FACTURA DE COMPRA (transacción atómica)
--    Consecutivo + Documento + Líneas + Stock (entrada) + Asiento
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_factura_compra(
  p_empresa_id     UUID,
  p_ejercicio_id   UUID,
  p_proveedor_id   UUID,
  p_bodega_id      UUID,
  p_fecha          DATE,
  p_numero_externo TEXT,
  p_observaciones  TEXT,
  p_lineas         JSONB
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
  v_linea       JSONB;
  v_linea_sub   DECIMAL;
  v_linea_dcto  DECIMAL;
  v_linea_iva   DECIMAL;
  v_linea_total DECIMAL;
  v_iva_pct     DECIMAL;
BEGIN
  -- 1. Consecutivo
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, 'factura_compra');

  -- 2. Pre-calcular totales
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_sub  := (v_linea->>'cantidad')::DECIMAL * (v_linea->>'precio_unitario')::DECIMAL;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;
    SELECT porcentaje INTO v_iva_pct
    FROM impuestos WHERE id = (v_linea->>'impuesto_id')::UUID;
    v_linea_iva   := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;
    v_subtotal   := v_subtotal + v_linea_sub;
    v_total_dcto := v_total_dcto + v_linea_dcto;
    v_total_iva  := v_total_iva + v_linea_iva;
    v_total      := v_total + v_linea_total;
  END LOOP;

  -- 3. Crear documento
  INSERT INTO documentos (
    empresa_id, tipo, numero, serie_id, prefijo,
    proveedor_id, bodega_id, ejercicio_id,
    fecha, numero_externo,
    subtotal, total_iva, total_descuento, total,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'factura_compra', v_num, v_serie_id, v_prefijo,
    p_proveedor_id, p_bodega_id, p_ejercicio_id,
    p_fecha, p_numero_externo,
    v_subtotal, v_total_iva, v_total_dcto, v_total,
    'pendiente', p_observaciones, auth.uid()
  ) RETURNING id INTO v_doc_id;

  -- 4. Líneas + stock entrada
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_sub  := (v_linea->>'cantidad')::DECIMAL * (v_linea->>'precio_unitario')::DECIMAL;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;
    SELECT porcentaje INTO v_iva_pct
    FROM impuestos WHERE id = (v_linea->>'impuesto_id')::UUID;
    v_linea_iva   := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;

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
      (v_linea->>'precio_unitario')::DECIMAL,
      COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0),
      (v_linea->>'impuesto_id')::UUID,
      v_linea_sub, v_linea_dcto, v_linea_iva, v_linea_total
    );

    -- Añadir stock (entrada positiva)
    PERFORM actualizar_stock(
      (v_linea->>'producto_id')::UUID,
      (v_linea->>'variante_id')::UUID,
      p_bodega_id,
      (v_linea->>'cantidad')::DECIMAL,
      'entrada_compra',
      v_doc_id,
      (v_linea->>'precio_unitario')::DECIMAL
    );

    -- Actualizar precio de compra del producto
    UPDATE productos
    SET precio_compra = (v_linea->>'precio_unitario')::DECIMAL, updated_at = NOW()
    WHERE id = (v_linea->>'producto_id')::UUID;
  END LOOP;

  -- 5. Asiento contable
  PERFORM generar_asiento_factura_compra(v_doc_id);

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 2. CREAR PAGO A PROVEEDOR (recibo compra + actualiza estado)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_pago_compra(
  p_empresa_id    UUID,
  p_documento_id  UUID,
  p_forma_pago_id UUID,
  p_ejercicio_id  UUID,
  p_valor         DECIMAL,
  p_fecha         DATE,
  p_observaciones TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_recibo_id      UUID;
  v_num            INTEGER;
  v_total_doc      DECIMAL;
  v_total_pagado   DECIMAL;
  v_asiento_id     UUID;
  v_num_asiento    INTEGER;
  v_cuenta_db      UUID;
  v_cuenta_cr      UUID;
BEGIN
  -- Consecutivo
  SELECT numero INTO v_num
  FROM siguiente_consecutivo(p_empresa_id, 'recibo_compra');

  -- Insertar recibo tipo compra
  INSERT INTO recibos (
    empresa_id, tipo, numero, documento_id,
    forma_pago_id, ejercicio_id, valor,
    fecha, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'compra', v_num, p_documento_id,
    p_forma_pago_id, p_ejercicio_id, p_valor,
    p_fecha, p_observaciones, auth.uid()
  ) RETURNING id INTO v_recibo_id;

  -- Asiento: DB Proveedores / CR Caja o Banco
  SELECT numero INTO v_num_asiento
  FROM siguiente_consecutivo(p_empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    recibo_id, concepto, fecha, importe
  ) VALUES (
    p_empresa_id, p_ejercicio_id, v_num_asiento,
    'automatico', 'recibo_compra', v_recibo_id,
    'Pago proveedor - Recibo ' || v_num::TEXT,
    p_fecha, p_valor
  ) RETURNING id INTO v_asiento_id;

  -- Cuenta de banco/caja según forma de pago
  SELECT COALESCE(fp.cuenta_id, ce.cuenta_id)
  INTO v_cuenta_cr
  FROM formas_pago fp
  LEFT JOIN cuentas_especiales ce ON ce.empresa_id = p_empresa_id AND ce.tipo = 'caja'
  WHERE fp.id = p_forma_pago_id;

  -- DB Proveedores
  SELECT cuenta_id INTO v_cuenta_db
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'proveedores';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES
    (v_asiento_id, v_cuenta_db, 'Pago a proveedor', p_valor, 0),
    (v_asiento_id, v_cuenta_cr, 'Salida caja/banco', 0, p_valor);

  -- Actualizar estado si está completamente pagado
  SELECT total INTO v_total_doc FROM documentos WHERE id = p_documento_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_total_pagado
  FROM recibos WHERE documento_id = p_documento_id;

  IF v_total_pagado >= v_total_doc THEN
    UPDATE documentos SET estado = 'pagada', updated_at = NOW()
    WHERE id = p_documento_id;
  END IF;

  RETURN v_recibo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
