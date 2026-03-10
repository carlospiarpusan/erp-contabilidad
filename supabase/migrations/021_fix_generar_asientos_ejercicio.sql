-- ============================================================
-- MIGRACIÓN 021 — FIX GENERACIÓN DE ASIENTOS SIN EJERCICIO
-- ============================================================
-- Corrige documentos/recibos históricos sin ejercicio_id y
-- hace que las funciones de asientos resuelvan el ejercicio
-- por fecha si viene nulo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolver_ejercicio_contable(
  p_empresa_id UUID,
  p_fecha DATE,
  p_ejercicio_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_ejercicio_id UUID;
BEGIN
  IF p_ejercicio_id IS NOT NULL THEN
    RETURN p_ejercicio_id;
  END IF;

  SELECT e.id
  INTO v_ejercicio_id
  FROM ejercicios e
  WHERE e.empresa_id = p_empresa_id
    AND p_fecha BETWEEN e.fecha_inicio AND e.fecha_fin
  ORDER BY (CASE WHEN e.estado = 'activo' THEN 0 ELSE 1 END), e.año DESC
  LIMIT 1;

  IF v_ejercicio_id IS NULL THEN
    SELECT e.id
    INTO v_ejercicio_id
    FROM ejercicios e
    WHERE e.empresa_id = p_empresa_id
    ORDER BY (CASE WHEN e.estado = 'activo' THEN 0 ELSE 1 END), e.año DESC
    LIMIT 1;
  END IF;

  RETURN v_ejercicio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.resolver_ejercicio_contable(UUID, DATE, UUID) SET search_path = public;

UPDATE documentos d
SET ejercicio_id = public.resolver_ejercicio_contable(d.empresa_id, d.fecha, d.ejercicio_id),
    updated_at = NOW()
WHERE d.ejercicio_id IS NULL
  AND d.tipo IN ('factura_venta', 'factura_compra');

UPDATE recibos r
SET ejercicio_id = public.resolver_ejercicio_contable(r.empresa_id, r.fecha, r.ejercicio_id)
WHERE r.ejercicio_id IS NULL;

CREATE OR REPLACE FUNCTION public.generar_asiento_factura_venta(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc          RECORD;
  v_asiento_id   UUID;
  v_num          INTEGER;
  v_cuenta       RECORD;
  v_ejercicio_id UUID;
BEGIN
  SELECT d.*, c.prefijo AS serie_codigo
  INTO v_doc
  FROM documentos d
  LEFT JOIN consecutivos c ON c.id = d.serie_id
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

  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'clientes';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Cuentas por cobrar', v_doc.total, 0);

  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'ingresos';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Ingresos por ventas', 0, v_doc.subtotal);

  IF v_doc.total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'iva_ventas';

    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA Generado', 0, v_doc.total_iva);
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

  SELECT cuenta_id INTO v_cuenta_cr
  FROM cuentas_especiales WHERE empresa_id = v_recibo.empresa_id AND tipo = 'clientes';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta_cr, 'Pago recibido cliente', 0, v_recibo.valor);

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.generar_asiento_recibo_venta(UUID) SET search_path = public;

CREATE OR REPLACE FUNCTION public.generar_asiento_factura_compra(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc          RECORD;
  v_asiento_id   UUID;
  v_num          INTEGER;
  v_cuenta       RECORD;
  v_ejercicio_id UUID;
BEGIN
  SELECT * INTO v_doc FROM documentos WHERE id = p_documento_id;

  v_ejercicio_id := public.resolver_ejercicio_contable(v_doc.empresa_id, v_doc.fecha, v_doc.ejercicio_id);
  IF v_ejercicio_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ejercicio contable para la compra %', p_documento_id;
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
    'automatico', 'factura_compra', p_documento_id,
    'FC ' || COALESCE(v_doc.numero_externo, v_doc.numero::TEXT) || ' - ' ||
    COALESCE((SELECT razon_social FROM proveedores WHERE id = v_doc.proveedor_id), ''),
    v_doc.fecha, v_doc.total
  ) RETURNING id INTO v_asiento_id;

  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'inventario';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Entrada de mercancía', v_doc.subtotal, 0);

  IF v_doc.total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'iva_compras';

    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA Descontable', v_doc.total_iva, 0);
  END IF;

  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = v_doc.empresa_id AND tipo = 'proveedores';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Deuda con proveedor', 0, v_doc.total);

  RETURN v_asiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.generar_asiento_factura_compra(UUID) SET search_path = public;
