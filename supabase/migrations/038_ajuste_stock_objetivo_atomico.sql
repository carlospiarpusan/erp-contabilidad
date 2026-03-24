-- ============================================================
-- MIGRACIÓN 038 — AJUSTE DE STOCK OBJETIVO ATÓMICO
-- Permite fijar una cantidad final exacta por producto/bodega
-- dentro de una sola transacción y devuelve antes/delta/después.
-- ============================================================

CREATE OR REPLACE FUNCTION public.secure_ajustar_stock_objetivo(
  p_producto_id uuid,
  p_variante_id uuid,
  p_bodega_id uuid,
  p_stock_objetivo numeric,
  p_notas text DEFAULT NULL
) RETURNS TABLE(
  stock_antes numeric,
  delta numeric,
  stock_despues numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_producto_empresa_id uuid;
  v_bodega_empresa_id uuid;
  v_stock_actual numeric := 0;
  v_row record;
BEGIN
  IF p_stock_objetivo IS NULL OR p_stock_objetivo < 0 THEN
    RAISE EXCEPTION 'Cantidad objetivo inválida para ajuste de inventario';
  END IF;

  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);

  SELECT empresa_id
  INTO v_producto_empresa_id
  FROM public.productos
  WHERE id = p_producto_id;

  IF v_producto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_producto_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Producto fuera de la empresa del usuario';
  END IF;

  SELECT empresa_id
  INTO v_bodega_empresa_id
  FROM public.bodegas
  WHERE id = p_bodega_id
    AND activa = TRUE;

  IF v_bodega_empresa_id IS NULL THEN
    RAISE EXCEPTION 'La bodega seleccionada no existe o está inactiva';
  END IF;

  IF v_bodega_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Bodega fuera de la empresa del usuario';
  END IF;

  IF p_variante_id IS NULL THEN
    INSERT INTO public.stock (producto_id, variante_id, bodega_id, cantidad)
    SELECT p_producto_id, NULL, p_bodega_id, 0
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.stock s
      WHERE s.producto_id = p_producto_id
        AND s.variante_id IS NULL
        AND s.bodega_id = p_bodega_id
    );
  ELSE
    INSERT INTO public.stock (producto_id, variante_id, bodega_id, cantidad)
    VALUES (p_producto_id, p_variante_id, p_bodega_id, 0)
    ON CONFLICT (producto_id, variante_id, bodega_id) DO NOTHING;
  END IF;

  FOR v_row IN
    SELECT s.cantidad
    FROM public.stock s
    WHERE s.producto_id = p_producto_id
      AND (s.variante_id = p_variante_id OR (s.variante_id IS NULL AND p_variante_id IS NULL))
      AND s.bodega_id = p_bodega_id
    FOR UPDATE
  LOOP
    v_stock_actual := v_stock_actual + COALESCE(v_row.cantidad, 0);
  END LOOP;

  stock_antes := v_stock_actual;
  delta := p_stock_objetivo - v_stock_actual;
  stock_despues := p_stock_objetivo;

  IF ABS(delta) >= 0.000001 THEN
    PERFORM public.actualizar_stock(
      p_producto_id,
      p_variante_id,
      p_bodega_id,
      delta,
      'ajuste_inventario',
      NULL,
      0,
      p_notas
    );
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_ajustar_stock_objetivo(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_ajustar_stock_objetivo(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;
