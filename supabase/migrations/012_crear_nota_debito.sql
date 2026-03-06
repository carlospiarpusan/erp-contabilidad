-- ============================================================
-- MIGRACIÓN 012 — NOTA DÉBITO
-- ============================================================
-- La nota débito aumenta la deuda del cliente (ajuste de precio
-- hacia arriba, recargos, intereses, etc.).
-- No mueve stock. Genera asiento: DB Clientes / CR Ingresos + CR IVA.
-- ============================================================

CREATE OR REPLACE FUNCTION crear_nota_debito(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_cliente_id    UUID,
  p_factura_id    UUID,    -- puede ser NULL (nota débito libre)
  p_motivo        TEXT,
  p_lineas        JSONB    -- array de {descripcion, cantidad, precio_unitario, impuesto_id, descuento_porcentaje}
) RETURNS UUID AS $$
DECLARE
  v_doc_id        UUID;
  v_num           INTEGER;
  v_prefijo       TEXT;
  v_serie_id      UUID;
  v_asiento_id    UUID;
  v_asiento_num   INTEGER;
  v_subtotal      DECIMAL := 0;
  v_total_iva     DECIMAL := 0;
  v_total         DECIMAL := 0;
  v_item          JSONB;
  v_precio        DECIMAL;
  v_cant          DECIMAL;
  v_dcto          DECIMAL;
  v_imp_pct       DECIMAL;
  v_sub_linea     DECIMAL;
  v_iva_linea     DECIMAL;
  v_total_linea   DECIMAL;
  v_cuenta        RECORD;
BEGIN
  -- 1. Calcular totales de las líneas
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_precio := (v_item->>'precio_unitario')::DECIMAL;
    v_cant   := COALESCE((v_item->>'cantidad')::DECIMAL, 1);
    v_dcto   := COALESCE((v_item->>'descuento_porcentaje')::DECIMAL, 0);
    v_imp_pct := 0;

    IF v_item->>'impuesto_id' IS NOT NULL THEN
      SELECT porcentaje INTO v_imp_pct
      FROM impuestos WHERE id = (v_item->>'impuesto_id')::UUID;
    END IF;

    v_sub_linea   := ROUND(v_precio * v_cant * (1 - v_dcto / 100), 2);
    v_iva_linea   := ROUND(v_sub_linea * v_imp_pct / 100, 2);
    v_total_linea := v_sub_linea + v_iva_linea;

    v_subtotal    := v_subtotal  + v_sub_linea;
    v_total_iva   := v_total_iva + v_iva_linea;
    v_total       := v_total     + v_total_linea;
  END LOOP;

  -- 2. Obtener consecutivo para nota_debito
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, 'nota_debito');

  -- 3. Crear documento nota_debito
  INSERT INTO documentos (
    empresa_id, ejercicio_id, tipo, numero, prefijo, serie_id,
    cliente_id, forma_pago_id,
    fecha, fecha_vencimiento,
    subtotal, total_iva, total_descuento, total, total_costo,
    estado, observaciones,
    documento_origen_id, motivo
  ) VALUES (
    p_empresa_id, p_ejercicio_id, 'nota_debito', v_num, v_prefijo, v_serie_id,
    p_cliente_id, NULL,
    CURRENT_DATE, CURRENT_DATE,
    v_subtotal, v_total_iva, 0, v_total, 0,
    'pagada', p_motivo,
    p_factura_id, p_motivo
  ) RETURNING id INTO v_doc_id;

  -- 4. Insertar líneas
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_precio  := (v_item->>'precio_unitario')::DECIMAL;
    v_cant    := COALESCE((v_item->>'cantidad')::DECIMAL, 1);
    v_dcto    := COALESCE((v_item->>'descuento_porcentaje')::DECIMAL, 0);
    v_imp_pct := 0;

    IF v_item->>'impuesto_id' IS NOT NULL THEN
      SELECT porcentaje INTO v_imp_pct
      FROM impuestos WHERE id = (v_item->>'impuesto_id')::UUID;
    END IF;

    v_sub_linea   := ROUND(v_precio * v_cant * (1 - v_dcto / 100), 2);
    v_iva_linea   := ROUND(v_sub_linea * v_imp_pct / 100, 2);
    v_total_linea := v_sub_linea + v_iva_linea;

    INSERT INTO documentos_lineas (
      documento_id, descripcion, cantidad,
      precio_unitario, precio_costo, descuento_porcentaje, impuesto_id,
      subtotal, total_descuento, total_iva, total
    ) VALUES (
      v_doc_id,
      v_item->>'descripcion',
      v_cant, v_precio, 0, v_dcto,
      CASE WHEN v_item->>'impuesto_id' IS NOT NULL THEN (v_item->>'impuesto_id')::UUID ELSE NULL END,
      v_sub_linea, 0, v_iva_linea, v_total_linea
    );
  END LOOP;

  -- 5. Generar asiento contable
  --    DB Clientes / CR Ingresos + CR IVA
  SELECT numero INTO v_asiento_num
  FROM siguiente_consecutivo(p_empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    p_empresa_id, p_ejercicio_id, v_asiento_num,
    'automatico', 'nota_debito', v_doc_id,
    'ND ' || v_prefijo || v_num::TEXT || ' - Ajuste de cargo',
    CURRENT_DATE, v_total
  ) RETURNING id INTO v_asiento_id;

  -- DÉBITO: Clientes (aumenta la cartera)
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'clientes';
  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Cargo adicional cliente', v_total, 0);

  -- CRÉDITO: Ingresos
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'ingresos';
  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Ingreso por ajuste ND', 0, v_subtotal);

  -- CRÉDITO: IVA (si aplica)
  IF v_total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'iva_ventas';
    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA nota débito', 0, v_total_iva);
  END IF;

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
