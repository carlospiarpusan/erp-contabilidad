-- ============================================================
-- MIGRACIÓN 008 — GASTOS
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CREAR GASTO (documento tipo='gasto')
--    Consecutivo + Documento + Asiento contable
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_gasto(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_acreedor_id   UUID,        -- puede ser NULL (gasto directo)
  p_tipo_gasto_id UUID,        -- categoria del gasto
  p_forma_pago_id UUID,        -- caja/banco que debita
  p_fecha         DATE,
  p_descripcion   TEXT,
  p_valor         DECIMAL,
  p_observaciones TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_doc_id       UUID;
  v_num          INTEGER;
  v_prefijo      TEXT;
  v_serie_id     UUID;
  v_asiento_id   UUID;
  v_num_asiento  INTEGER;
  v_cuenta_gasto UUID;
  v_cuenta_pago  UUID;
BEGIN
  -- 1. Consecutivo gasto
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, 'gasto');

  -- 2. Crear documento
  INSERT INTO documentos (
    empresa_id, tipo, numero, serie_id, prefijo,
    acreedor_id, ejercicio_id, forma_pago_id,
    fecha, subtotal, total_iva, total_descuento, total,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'gasto', v_num, v_serie_id, v_prefijo,
    p_acreedor_id, p_ejercicio_id, p_forma_pago_id,
    p_fecha, p_valor, 0, 0, p_valor,
    'pagado', p_observaciones, auth.uid()
  ) RETURNING id INTO v_doc_id;

  -- 3. Línea del gasto
  INSERT INTO documentos_lineas (
    documento_id, descripcion,
    cantidad, precio_unitario, precio_costo,
    descuento_porcentaje, subtotal, total_descuento, total_iva, total
  ) VALUES (
    v_doc_id, p_descripcion,
    1, p_valor, p_valor,
    0, p_valor, 0, 0, p_valor
  );

  -- 4. Asiento contable
  SELECT numero INTO v_num_asiento
  FROM siguiente_consecutivo(p_empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    p_empresa_id, p_ejercicio_id, v_num_asiento,
    'automatico', 'gasto', v_doc_id,
    'Gasto - ' || p_descripcion,
    p_fecha, p_valor
  ) RETURNING id INTO v_asiento_id;

  -- Cuenta del gasto según tipo_gasto
  SELECT cuenta_id INTO v_cuenta_gasto
  FROM tipos_gasto WHERE id = p_tipo_gasto_id;

  -- Cuenta de pago: formas_pago.cuenta_id o cuentas_especiales 'caja'
  SELECT COALESCE(fp.cuenta_id, ce.cuenta_id)
  INTO v_cuenta_pago
  FROM formas_pago fp
  LEFT JOIN cuentas_especiales ce ON ce.empresa_id = p_empresa_id AND ce.tipo = 'caja'
  WHERE fp.id = p_forma_pago_id;

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES
    (v_asiento_id, v_cuenta_gasto, p_descripcion, p_valor, 0),
    (v_asiento_id, v_cuenta_pago,  'Salida caja/banco', 0, p_valor);

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- 2. ASEGURAR CONSECUTIVO PARA TIPO 'gasto'
--    (inserta si no existe para la empresa por defecto)
-- ──────────────────────────────────────────────────────────────
INSERT INTO consecutivos (empresa_id, descripcion, tipo, prefijo, consecutivo_actual, activo)
SELECT '00000000-0000-0000-0000-000000000001', 'Gastos', 'gasto', 'G-', 0, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM consecutivos
  WHERE empresa_id = '00000000-0000-0000-0000-000000000001' AND tipo = 'gasto'
);
