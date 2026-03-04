-- ============================================================
-- MIGRACIÓN 006 — FUNCIÓN CREAR RECIBO DE VENTA
-- Crea el recibo, genera el asiento contable y actualiza
-- el estado del documento si está completamente pagado.
-- ============================================================

CREATE OR REPLACE FUNCTION crear_recibo_venta(
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
  v_total_recibido DECIMAL;
BEGIN
  -- 1. Obtener consecutivo de recibo de caja ventas
  SELECT numero INTO v_num
  FROM siguiente_consecutivo(p_empresa_id, 'recibo_venta');

  -- 2. Insertar el recibo
  INSERT INTO recibos (
    empresa_id, tipo, numero, documento_id,
    forma_pago_id, ejercicio_id, valor,
    fecha, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'venta', v_num, p_documento_id,
    p_forma_pago_id, p_ejercicio_id, p_valor,
    p_fecha, p_observaciones, auth.uid()
  ) RETURNING id INTO v_recibo_id;

  -- 3. Generar asiento contable
  PERFORM generar_asiento_recibo_venta(v_recibo_id);

  -- 4. Actualizar estado del documento si está completamente pagado
  SELECT total INTO v_total_doc
  FROM documentos WHERE id = p_documento_id;

  SELECT COALESCE(SUM(valor), 0) INTO v_total_recibido
  FROM recibos WHERE documento_id = p_documento_id;

  IF v_total_recibido >= v_total_doc THEN
    UPDATE documentos
    SET estado = 'pagada', updated_at = NOW()
    WHERE id = p_documento_id;
  END IF;

  RETURN v_recibo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
