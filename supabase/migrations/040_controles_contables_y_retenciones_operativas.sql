-- ============================================================
-- MIGRACIÓN 040 — CONTROLES CONTABLES ESTRICTOS + RETENCIONES
-- ============================================================

-- 1. Restablecer assert de periodo en modo fail-closed
CREATE OR REPLACE FUNCTION public.assert_periodo_contable_abierto(p_empresa_id UUID, p_fecha DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo RECORD;
BEGIN
  SELECT id, estado
  INTO v_periodo
  FROM periodos_contables
  WHERE empresa_id = p_empresa_id
    AND fecha_inicio <= p_fecha
    AND fecha_fin >= p_fecha
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe periodo contable configurado para la fecha %', p_fecha;
  END IF;

  IF v_periodo.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El periodo contable correspondiente a la fecha % está cerrado', p_fecha;
  END IF;

  RETURN v_periodo.id;
END;
$$;

-- 2. Resolver retenciones operativas
CREATE OR REPLACE FUNCTION public.resolver_retenciones_operativas(
  p_empresa_id uuid,
  p_fecha date,
  p_retenciones jsonb,
  p_default_base numeric
) RETURNS TABLE (
  retencion_id uuid,
  tipo text,
  nombre text,
  porcentaje numeric,
  base_gravable numeric,
  valor numeric,
  cuenta_contable_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_ret record;
  v_base numeric;
  v_threshold numeric;
  v_uvt numeric;
  v_valor numeric;
  v_año integer;
BEGIN
  IF p_retenciones IS NULL OR jsonb_typeof(p_retenciones) <> 'array' OR jsonb_array_length(p_retenciones) = 0 THEN
    RETURN;
  END IF;

  v_año := EXTRACT(YEAR FROM p_fecha)::integer;

  SELECT uv.valor
  INTO v_uvt
  FROM uvt_vigencias uv
  WHERE uv.empresa_id = p_empresa_id
    AND uv.año = v_año
  LIMIT 1;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_retenciones)
  LOOP
    IF COALESCE(v_item->>'retencion_id', '') = '' THEN
      RAISE EXCEPTION 'retencion_id requerido en retenciones';
    END IF;

    SELECT r.*
    INTO v_ret
    FROM retenciones r
    WHERE r.id = (v_item->>'retencion_id')::uuid
      AND r.empresa_id = p_empresa_id
      AND r.activa = true
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Retención no encontrada o inactiva: %', v_item->>'retencion_id';
    END IF;

    IF v_ret.cuenta_contable_id IS NULL THEN
      RAISE EXCEPTION 'La retención % no tiene cuenta contable configurada', v_ret.nombre;
    END IF;

    v_base := COALESCE(NULLIF(v_item->>'base_gravable', '')::numeric, p_default_base, 0);
    IF COALESCE(v_base, 0) <= 0 THEN
      CONTINUE;
    END IF;

    IF COALESCE(v_ret.base_uvt, 0) > 0 AND v_uvt IS NULL THEN
      RAISE EXCEPTION 'No existe UVT configurada para el año %', v_año;
    END IF;

    v_threshold := GREATEST(
      COALESCE(v_ret.base_minima, 0),
      CASE
        WHEN COALESCE(v_ret.base_uvt, 0) > 0 THEN COALESCE(v_uvt, 0) * v_ret.base_uvt
        ELSE 0
      END
    );

    IF v_base < v_threshold THEN
      RAISE EXCEPTION 'La retención % no aplica para la base gravable %', v_ret.nombre, v_base;
    END IF;

    v_valor := COALESCE(
      NULLIF(v_item->>'valor', '')::numeric,
      ROUND(v_base * COALESCE(v_ret.porcentaje, 0) / 100, 2)
    );

    IF COALESCE(v_valor, 0) <= 0 THEN
      CONTINUE;
    END IF;

    retencion_id := v_ret.id;
    tipo := v_ret.tipo;
    nombre := v_ret.nombre;
    porcentaje := v_ret.porcentaje;
    base_gravable := v_base;
    valor := v_valor;
    cuenta_contable_id := v_ret.cuenta_contable_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3. Pago a proveedor con retenciones
CREATE OR REPLACE FUNCTION public.crear_pago_compra(
  p_empresa_id    UUID,
  p_documento_id  UUID,
  p_forma_pago_id UUID,
  p_ejercicio_id  UUID,
  p_valor         DECIMAL,
  p_fecha         DATE,
  p_observaciones TEXT DEFAULT NULL,
  p_retenciones   JSONB DEFAULT '[]'::jsonb
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
  v_total_ret      DECIMAL := 0;
  v_pago_neto      DECIMAL := 0;
  v_retencion      RECORD;
  v_retenciones_resueltas JSONB := '[]'::jsonb;
  v_item JSONB;
BEGIN
  SELECT numero INTO v_num
  FROM siguiente_consecutivo(p_empresa_id, 'recibo_compra');

  FOR v_retencion IN
    SELECT * FROM public.resolver_retenciones_operativas(p_empresa_id, p_fecha, p_retenciones, p_valor)
  LOOP
    v_total_ret := v_total_ret + v_retencion.valor;
    v_retenciones_resueltas := v_retenciones_resueltas || jsonb_build_array(jsonb_build_object(
      'retencion_id', v_retencion.retencion_id,
      'tipo', v_retencion.tipo,
      'nombre', v_retencion.nombre,
      'porcentaje', v_retencion.porcentaje,
      'base_gravable', v_retencion.base_gravable,
      'valor', v_retencion.valor,
      'cuenta_contable_id', v_retencion.cuenta_contable_id
    ));
  END LOOP;

  v_pago_neto := p_valor - v_total_ret;
  IF v_pago_neto <= 0 THEN
    RAISE EXCEPTION 'El valor neto a desembolsar debe ser mayor a cero después de retenciones';
  END IF;

  INSERT INTO recibos (
    empresa_id, tipo, numero, documento_id,
    forma_pago_id, ejercicio_id, valor,
    fecha, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'compra', v_num, p_documento_id,
    p_forma_pago_id, p_ejercicio_id, p_valor,
    p_fecha, p_observaciones, auth.uid()
  ) RETURNING id INTO v_recibo_id;

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

  SELECT COALESCE(fp.cuenta_id, ce.cuenta_id)
  INTO v_cuenta_cr
  FROM formas_pago fp
  LEFT JOIN cuentas_especiales ce ON ce.empresa_id = p_empresa_id AND ce.tipo = 'caja'
  WHERE fp.id = p_forma_pago_id;

  SELECT cuenta_id INTO v_cuenta_db
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'proveedores';

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES
    (v_asiento_id, v_cuenta_db, 'Pago a proveedor', p_valor, 0),
    (v_asiento_id, v_cuenta_cr, 'Salida caja/banco neta', 0, v_pago_neto);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_retenciones_resueltas)
  LOOP
    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (
      v_asiento_id,
      (v_item->>'cuenta_contable_id')::uuid,
      'Retención ' || COALESCE(v_item->>'nombre', ''),
      0,
      (v_item->>'valor')::numeric
    );

    INSERT INTO retenciones_aplicadas (
      empresa_id,
      documento_id,
      retencion_id,
      base_gravable,
      porcentaje,
      valor
    ) VALUES (
      p_empresa_id,
      p_documento_id,
      (v_item->>'retencion_id')::uuid,
      (v_item->>'base_gravable')::numeric,
      (v_item->>'porcentaje')::numeric,
      (v_item->>'valor')::numeric
    );
  END LOOP;

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

CREATE OR REPLACE FUNCTION public.secure_crear_pago_compra(
  p_documento_id   uuid,
  p_forma_pago_id  uuid,
  p_ejercicio_id   uuid,
  p_valor          numeric,
  p_fecha          date,
  p_observaciones  text DEFAULT NULL,
  p_retenciones    jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_pago_compra(
    v_empresa_id,
    p_documento_id,
    p_forma_pago_id,
    p_ejercicio_id,
    p_valor,
    p_fecha,
    p_observaciones,
    p_retenciones
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_crear_pago_compra(uuid, uuid, uuid, numeric, date, text, jsonb) TO authenticated, service_role;

-- 4. Gasto con retenciones
CREATE OR REPLACE FUNCTION public.crear_gasto(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_acreedor_id   UUID,
  p_tipo_gasto_id UUID,
  p_forma_pago_id UUID,
  p_fecha         DATE,
  p_descripcion   TEXT,
  p_valor         DECIMAL,
  p_observaciones TEXT DEFAULT NULL,
  p_retenciones   JSONB DEFAULT '[]'::jsonb
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
  v_total_ret    DECIMAL := 0;
  v_pago_neto    DECIMAL := 0;
  v_retencion    RECORD;
  v_retenciones_resueltas JSONB := '[]'::jsonb;
  v_item JSONB;
BEGIN
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, 'gasto');

  FOR v_retencion IN
    SELECT * FROM public.resolver_retenciones_operativas(p_empresa_id, p_fecha, p_retenciones, p_valor)
  LOOP
    v_total_ret := v_total_ret + v_retencion.valor;
    v_retenciones_resueltas := v_retenciones_resueltas || jsonb_build_array(jsonb_build_object(
      'retencion_id', v_retencion.retencion_id,
      'tipo', v_retencion.tipo,
      'nombre', v_retencion.nombre,
      'porcentaje', v_retencion.porcentaje,
      'base_gravable', v_retencion.base_gravable,
      'valor', v_retencion.valor,
      'cuenta_contable_id', v_retencion.cuenta_contable_id
    ));
  END LOOP;

  v_pago_neto := p_valor - v_total_ret;
  IF v_pago_neto <= 0 THEN
    RAISE EXCEPTION 'El valor neto a desembolsar debe ser mayor a cero después de retenciones';
  END IF;

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

  INSERT INTO documentos_lineas (
    documento_id, descripcion,
    cantidad, precio_unitario, precio_costo,
    descuento_porcentaje, subtotal, total_descuento, total_iva, total
  ) VALUES (
    v_doc_id, p_descripcion,
    1, p_valor, p_valor,
    0, p_valor, 0, 0, p_valor
  );

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

  SELECT cuenta_id INTO v_cuenta_gasto
  FROM tipos_gasto WHERE id = p_tipo_gasto_id;

  SELECT COALESCE(fp.cuenta_id, ce.cuenta_id)
  INTO v_cuenta_pago
  FROM formas_pago fp
  LEFT JOIN cuentas_especiales ce ON ce.empresa_id = p_empresa_id AND ce.tipo = 'caja'
  WHERE fp.id = p_forma_pago_id;

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES
    (v_asiento_id, v_cuenta_gasto, p_descripcion, p_valor, 0),
    (v_asiento_id, v_cuenta_pago, 'Salida caja/banco neta', 0, v_pago_neto);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_retenciones_resueltas)
  LOOP
    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (
      v_asiento_id,
      (v_item->>'cuenta_contable_id')::uuid,
      'Retención ' || COALESCE(v_item->>'nombre', ''),
      0,
      (v_item->>'valor')::numeric
    );

    INSERT INTO retenciones_aplicadas (
      empresa_id,
      documento_id,
      retencion_id,
      base_gravable,
      porcentaje,
      valor
    ) VALUES (
      p_empresa_id,
      v_doc_id,
      (v_item->>'retencion_id')::uuid,
      (v_item->>'base_gravable')::numeric,
      (v_item->>'porcentaje')::numeric,
      (v_item->>'valor')::numeric
    );
  END LOOP;

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.secure_crear_gasto(
  p_ejercicio_id   uuid,
  p_acreedor_id    uuid,
  p_tipo_gasto_id  uuid,
  p_forma_pago_id  uuid,
  p_fecha          date,
  p_descripcion    text,
  p_valor          numeric,
  p_observaciones  text DEFAULT NULL,
  p_retenciones    jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_gasto(
    v_empresa_id,
    p_ejercicio_id,
    p_acreedor_id,
    p_tipo_gasto_id,
    p_forma_pago_id,
    p_fecha,
    p_descripcion,
    p_valor,
    p_observaciones,
    p_retenciones
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_crear_gasto(uuid, uuid, uuid, uuid, date, text, numeric, text, jsonb) TO authenticated, service_role;
