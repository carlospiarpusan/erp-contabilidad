-- ============================================================
-- MIGRACIÓN 019 — HOTFIX ASIENTO FACTURA VENTA + PERMISOS KPI
-- Corrige columna inexistente en generar_asiento_factura_venta
-- y habilita permisos de lectura para KPIs/resumen mensual.
-- ============================================================

CREATE OR REPLACE FUNCTION generar_asiento_factura_venta(
  p_documento_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc         RECORD;
  v_asiento_id  UUID;
  v_num         INTEGER;
  v_cuenta      RECORD;
BEGIN
  SELECT d.*, c.prefijo AS serie_codigo
  INTO v_doc
  FROM documentos d
  LEFT JOIN consecutivos c ON c.id = d.serie_id
  WHERE d.id = p_documento_id;

  SELECT numero INTO v_num FROM siguiente_consecutivo(v_doc.empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    v_doc.empresa_id, v_doc.ejercicio_id, v_num,
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

GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resumen_mensual(uuid, integer) TO authenticated, service_role;
