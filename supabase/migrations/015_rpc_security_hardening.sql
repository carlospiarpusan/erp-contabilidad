-- ============================================================
-- MIGRACIÓN 015 — HARDENING RPC (Vercel + Supabase)
-- Objetivo:
-- 1) Evitar llamadas directas a funciones SECURITY DEFINER vulnerables.
-- 2) Forzar empresa_id desde sesión autenticada.
-- 3) Restringir por rol operaciones críticas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_authenticated_empresa(
  p_roles text[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_rol text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin empresa asociada';
  END IF;

  IF p_roles IS NOT NULL THEN
    v_rol := public.get_rol_nombre();
    IF v_rol IS NULL OR NOT (v_rol = ANY(p_roles)) THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
  END IF;

  RETURN v_empresa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_factura_venta(
  p_ejercicio_id   uuid,
  p_serie_tipo     text,
  p_cliente_id     uuid,
  p_bodega_id      uuid,
  p_forma_pago_id  uuid,
  p_colaborador_id uuid,
  p_fecha          date,
  p_vencimiento    date,
  p_observaciones  text,
  p_lineas         jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador', 'vendedor']);
  RETURN public.crear_factura_venta(
    v_empresa_id,
    p_ejercicio_id,
    p_serie_tipo,
    p_cliente_id,
    p_bodega_id,
    p_forma_pago_id,
    p_colaborador_id,
    p_fecha,
    p_vencimiento,
    p_observaciones,
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_recibo_venta(
  p_documento_id   uuid,
  p_forma_pago_id  uuid,
  p_ejercicio_id   uuid,
  p_valor          numeric,
  p_fecha          date,
  p_observaciones  text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_recibo_venta(
    v_empresa_id,
    p_documento_id,
    p_forma_pago_id,
    p_ejercicio_id,
    p_valor,
    p_fecha,
    p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_factura_compra(
  p_ejercicio_id   uuid,
  p_proveedor_id   uuid,
  p_bodega_id      uuid,
  p_fecha          date,
  p_numero_externo text,
  p_observaciones  text,
  p_lineas         jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_factura_compra(
    v_empresa_id,
    p_ejercicio_id,
    p_proveedor_id,
    p_bodega_id,
    p_fecha,
    p_numero_externo,
    p_observaciones,
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_pago_compra(
  p_documento_id   uuid,
  p_forma_pago_id  uuid,
  p_ejercicio_id   uuid,
  p_valor          numeric,
  p_fecha          date,
  p_observaciones  text DEFAULT NULL
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
    p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_gasto(
  p_ejercicio_id   uuid,
  p_acreedor_id    uuid,
  p_tipo_gasto_id  uuid,
  p_forma_pago_id  uuid,
  p_fecha          date,
  p_descripcion    text,
  p_valor          numeric,
  p_observaciones  text DEFAULT NULL
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
    p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_nota_credito(
  p_ejercicio_id  uuid,
  p_factura_id    uuid,
  p_motivo        text,
  p_lineas        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_nota_credito(
    v_empresa_id,
    p_ejercicio_id,
    p_factura_id,
    p_motivo,
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_crear_nota_debito(
  p_ejercicio_id  uuid,
  p_cliente_id    uuid,
  p_factura_id    uuid,
  p_motivo        text,
  p_lineas        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);
  RETURN public.crear_nota_debito(
    v_empresa_id,
    p_ejercicio_id,
    p_cliente_id,
    p_factura_id,
    p_motivo,
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_actualizar_stock(
  p_producto_id   uuid,
  p_variante_id   uuid,
  p_bodega_id     uuid,
  p_cantidad      numeric,
  p_tipo          text,
  p_documento_id  uuid DEFAULT NULL,
  p_precio_costo  numeric DEFAULT 0,
  p_numero_lote   text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_producto_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['superadmin', 'admin', 'contador']);

  SELECT empresa_id INTO v_producto_empresa_id
  FROM productos
  WHERE id = p_producto_id;

  IF v_producto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_producto_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Producto fuera de la empresa del usuario';
  END IF;

  PERFORM public.actualizar_stock(
    p_producto_id,
    p_variante_id,
    p_bodega_id,
    p_cantidad,
    p_tipo,
    p_documento_id,
    p_precio_costo,
    p_numero_lote
  );
END;
$$;

-- Endurecer políticas de inventario para evitar escritura directa por roles no autorizados.
DROP POLICY IF EXISTS "gestionar stock" ON stock;
CREATE POLICY "gestionar stock" ON stock
  FOR ALL
  USING (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
    AND get_rol_nombre() IN ('admin', 'contador')
  );

DROP POLICY IF EXISTS "registrar movimientos stock" ON stock_movimientos;
CREATE POLICY "registrar movimientos stock" ON stock_movimientos
  FOR INSERT
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

-- Endurecer search_path en funciones SECURITY DEFINER ya existentes.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_empresa_id',
        'get_rol_nombre',
        'siguiente_consecutivo',
        'actualizar_stock',
        'generar_asiento_factura_venta',
        'generar_asiento_recibo_venta',
        'generar_asiento_factura_compra',
        'crear_factura_venta',
        'crear_recibo_venta',
        'crear_factura_compra',
        'crear_pago_compra',
        'crear_gasto',
        'crear_nota_credito',
        'crear_nota_debito',
        'get_kpis_dashboard',
        'get_resumen_mensual'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
  END LOOP;
END $$;

-- Limitar superficie de ejecución directa.
REVOKE ALL ON FUNCTION public.assert_authenticated_empresa(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_authenticated_empresa(text[]) TO service_role;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_empresa_id',
        'get_rol_nombre',
        'siguiente_consecutivo',
        'actualizar_stock',
        'generar_asiento_factura_venta',
        'generar_asiento_recibo_venta',
        'generar_asiento_factura_compra',
        'crear_factura_venta',
        'crear_recibo_venta',
        'crear_factura_compra',
        'crear_pago_compra',
        'crear_gasto',
        'crear_nota_credito',
        'crear_nota_debito',
        'get_kpis_dashboard',
        'get_resumen_mensual'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF fn::text LIKE 'get_empresa_id(%' OR fn::text LIKE 'get_rol_nombre(%' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.secure_crear_factura_venta(uuid, text, uuid, uuid, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_recibo_venta(uuid, uuid, uuid, numeric, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_factura_compra(uuid, uuid, uuid, date, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_pago_compra(uuid, uuid, uuid, numeric, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_gasto(uuid, uuid, uuid, uuid, date, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_nota_credito(uuid, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_crear_nota_debito(uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_actualizar_stock(uuid, uuid, uuid, numeric, text, uuid, numeric, text) TO authenticated, service_role;
