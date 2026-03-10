-- ============================================================
-- MIGRACION 026 - DASHBOARD SEGURO Y ESCALABLE
-- 1) Envuelve KPIs/resumen mensual en RPC seguras por sesion.
-- 2) Agrega KPI mensual y top clientes por SQL agregado.
-- 3) Revoca acceso autenticado directo a funciones con empresa_id arbitrario.
-- ============================================================

CREATE OR REPLACE FUNCTION public.secure_get_kpis_dashboard(
  p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor', 'solo_lectura']);
  RETURN public.get_kpis_dashboard(v_empresa_id, p_anio);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_get_resumen_mensual(
  p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer
) RETURNS TABLE(
  mes integer,
  ventas decimal,
  compras decimal,
  costos decimal,
  gastos decimal,
  ganancias decimal
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor', 'solo_lectura']);
  RETURN QUERY
  SELECT *
  FROM public.get_resumen_mensual(v_empresa_id, p_anio);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_get_dashboard_kpis_mes(
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_fecha date := COALESCE(p_fecha, CURRENT_DATE);
  v_inicio_mes date := date_trunc('month', v_fecha)::date;
  v_cobrado_mes numeric := 0;
  v_result json;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor', 'solo_lectura']);

  SELECT COALESCE(SUM(valor), 0)
  INTO v_cobrado_mes
  FROM recibos
  WHERE empresa_id = v_empresa_id
    AND tipo = 'venta'
    AND fecha >= v_inicio_mes
    AND fecha <= v_fecha;

  SELECT json_build_object(
    'ventas_mes', COALESCE(SUM(total) FILTER (
      WHERE tipo = 'factura_venta'
        AND estado != 'cancelada'
        AND fecha >= v_inicio_mes
        AND fecha <= v_fecha
    ), 0),
    'compras_mes', COALESCE(SUM(total) FILTER (
      WHERE tipo = 'factura_compra'
        AND estado != 'cancelada'
        AND fecha >= v_inicio_mes
        AND fecha <= v_fecha
    ), 0),
    'gastos_mes', COALESCE(SUM(total) FILTER (
      WHERE tipo = 'gasto'
        AND estado != 'cancelada'
        AND fecha >= v_inicio_mes
        AND fecha <= v_fecha
    ), 0),
    'cobrado_mes', v_cobrado_mes,
    'por_cobrar', COALESCE(SUM(total) FILTER (
      WHERE tipo = 'factura_venta'
        AND estado = 'pendiente'
    ), 0),
    'por_pagar', COALESCE(SUM(total) FILTER (
      WHERE tipo = 'factura_compra'
        AND estado = 'pendiente'
    ), 0),
    'facturas_pendientes', COUNT(*) FILTER (
      WHERE tipo = 'factura_venta'
        AND estado = 'pendiente'
    )
  )
  INTO v_result
  FROM documentos
  WHERE empresa_id = v_empresa_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_get_dashboard_top_clientes_mes(
  p_limite integer DEFAULT 5,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS TABLE(
  razon_social text,
  total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_fecha date := COALESCE(p_fecha, CURRENT_DATE);
  v_inicio_mes date := date_trunc('month', v_fecha)::date;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor', 'solo_lectura']);

  RETURN QUERY
  SELECT
    COALESCE(c.razon_social, '—')::text AS razon_social,
    COALESCE(SUM(d.total), 0)::numeric AS total
  FROM documentos d
  JOIN clientes c ON c.id = d.cliente_id
  WHERE d.empresa_id = v_empresa_id
    AND d.tipo = 'factura_venta'
    AND d.estado != 'cancelada'
    AND d.fecha >= v_inicio_mes
    AND d.fecha <= v_fecha
  GROUP BY c.id, c.razon_social
  ORDER BY SUM(d.total) DESC
  LIMIT GREATEST(COALESCE(p_limite, 5), 1);
END;
$$;

ALTER FUNCTION public.secure_get_kpis_dashboard(integer) SET search_path = public;
ALTER FUNCTION public.secure_get_resumen_mensual(integer) SET search_path = public;
ALTER FUNCTION public.secure_get_dashboard_kpis_mes(date) SET search_path = public;
ALTER FUNCTION public.secure_get_dashboard_top_clientes_mes(integer, date) SET search_path = public;

REVOKE ALL ON FUNCTION public.get_kpis_dashboard(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_resumen_mensual(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_resumen_mensual(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.secure_get_kpis_dashboard(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.secure_get_resumen_mensual(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.secure_get_dashboard_kpis_mes(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.secure_get_dashboard_top_clientes_mes(integer, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.secure_get_kpis_dashboard(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_get_resumen_mensual(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_get_dashboard_kpis_mes(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_get_dashboard_top_clientes_mes(integer, date) TO authenticated, service_role;
