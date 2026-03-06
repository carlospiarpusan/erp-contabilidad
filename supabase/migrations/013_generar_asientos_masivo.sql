-- ============================================================
-- MIGRACIÓN 013 — GENERACIÓN MASIVA DE ASIENTOS AUTOMÁTICOS
-- ============================================================
-- Busca documentos y recibos que no tienen asiento contable
-- y los genera llamando a las funciones existentes.
-- ============================================================

CREATE OR REPLACE FUNCTION generar_asientos_masivo(
  p_empresa_id UUID
) RETURNS TABLE(
  tipo        TEXT,
  documento   TEXT,
  asiento_id  UUID
) AS $$
DECLARE
  v_row     RECORD;
  v_asiento UUID;
BEGIN

  -- ── 1. Facturas de Venta sin asiento ──────────────────────
  FOR v_row IN
    SELECT d.id, d.prefijo, d.numero
    FROM documentos d
    WHERE d.empresa_id   = p_empresa_id
      AND d.tipo         = 'factura_venta'
      AND d.estado      != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id
          AND a.tipo_doc     = 'factura_venta'
      )
    ORDER BY d.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_factura_venta(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'factura_venta'::TEXT, (v_row.prefijo || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla (p.ej. cuentas especiales no configuradas), continuar con el siguiente
      RAISE WARNING 'Error generando asiento para FV %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  -- ── 2. Recibos de Caja sin asiento ────────────────────────
  FOR v_row IN
    SELECT r.id, r.numero
    FROM recibos r
    WHERE r.empresa_id  = p_empresa_id
      AND r.tipo        = 'venta'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = r.id
          AND a.tipo_doc     = 'recibo_venta'
      )
    ORDER BY r.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_recibo_venta(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'recibo_venta'::TEXT, ('RC-' || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error generando asiento para RC %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  -- ── 3. Facturas de Compra sin asiento ─────────────────────
  FOR v_row IN
    SELECT d.id, d.prefijo, d.numero
    FROM documentos d
    WHERE d.empresa_id  = p_empresa_id
      AND d.tipo        = 'factura_compra'
      AND d.estado     != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id
          AND a.tipo_doc     = 'factura_compra'
      )
    ORDER BY d.fecha
  LOOP
    BEGIN
      SELECT generar_asiento_factura_compra(v_row.id) INTO v_asiento;
      RETURN QUERY SELECT 'factura_compra'::TEXT, (v_row.prefijo || v_row.numero::TEXT), v_asiento;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error generando asiento para FC %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función auxiliar para contar documentos sin asiento
CREATE OR REPLACE FUNCTION contar_sin_asiento(
  p_empresa_id UUID
) RETURNS TABLE(
  tipo        TEXT,
  pendientes  BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT 'facturas_venta'::TEXT,
           COUNT(*)::BIGINT
    FROM documentos d
    WHERE d.empresa_id  = p_empresa_id
      AND d.tipo        = 'factura_venta'
      AND d.estado     != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id AND a.tipo_doc = 'factura_venta'
      );

  RETURN QUERY
    SELECT 'recibos_caja'::TEXT,
           COUNT(*)::BIGINT
    FROM recibos r
    WHERE r.empresa_id = p_empresa_id
      AND r.tipo       = 'venta'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = r.id AND a.tipo_doc = 'recibo_venta'
      );

  RETURN QUERY
    SELECT 'facturas_compra'::TEXT,
           COUNT(*)::BIGINT
    FROM documentos d
    WHERE d.empresa_id  = p_empresa_id
      AND d.tipo        = 'factura_compra'
      AND d.estado     != 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM asientos a
        WHERE a.documento_id = d.id AND a.tipo_doc = 'factura_compra'
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
