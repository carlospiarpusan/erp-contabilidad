CREATE OR REPLACE FUNCTION public.aplicar_pago_mensual_sistecredito(
  p_empresa_id uuid,
  p_mes_venta date,
  p_forma_pago_id uuid,
  p_ejercicio_id uuid,
  p_fecha_pago date,
  p_observaciones text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_mes date;
  v_fin_mes date;
  v_factura record;
  v_saldo numeric(15, 2);
  v_facturas integer := 0;
  v_total numeric(15, 2) := 0;
  v_recibo_id uuid;
  v_recibos uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_mes_venta IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el mes de venta';
  END IF;

  IF p_forma_pago_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar la forma de recaudo';
  END IF;

  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'Debe indicar la fecha del pago';
  END IF;

  IF public.forma_pago_es_sistecredito(p_forma_pago_id) THEN
    RAISE EXCEPTION 'La forma de recaudo no puede ser Sistecrédito';
  END IF;

  v_inicio_mes := date_trunc('month', p_mes_venta)::date;
  v_fin_mes := (date_trunc('month', p_mes_venta) + interval '1 month - 1 day')::date;

  FOR v_factura IN
    SELECT d.id, d.total
    FROM documentos d
    WHERE d.empresa_id = p_empresa_id
      AND d.tipo = 'factura_venta'
      AND d.estado IN ('pendiente', 'vencida')
      AND d.fecha BETWEEN v_inicio_mes AND v_fin_mes
      AND public.forma_pago_es_sistecredito(d.forma_pago_id)
    ORDER BY d.fecha, d.numero
    FOR UPDATE
  LOOP
    SELECT GREATEST(COALESCE(v_factura.total, 0) - COALESCE(SUM(r.valor), 0), 0)
    INTO v_saldo
    FROM recibos r
    WHERE r.documento_id = v_factura.id;

    IF COALESCE(v_saldo, 0) <= 0.01 THEN
      CONTINUE;
    END IF;

    v_recibo_id := public.crear_recibo_venta(
      p_empresa_id,
      v_factura.id,
      p_forma_pago_id,
      p_ejercicio_id,
      v_saldo,
      p_fecha_pago,
      COALESCE(p_observaciones, 'Pago consolidado Sistecrédito ' || to_char(v_inicio_mes, 'YYYY-MM'))
    );

    v_facturas := v_facturas + 1;
    v_total := v_total + v_saldo;
    v_recibos := array_append(v_recibos, v_recibo_id);
  END LOOP;

  IF v_facturas = 0 THEN
    RAISE EXCEPTION 'No hay facturas Sistecrédito pendientes en %', to_char(v_inicio_mes, 'YYYY-MM');
  END IF;

  RETURN jsonb_build_object(
    'mes_venta', to_char(v_inicio_mes, 'YYYY-MM'),
    'fecha_pago', p_fecha_pago,
    'facturas', v_facturas,
    'total', v_total,
    'recibos', to_jsonb(v_recibos)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_aplicar_pago_mensual_sistecredito(
  p_mes_venta date,
  p_forma_pago_id uuid,
  p_ejercicio_id uuid,
  p_fecha_pago date,
  p_observaciones text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);

  RETURN public.aplicar_pago_mensual_sistecredito(
    v_empresa_id,
    p_mes_venta,
    p_forma_pago_id,
    p_ejercicio_id,
    p_fecha_pago,
    p_observaciones
  );
END;
$$;

ALTER FUNCTION public.aplicar_pago_mensual_sistecredito(uuid, date, uuid, uuid, date, text) SET search_path = public;
ALTER FUNCTION public.secure_aplicar_pago_mensual_sistecredito(date, uuid, uuid, date, text) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.secure_aplicar_pago_mensual_sistecredito(date, uuid, uuid, date, text) TO authenticated, service_role;
