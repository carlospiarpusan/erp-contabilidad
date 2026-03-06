-- ============================================================
-- MIGRACIÓN 010 — ESTADÍSTICAS SUPERADMIN OPTIMIZADAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_estadisticas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_empresa CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_inicio_mes date := date_trunc('month', now())::date;
  v_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  WITH docs AS (
    SELECT empresa_id, tipo, total, fecha
    FROM documentos
    WHERE empresa_id <> v_base_empresa
  ),
  docs_totales AS (
    SELECT
      COALESCE(SUM(total) FILTER (WHERE tipo = 'factura_venta'), 0) AS total_ventas,
      COALESCE(SUM(total) FILTER (WHERE tipo = 'factura_compra'), 0) AS total_compras,
      COALESCE(SUM(total) FILTER (WHERE tipo = 'gasto'), 0) AS total_gastos,
      COUNT(*) FILTER (WHERE tipo = 'factura_venta') AS total_facturas,
      COUNT(*) FILTER (WHERE tipo = 'factura_compra') AS total_compras_docs,
      COALESCE(SUM(total) FILTER (WHERE tipo = 'factura_venta' AND fecha >= v_inicio_mes), 0) AS ventas_mes,
      COALESCE(SUM(total) FILTER (WHERE tipo = 'factura_compra' AND fecha >= v_inicio_mes), 0) AS compras_mes
    FROM docs
  ),
  docs_empresa AS (
    SELECT
      empresa_id,
      COALESCE(SUM(total) FILTER (WHERE tipo = 'factura_venta'), 0) AS total_ventas,
      COUNT(*) AS total_documentos
    FROM docs
    GROUP BY empresa_id
  ),
  usuarios_empresa AS (
    SELECT empresa_id, COUNT(*) AS total_usuarios
    FROM usuarios
    GROUP BY empresa_id
  ),
  empresas_detalle AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'nombre', e.nombre,
          'nit', e.nit,
          'activa', e.activa,
          'created_at', e.created_at,
          'total_ventas', COALESCE(de.total_ventas, 0),
          'total_usuarios', COALESCE(ue.total_usuarios, 0),
          'total_documentos', COALESCE(de.total_documentos, 0)
        )
        ORDER BY e.created_at DESC
      ),
      '[]'::jsonb
    ) AS data
    FROM empresas e
    LEFT JOIN docs_empresa de ON de.empresa_id = e.id
    LEFT JOIN usuarios_empresa ue ON ue.empresa_id = e.id
    WHERE e.nit <> '00000000'
  )
  SELECT jsonb_build_object(
    'totalEmpresas', (SELECT COUNT(*) FROM empresas WHERE nit <> '00000000'),
    'totalUsuarios', (SELECT COUNT(*) FROM usuarios),
    'totalVentas', dt.total_ventas,
    'totalCompras', dt.total_compras,
    'totalGastos', dt.total_gastos,
    'totalFacturas', dt.total_facturas,
    'totalComprasDocs', dt.total_compras_docs,
    'ventasMes', dt.ventas_mes,
    'comprasMes', dt.compras_mes,
    'empresas', ed.data
  )
  INTO v_result
  FROM docs_totales dt, empresas_detalle ed;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_estadisticas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_superadmin_estadisticas() FROM anon;
REVOKE ALL ON FUNCTION public.get_superadmin_estadisticas() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_superadmin_estadisticas() TO service_role;
