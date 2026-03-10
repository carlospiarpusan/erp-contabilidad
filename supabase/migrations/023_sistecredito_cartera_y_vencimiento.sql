-- ============================================================
-- MIGRACIÓN 023 — SISTECRÉDITO: CARTERA Y VENCIMIENTO
-- ============================================================

CREATE OR REPLACE FUNCTION public.forma_pago_es_sistecredito(
  p_forma_pago_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_descripcion TEXT;
BEGIN
  IF p_forma_pago_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT fp.descripcion
  INTO v_descripcion
  FROM formas_pago fp
  WHERE fp.id = p_forma_pago_id;

  RETURN COALESCE(lower(unaccent(v_descripcion)) LIKE '%sistecredito%', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.forma_pago_es_sistecredito(UUID) SET search_path = public;

CREATE OR REPLACE FUNCTION public.fecha_pago_sistecredito(
  p_fecha DATE
) RETURNS DATE AS $$
BEGIN
  RETURN ((date_trunc('month', p_fecha)::date + INTERVAL '4 month')::date + 14);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER FUNCTION public.fecha_pago_sistecredito(DATE) SET search_path = public;

CREATE OR REPLACE FUNCTION public.obtener_cuenta_cobro_venta(
  p_empresa_id UUID,
  p_forma_pago_id UUID
) RETURNS UUID AS $$
DECLARE
  v_cuenta_id UUID;
BEGIN
  IF public.forma_pago_es_sistecredito(p_forma_pago_id) THEN
    SELECT fp.cuenta_id
    INTO v_cuenta_id
    FROM formas_pago fp
    WHERE fp.id = p_forma_pago_id;

    IF v_cuenta_id IS NOT NULL THEN
      RETURN v_cuenta_id;
    END IF;
  END IF;

  SELECT ce.cuenta_id
  INTO v_cuenta_id
  FROM cuentas_especiales ce
  WHERE ce.empresa_id = p_empresa_id
    AND ce.tipo = 'clientes';

  RETURN v_cuenta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.obtener_cuenta_cobro_venta(UUID, UUID) SET search_path = public;

CREATE OR REPLACE FUNCTION public.descripcion_cobro_venta(
  p_forma_pago_id UUID,
  p_es_recibo BOOLEAN DEFAULT FALSE
) RETURNS TEXT AS $$
BEGIN
  IF public.forma_pago_es_sistecredito(p_forma_pago_id) THEN
    IF p_es_recibo THEN
      RETURN 'Pago recibido de Sistecrédito';
    END IF;
    RETURN 'Cuenta por cobrar Sistecrédito';
  END IF;

  IF p_es_recibo THEN
    RETURN 'Pago recibido cliente';
  END IF;
  RETURN 'Cuentas por cobrar';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.descripcion_cobro_venta(UUID, BOOLEAN) SET search_path = public;

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
BEGIN
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, p_serie_tipo);

  SELECT descripcion, dias_vencimiento
  INTO v_forma
  FROM formas_pago
  WHERE id = p_forma_pago_id;

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
    'pendiente', p_observaciones, auth.uid()
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

CREATE OR REPLACE FUNCTION public.generar_asiento_factura_venta(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc          RECORD;
  v_asiento_id   UUID;
  v_num          INTEGER;
  v_cuenta_id    UUID;
  v_ejercicio_id UUID;
  v_desc_db      TEXT;
BEGIN
  SELECT d.*, c.prefijo AS serie_codigo, fp.descripcion AS forma_pago_descripcion
  INTO v_doc
  FROM documentos d
  LEFT JOIN consecutivos c ON c.id = d.serie_id
  LEFT JOIN formas_pago fp ON fp.id = d.forma_pago_id
  WHERE d.id = p_documento_id;

  v_ejercicio_id := public.resolver_ejercicio_contable(v_doc.empresa_id, v_doc.fecha, v_doc.ejercicio_id);
  IF v_ejercicio_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ejercicio contable para la factura %', p_documento_id;
  END IF;

  IF v_doc.ejercicio_id IS NULL THEN
    UPDATE documentos
    SET ejercicio_id = v_ejercicio_id,
        updated_at = NOW()
    WHERE id = p_documento_id;
  END IF;

  SELECT numero INTO v_num FROM siguiente_consecutivo(v_doc.empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    v_doc.empresa_id, v_ejercicio_id, v_num,
    'automatico', 'factura_venta', p_documento_id,
    'FV ' || v_doc.prefijo || v_doc.numero::TEXT || ' - ' ||
    COALESCE((SELECT razon_social FROM clientes WHERE id = v_doc.cliente_id), 'CONSUMIDOR'),
    v_doc.fecha, v_doc.total
  ) RETURNING id INTO v_asiento_id;

  v_cuenta_id := public.obtener_cuenta_cobro_venta(v_doc.empresa_id, v_doc.forma_pago_id);
  v_desc_db := public.descripcion_cobro_venta(v_doc.forma_pago_id, FALSE);

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_id, v_desc_db, v_doc.total, 0);

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  SELECT v_asiento_id, cuenta_id, 'Ingresos por ventas', 0, v_doc.subtotal
  FROM cuentas_especiales
  WHERE empresa_id = v_doc.empresa_id AND tipo = 'ingresos';

  IF v_doc.total_iva > 0 THEN
    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    SELECT v_asiento_id, cuenta_id, 'IVA Generado', 0, v_doc.total_iva
    FROM cuentas_especiales
    WHERE empresa_id = v_doc.empresa_id AND tipo = 'iva_ventas';
  END IF;

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.generar_asiento_factura_venta(UUID) SET search_path = public;

CREATE OR REPLACE FUNCTION public.generar_asiento_recibo_venta(
  p_recibo_id UUID
) RETURNS UUID AS $$
DECLARE
  v_recibo       RECORD;
  v_doc          RECORD;
  v_asiento_id   UUID;
  v_num          INTEGER;
  v_cuenta_db    UUID;
  v_cuenta_cr    UUID;
  v_ejercicio_id UUID;
BEGIN
  SELECT r.*, fp.tipo AS forma_tipo, fp.cuenta_id AS fp_cuenta_id
  INTO v_recibo
  FROM recibos r
  LEFT JOIN formas_pago fp ON fp.id = r.forma_pago_id
  WHERE r.id = p_recibo_id;

  SELECT * INTO v_doc FROM documentos WHERE id = v_recibo.documento_id;

  v_ejercicio_id := public.resolver_ejercicio_contable(v_recibo.empresa_id, v_recibo.fecha, v_recibo.ejercicio_id);
  IF v_ejercicio_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ejercicio contable para el recibo %', p_recibo_id;
  END IF;

  IF v_recibo.ejercicio_id IS NULL THEN
    UPDATE recibos
    SET ejercicio_id = v_ejercicio_id
    WHERE id = p_recibo_id;
  END IF;

  SELECT numero INTO v_num FROM siguiente_consecutivo(v_recibo.empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    recibo_id, concepto, fecha, importe
  ) VALUES (
    v_recibo.empresa_id, v_ejercicio_id, v_num,
    'automatico', 'recibo_venta', p_recibo_id,
    'RC ' || v_recibo.numero::TEXT || ' - Pago factura ' || v_doc.numero::TEXT,
    v_recibo.fecha, v_recibo.valor
  ) RETURNING id INTO v_asiento_id;

  v_cuenta_db := COALESCE(
    v_recibo.fp_cuenta_id,
    (SELECT cuenta_id FROM cuentas_especiales WHERE empresa_id = v_recibo.empresa_id AND tipo = 'caja')
  );

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_db, 'Recaudo efectivo/banco', v_recibo.valor, 0);

  v_cuenta_cr := public.obtener_cuenta_cobro_venta(v_recibo.empresa_id, v_doc.forma_pago_id);

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_cr, public.descripcion_cobro_venta(v_doc.forma_pago_id, TRUE), 0, v_recibo.valor);

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.generar_asiento_recibo_venta(UUID) SET search_path = public;

UPDATE documentos d
SET fecha_vencimiento = public.fecha_pago_sistecredito(d.fecha),
    estado = CASE
      WHEN d.estado = 'vencida' AND public.fecha_pago_sistecredito(d.fecha) >= CURRENT_DATE THEN 'pendiente'
      ELSE d.estado
    END,
    updated_at = NOW()
FROM formas_pago fp
WHERE d.forma_pago_id = fp.id
  AND d.tipo = 'factura_venta'
  AND public.forma_pago_es_sistecredito(fp.id)
  AND (
    d.fecha_vencimiento IS DISTINCT FROM public.fecha_pago_sistecredito(d.fecha)
    OR (d.estado = 'vencida' AND public.fecha_pago_sistecredito(d.fecha) >= CURRENT_DATE)
  );

UPDATE asientos_lineas al
SET cuenta_id = public.obtener_cuenta_cobro_venta(a.empresa_id, d.forma_pago_id),
    descripcion = public.descripcion_cobro_venta(d.forma_pago_id, FALSE)
FROM asientos a
JOIN documentos d ON d.id = a.documento_id
WHERE al.asiento_id = a.id
  AND a.tipo_doc = 'factura_venta'
  AND public.forma_pago_es_sistecredito(d.forma_pago_id)
  AND al.debe > 0;

UPDATE asientos_lineas al
SET cuenta_id = public.obtener_cuenta_cobro_venta(a.empresa_id, d.forma_pago_id),
    descripcion = public.descripcion_cobro_venta(d.forma_pago_id, TRUE)
FROM asientos a
JOIN recibos r ON r.id = a.recibo_id
JOIN documentos d ON d.id = r.documento_id
WHERE al.asiento_id = a.id
  AND a.tipo_doc = 'recibo_venta'
  AND public.forma_pago_es_sistecredito(d.forma_pago_id)
  AND al.haber > 0;
