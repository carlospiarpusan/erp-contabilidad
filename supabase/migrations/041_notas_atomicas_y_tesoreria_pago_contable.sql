-- ============================================================
-- MIGRACIÓN 041 — NOTAS ATÓMICAS + TESORERÍA CONTABLE
-- ============================================================

CREATE OR REPLACE FUNCTION public.crear_reversion_asiento_documento(
  p_empresa_id uuid,
  p_documento_id uuid,
  p_tipo_doc_original text,
  p_tipo_doc_reversion text,
  p_concepto text,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id uuid;
  v_ejercicio_id uuid;
  v_asiento_original record;
  v_asiento_reversion_id uuid;
  v_num_asiento integer;
  v_lineas_insertadas integer := 0;
BEGIN
  v_periodo_id := public.assert_periodo_contable_abierto(p_empresa_id, p_fecha);

  SELECT pc.ejercicio_id
  INTO v_ejercicio_id
  FROM periodos_contables pc
  WHERE pc.id = v_periodo_id;

  IF v_ejercicio_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el ejercicio contable para la fecha %', p_fecha;
  END IF;

  SELECT a.id, a.numero, a.importe
  INTO v_asiento_original
  FROM asientos a
  WHERE a.empresa_id = p_empresa_id
    AND a.documento_id = p_documento_id
    AND a.tipo_doc = p_tipo_doc_original
  ORDER BY a.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el asiento original del documento % (%).', p_documento_id, p_tipo_doc_original;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM asientos a
    WHERE a.empresa_id = p_empresa_id
      AND a.documento_id = p_documento_id
      AND a.tipo_doc = p_tipo_doc_reversion
  ) THEN
    RAISE EXCEPTION 'Ya existe una reversión contable para este documento';
  END IF;

  SELECT numero
  INTO v_num_asiento
  FROM siguiente_consecutivo(p_empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id,
    ejercicio_id,
    numero,
    tipo,
    tipo_doc,
    documento_id,
    concepto,
    fecha,
    importe
  ) VALUES (
    p_empresa_id,
    v_ejercicio_id,
    v_num_asiento,
    'automatico',
    p_tipo_doc_reversion,
    p_documento_id,
    p_concepto,
    p_fecha,
    v_asiento_original.importe
  ) RETURNING id INTO v_asiento_reversion_id;

  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  SELECT
    v_asiento_reversion_id,
    al.cuenta_id,
    COALESCE(NULLIF(al.descripcion, ''), 'Reversión asiento ' || COALESCE(v_asiento_original.numero::text, '')),
    COALESCE(al.haber, 0),
    COALESCE(al.debe, 0)
  FROM asientos_lineas al
  WHERE al.asiento_id = v_asiento_original.id;

  GET DIAGNOSTICS v_lineas_insertadas = ROW_COUNT;
  IF v_lineas_insertadas = 0 THEN
    RAISE EXCEPTION 'El asiento original % no tiene líneas para revertir', v_asiento_original.id;
  END IF;

  RETURN v_asiento_reversion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_reversion_asiento_documento(uuid, uuid, text, text, text, date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_reversion_asiento_documento(uuid, uuid, text, text, text, date)
TO service_role;

CREATE OR REPLACE FUNCTION public.secure_anular_nota_credito(
  p_documento_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_doc record;
  v_linea record;
  v_reversion_asiento_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);

  SELECT d.id, d.empresa_id, d.numero, d.prefijo, d.estado, d.bodega_id
  INTO v_doc
  FROM documentos d
  WHERE d.id = p_documento_id
    AND d.empresa_id = v_empresa_id
    AND d.tipo = 'nota_credito'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota crédito no encontrada';
  END IF;

  IF v_doc.estado = 'cancelada' THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM recibos r
    WHERE r.empresa_id = v_empresa_id
      AND r.documento_id = p_documento_id
  ) THEN
    RAISE EXCEPTION 'La nota crédito tiene recaudos asociados y no puede anularse automáticamente';
  END IF;

  IF v_doc.bodega_id IS NULL AND EXISTS (
    SELECT 1
    FROM documentos_lineas dl
    WHERE dl.documento_id = p_documento_id
      AND dl.producto_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'La nota crédito no tiene bodega asociada para revertir inventario';
  END IF;

  v_reversion_asiento_id := public.crear_reversion_asiento_documento(
    v_empresa_id,
    p_documento_id,
    'nota_credito',
    'reversion_nota_credito',
    'Anulación NC ' || COALESCE(v_doc.prefijo, '') || COALESCE(v_doc.numero::text, ''),
    CURRENT_DATE
  );

  FOR v_linea IN
    SELECT producto_id, variante_id, cantidad, precio_costo
    FROM documentos_lineas
    WHERE documento_id = p_documento_id
      AND producto_id IS NOT NULL
  LOOP
    PERFORM public.actualizar_stock(
      v_linea.producto_id,
      v_linea.variante_id,
      v_doc.bodega_id,
      COALESCE(v_linea.cantidad, 0) * -1,
      'cancelacion_nota_credito',
      p_documento_id,
      COALESCE(v_linea.precio_costo, 0)
    );
  END LOOP;

  UPDATE documentos
  SET estado = 'cancelada', updated_at = NOW()
  WHERE id = p_documento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', p_documento_id,
    'reversion_asiento_id', v_reversion_asiento_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_anular_nota_debito(
  p_documento_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_doc record;
  v_reversion_asiento_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);

  SELECT d.id, d.empresa_id, d.numero, d.prefijo, d.estado
  INTO v_doc
  FROM documentos d
  WHERE d.id = p_documento_id
    AND d.empresa_id = v_empresa_id
    AND d.tipo = 'nota_debito'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota débito no encontrada';
  END IF;

  IF v_doc.estado = 'cancelada' THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM recibos r
    WHERE r.empresa_id = v_empresa_id
      AND r.documento_id = p_documento_id
  ) THEN
    RAISE EXCEPTION 'La nota débito tiene recaudos asociados y no puede anularse automáticamente';
  END IF;

  v_reversion_asiento_id := public.crear_reversion_asiento_documento(
    v_empresa_id,
    p_documento_id,
    'nota_debito',
    'reversion_nota_debito',
    'Anulación ND ' || COALESCE(v_doc.prefijo, '') || COALESCE(v_doc.numero::text, ''),
    CURRENT_DATE
  );

  UPDATE documentos
  SET estado = 'cancelada', updated_at = NOW()
  WHERE id = p_documento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', p_documento_id,
    'reversion_asiento_id', v_reversion_asiento_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_anular_nota_credito(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_anular_nota_debito(uuid) TO authenticated, service_role;
