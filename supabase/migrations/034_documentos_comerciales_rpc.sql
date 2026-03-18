-- RPC versionadas para cotizaciones, pedidos, remisiones y ordenes de compra.
-- El empresa_id se deriva de la sesion autenticada y no depende de estado manual
-- fuera de supabase/migrations.

CREATE OR REPLACE FUNCTION public.crear_documento_comercial(
  p_empresa_id uuid,
  p_tipo text,
  p_ejercicio_id uuid,
  p_cliente_id uuid,
  p_proveedor_id uuid,
  p_bodega_id uuid,
  p_fecha date,
  p_vencimiento date,
  p_observaciones text,
  p_estado text,
  p_lineas jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_id uuid;
  v_num integer;
  v_prefijo text;
  v_serie_id uuid;
  v_subtotal numeric(15,2) := 0;
  v_total_iva numeric(15,2) := 0;
  v_total_descuento numeric(15,2) := 0;
  v_total numeric(15,2) := 0;
  v_total_costo numeric(15,2) := 0;
  v_linea jsonb;
  v_linea_index integer := 0;
  v_producto_id uuid;
  v_variante_id uuid;
  v_impuesto_id uuid;
  v_cantidad numeric(15,3);
  v_precio_unitario numeric(15,2);
  v_descuento_pct numeric(5,2);
  v_linea_subtotal numeric(15,2);
  v_linea_descuento numeric(15,2);
  v_linea_iva numeric(15,2);
  v_linea_total numeric(15,2);
  v_iva_pct numeric(5,2) := 0;
  v_precio_costo numeric(15,2) := 0;
  v_producto_descripcion text;
BEGIN
  IF p_tipo NOT IN ('cotizacion', 'pedido', 'remision', 'orden_compra') THEN
    RAISE EXCEPTION 'Tipo de documento no soportado: %', p_tipo;
  END IF;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'El documento debe tener al menos una linea';
  END IF;

  IF p_tipo = 'orden_compra' THEN
    IF p_proveedor_id IS NULL THEN
      RAISE EXCEPTION 'Proveedor requerido';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM proveedores
      WHERE id = p_proveedor_id
        AND empresa_id = p_empresa_id
    ) THEN
      RAISE EXCEPTION 'Proveedor fuera de la empresa';
    END IF;
  ELSE
    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Cliente requerido';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM clientes
      WHERE id = p_cliente_id
        AND empresa_id = p_empresa_id
    ) THEN
      RAISE EXCEPTION 'Cliente fuera de la empresa';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM ejercicios
    WHERE id = p_ejercicio_id
      AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Ejercicio fuera de la empresa';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM bodegas
    WHERE id = p_bodega_id
      AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Bodega fuera de la empresa';
  END IF;

  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM public.siguiente_consecutivo(p_empresa_id, p_tipo);

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_linea_index := v_linea_index + 1;
    v_producto_id := NULLIF(v_linea->>'producto_id', '')::uuid;
    v_variante_id := NULLIF(v_linea->>'variante_id', '')::uuid;
    v_impuesto_id := NULLIF(v_linea->>'impuesto_id', '')::uuid;
    v_cantidad := COALESCE(NULLIF(v_linea->>'cantidad', '')::numeric, 0);
    v_precio_unitario := COALESCE(NULLIF(v_linea->>'precio_unitario', '')::numeric, 0);
    v_descuento_pct := COALESCE(NULLIF(v_linea->>'descuento_porcentaje', '')::numeric, 0);

    IF v_producto_id IS NULL THEN
      RAISE EXCEPTION 'La linea % no tiene producto_id', v_linea_index;
    END IF;

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La linea % debe tener cantidad positiva', v_linea_index;
    END IF;

    IF v_precio_unitario < 0 THEN
      RAISE EXCEPTION 'La linea % no puede tener precio negativo', v_linea_index;
    END IF;

    IF v_descuento_pct < 0 OR v_descuento_pct > 100 THEN
      RAISE EXCEPTION 'La linea % tiene un descuento invalido', v_linea_index;
    END IF;

    SELECT
      p.descripcion,
      COALESCE(pv.precio_compra, p.precio_compra, 0)
    INTO v_producto_descripcion, v_precio_costo
    FROM productos p
    LEFT JOIN producto_variantes pv
      ON pv.id = v_variante_id
     AND pv.producto_id = p.id
    WHERE p.id = v_producto_id
      AND p.empresa_id = p_empresa_id;

    IF v_producto_descripcion IS NULL THEN
      RAISE EXCEPTION 'Producto fuera de la empresa o inexistente en linea %', v_linea_index;
    END IF;

    IF v_variante_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM producto_variantes pv
      JOIN productos p ON p.id = pv.producto_id
      WHERE pv.id = v_variante_id
        AND pv.producto_id = v_producto_id
        AND p.empresa_id = p_empresa_id
    ) THEN
      RAISE EXCEPTION 'Variante invalida en linea %', v_linea_index;
    END IF;

    IF v_impuesto_id IS NOT NULL THEN
      SELECT porcentaje
      INTO v_iva_pct
      FROM impuestos
      WHERE id = v_impuesto_id
        AND empresa_id = p_empresa_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Impuesto invalido en linea %', v_linea_index;
      END IF;
    ELSE
      v_iva_pct := 0;
    END IF;

    v_linea_subtotal := ROUND(v_cantidad * v_precio_unitario, 2);
    v_linea_descuento := ROUND(v_linea_subtotal * v_descuento_pct / 100, 2);
    v_linea_iva := ROUND((v_linea_subtotal - v_linea_descuento) * COALESCE(v_iva_pct, 0) / 100, 2);
    v_linea_total := ROUND(v_linea_subtotal - v_linea_descuento + v_linea_iva, 2);

    v_subtotal := v_subtotal + v_linea_subtotal;
    v_total_descuento := v_total_descuento + v_linea_descuento;
    v_total_iva := v_total_iva + v_linea_iva;
    v_total := v_total + v_linea_total;
    v_total_costo := v_total_costo + ROUND(v_precio_costo * v_cantidad, 2);
  END LOOP;

  INSERT INTO documentos (
    empresa_id,
    tipo,
    numero,
    serie_id,
    prefijo,
    cliente_id,
    proveedor_id,
    bodega_id,
    ejercicio_id,
    fecha,
    fecha_vencimiento,
    subtotal,
    total_iva,
    total_descuento,
    total,
    total_costo,
    estado,
    observaciones,
    created_by
  ) VALUES (
    p_empresa_id,
    p_tipo,
    v_num,
    v_serie_id,
    v_prefijo,
    p_cliente_id,
    p_proveedor_id,
    p_bodega_id,
    p_ejercicio_id,
    p_fecha,
    p_vencimiento,
    v_subtotal,
    v_total_iva,
    v_total_descuento,
    v_total,
    v_total_costo,
    p_estado,
    p_observaciones,
    auth.uid()
  ) RETURNING id INTO v_doc_id;

  v_linea_index := 0;
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_linea_index := v_linea_index + 1;
    v_producto_id := NULLIF(v_linea->>'producto_id', '')::uuid;
    v_variante_id := NULLIF(v_linea->>'variante_id', '')::uuid;
    v_impuesto_id := NULLIF(v_linea->>'impuesto_id', '')::uuid;
    v_cantidad := COALESCE(NULLIF(v_linea->>'cantidad', '')::numeric, 0);
    v_precio_unitario := COALESCE(NULLIF(v_linea->>'precio_unitario', '')::numeric, 0);
    v_descuento_pct := COALESCE(NULLIF(v_linea->>'descuento_porcentaje', '')::numeric, 0);

    SELECT
      p.descripcion,
      COALESCE(pv.precio_compra, p.precio_compra, 0)
    INTO v_producto_descripcion, v_precio_costo
    FROM productos p
    LEFT JOIN producto_variantes pv
      ON pv.id = v_variante_id
     AND pv.producto_id = p.id
    WHERE p.id = v_producto_id
      AND p.empresa_id = p_empresa_id;

    IF v_impuesto_id IS NOT NULL THEN
      SELECT porcentaje
      INTO v_iva_pct
      FROM impuestos
      WHERE id = v_impuesto_id
        AND empresa_id = p_empresa_id;
    ELSE
      v_iva_pct := 0;
    END IF;

    v_linea_subtotal := ROUND(v_cantidad * v_precio_unitario, 2);
    v_linea_descuento := ROUND(v_linea_subtotal * v_descuento_pct / 100, 2);
    v_linea_iva := ROUND((v_linea_subtotal - v_linea_descuento) * COALESCE(v_iva_pct, 0) / 100, 2);
    v_linea_total := ROUND(v_linea_subtotal - v_linea_descuento + v_linea_iva, 2);

    INSERT INTO documentos_lineas (
      documento_id,
      producto_id,
      variante_id,
      descripcion,
      cantidad,
      precio_unitario,
      precio_costo,
      descuento_porcentaje,
      impuesto_id,
      subtotal,
      total_descuento,
      total_iva,
      total,
      orden
    ) VALUES (
      v_doc_id,
      v_producto_id,
      v_variante_id,
      COALESCE(NULLIF(v_linea->>'descripcion', ''), v_producto_descripcion),
      v_cantidad,
      v_precio_unitario,
      v_precio_costo,
      v_descuento_pct,
      v_impuesto_id,
      v_linea_subtotal,
      v_linea_descuento,
      v_linea_iva,
      v_linea_total,
      v_linea_index
    );
  END LOOP;

  RETURN v_doc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_cotizacion(
  p_empresa_id uuid DEFAULT NULL,
  p_ejercicio_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_bodega_id uuid DEFAULT NULL,
  p_fecha date DEFAULT NULL,
  p_vencimiento date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_lineas jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor']);

  IF p_empresa_id IS NOT NULL AND p_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'empresa_id no coincide con la sesion';
  END IF;

  RETURN public.crear_documento_comercial(
    v_empresa_id,
    'cotizacion',
    p_ejercicio_id,
    p_cliente_id,
    NULL,
    p_bodega_id,
    COALESCE(p_fecha, CURRENT_DATE),
    COALESCE(p_vencimiento, COALESCE(p_fecha, CURRENT_DATE)),
    p_observaciones,
    'borrador',
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_ejercicio_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_bodega_id uuid DEFAULT NULL,
  p_fecha date DEFAULT NULL,
  p_vencimiento date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_lineas jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor']);

  IF p_empresa_id IS NOT NULL AND p_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'empresa_id no coincide con la sesion';
  END IF;

  RETURN public.crear_documento_comercial(
    v_empresa_id,
    'pedido',
    p_ejercicio_id,
    p_cliente_id,
    NULL,
    p_bodega_id,
    COALESCE(p_fecha, CURRENT_DATE),
    COALESCE(p_vencimiento, COALESCE(p_fecha, CURRENT_DATE)),
    p_observaciones,
    'pendiente',
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_remision(
  p_empresa_id uuid DEFAULT NULL,
  p_ejercicio_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_bodega_id uuid DEFAULT NULL,
  p_fecha date DEFAULT NULL,
  p_vencimiento date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_lineas jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador', 'vendedor']);

  IF p_empresa_id IS NOT NULL AND p_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'empresa_id no coincide con la sesion';
  END IF;

  RETURN public.crear_documento_comercial(
    v_empresa_id,
    'remision',
    p_ejercicio_id,
    p_cliente_id,
    NULL,
    p_bodega_id,
    COALESCE(p_fecha, CURRENT_DATE),
    COALESCE(p_vencimiento, COALESCE(p_fecha, CURRENT_DATE)),
    p_observaciones,
    'borrador',
    p_lineas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_orden_compra(
  p_empresa_id uuid DEFAULT NULL,
  p_ejercicio_id uuid DEFAULT NULL,
  p_proveedor_id uuid DEFAULT NULL,
  p_bodega_id uuid DEFAULT NULL,
  p_fecha date DEFAULT NULL,
  p_vencimiento date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_lineas jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.assert_authenticated_empresa(ARRAY['admin', 'contador']);

  IF p_empresa_id IS NOT NULL AND p_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'empresa_id no coincide con la sesion';
  END IF;

  RETURN public.crear_documento_comercial(
    v_empresa_id,
    'orden_compra',
    p_ejercicio_id,
    NULL,
    p_proveedor_id,
    p_bodega_id,
    COALESCE(p_fecha, CURRENT_DATE),
    COALESCE(p_vencimiento, COALESCE(p_fecha, CURRENT_DATE)),
    p_observaciones,
    'borrador',
    p_lineas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_documento_comercial(uuid, text, uuid, uuid, uuid, uuid, date, date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_documento_comercial(uuid, text, uuid, uuid, uuid, uuid, date, date, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.crear_cotizacion(uuid, uuid, uuid, uuid, date, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_pedido(uuid, uuid, uuid, uuid, date, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_remision(uuid, uuid, uuid, uuid, date, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_orden_compra(uuid, uuid, uuid, uuid, date, date, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.crear_cotizacion(uuid, uuid, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_pedido(uuid, uuid, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_remision(uuid, uuid, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_orden_compra(uuid, uuid, uuid, uuid, date, date, text, jsonb) TO authenticated, service_role;
