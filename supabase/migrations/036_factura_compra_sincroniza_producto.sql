-- ============================================================
-- MIGRACION 036 - FACTURA COMPRA SINCRONIZA PRODUCTO
-- 1. Usa costo unitario neto de descuento para inventario
-- 2. Sincroniza impuesto del producto desde la factura de compra
-- 3. Alinea importacion electronica con el mismo comportamiento
-- ============================================================

CREATE OR REPLACE FUNCTION public.crear_factura_compra(
  p_empresa_id     UUID,
  p_ejercicio_id   UUID,
  p_proveedor_id   UUID,
  p_bodega_id      UUID,
  p_fecha          DATE,
  p_numero_externo TEXT,
  p_observaciones  TEXT,
  p_lineas         JSONB
) RETURNS UUID AS $$
DECLARE
  v_doc_id UUID;
  v_num INTEGER;
  v_prefijo TEXT;
  v_serie_id UUID;
  v_subtotal DECIMAL := 0;
  v_total_iva DECIMAL := 0;
  v_total_dcto DECIMAL := 0;
  v_total DECIMAL := 0;
  v_linea JSONB;
  v_linea_sub DECIMAL;
  v_linea_dcto DECIMAL;
  v_linea_iva DECIMAL;
  v_linea_total DECIMAL;
  v_linea_costo_unitario DECIMAL;
  v_iva_pct DECIMAL;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_numero_externo_normalizado TEXT := NULLIF(BTRIM(COALESCE(p_numero_externo, '')), '');
  v_producto_id UUID;
  v_variante_id UUID;
  v_impuesto_id UUID;
  v_cantidad DECIMAL;
  v_precio_unitario DECIMAL;
BEGIN
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'La factura debe tener al menos una linea';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.proveedores
    WHERE id = p_proveedor_id
      AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Proveedor fuera de la empresa';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bodegas
    WHERE id = p_bodega_id
      AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Bodega fuera de la empresa';
  END IF;

  SELECT fecha_inicio, fecha_fin
  INTO v_fecha_inicio, v_fecha_fin
  FROM public.ejercicios
  WHERE id = p_ejercicio_id
    AND empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ejercicio fuera de la empresa';
  END IF;

  IF p_fecha < v_fecha_inicio OR p_fecha > v_fecha_fin THEN
    RAISE EXCEPTION 'La fecha % esta fuera del ejercicio % - %', p_fecha, v_fecha_inicio, v_fecha_fin;
  END IF;

  IF v_numero_externo_normalizado IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.documentos
    WHERE empresa_id = p_empresa_id
      AND tipo = 'factura_compra'
      AND proveedor_id = p_proveedor_id
      AND lower(btrim(numero_externo)) = lower(v_numero_externo_normalizado)
  ) THEN
    RAISE EXCEPTION 'Ya existe una factura de compra para ese proveedor con numero_externo %', v_numero_externo_normalizado;
  END IF;

  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM public.siguiente_consecutivo(p_empresa_id, 'factura_compra');

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_cantidad := COALESCE(NULLIF(v_linea->>'cantidad', '')::DECIMAL, 0);
    v_precio_unitario := COALESCE(NULLIF(v_linea->>'precio_unitario', '')::DECIMAL, 0);
    v_linea_sub := v_cantidad * v_precio_unitario;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;

    SELECT porcentaje
    INTO v_iva_pct
    FROM public.impuestos
    WHERE id = NULLIF(v_linea->>'impuesto_id', '')::UUID;

    v_linea_iva := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;
    v_subtotal := v_subtotal + v_linea_sub;
    v_total_dcto := v_total_dcto + v_linea_dcto;
    v_total_iva := v_total_iva + v_linea_iva;
    v_total := v_total + v_linea_total;
  END LOOP;

  INSERT INTO public.documentos (
    empresa_id, tipo, numero, serie_id, prefijo,
    proveedor_id, bodega_id, ejercicio_id,
    fecha, numero_externo,
    subtotal, total_iva, total_descuento, total,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, 'factura_compra', v_num, v_serie_id, v_prefijo,
    p_proveedor_id, p_bodega_id, p_ejercicio_id,
    p_fecha, v_numero_externo_normalizado,
    v_subtotal, v_total_iva, v_total_dcto, v_total,
    'pendiente', p_observaciones, auth.uid()
  ) RETURNING id INTO v_doc_id;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_producto_id := NULLIF(v_linea->>'producto_id', '')::UUID;
    v_variante_id := NULLIF(v_linea->>'variante_id', '')::UUID;
    v_impuesto_id := NULLIF(v_linea->>'impuesto_id', '')::UUID;
    v_cantidad := COALESCE(NULLIF(v_linea->>'cantidad', '')::DECIMAL, 0);
    v_precio_unitario := COALESCE(NULLIF(v_linea->>'precio_unitario', '')::DECIMAL, 0);
    v_linea_sub := v_cantidad * v_precio_unitario;
    v_linea_dcto := v_linea_sub * COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0) / 100;

    SELECT porcentaje
    INTO v_iva_pct
    FROM public.impuestos
    WHERE id = v_impuesto_id;

    v_linea_iva := (v_linea_sub - v_linea_dcto) * COALESCE(v_iva_pct, 0) / 100;
    v_linea_total := v_linea_sub - v_linea_dcto + v_linea_iva;
    v_linea_costo_unitario := CASE
      WHEN v_cantidad <> 0 THEN ROUND((v_linea_sub - v_linea_dcto) / v_cantidad, 2)
      ELSE v_precio_unitario
    END;

    INSERT INTO public.documentos_lineas (
      documento_id, producto_id, variante_id, descripcion,
      cantidad, precio_unitario, precio_costo, descuento_porcentaje,
      impuesto_id, subtotal, total_descuento, total_iva, total
    ) VALUES (
      v_doc_id,
      v_producto_id,
      v_variante_id,
      v_linea->>'descripcion',
      v_cantidad,
      v_precio_unitario,
      v_linea_costo_unitario,
      COALESCE((v_linea->>'descuento_porcentaje')::DECIMAL, 0),
      v_impuesto_id,
      v_linea_sub,
      v_linea_dcto,
      v_linea_iva,
      v_linea_total
    );

    PERFORM public.actualizar_stock(
      v_producto_id,
      v_variante_id,
      p_bodega_id,
      v_cantidad,
      'entrada_compra',
      v_doc_id,
      v_linea_costo_unitario
    );

    UPDATE public.productos
    SET
      precio_compra = v_linea_costo_unitario,
      impuesto_id = COALESCE(v_impuesto_id, impuesto_id),
      updated_at = NOW()
    WHERE id = v_producto_id
      AND empresa_id = p_empresa_id;
  END LOOP;

  PERFORM public.generar_asiento_factura_compra(v_doc_id);

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.importar_factura_electronica_compra(
  p_empresa_id uuid,
  p_ejercicio_id uuid,
  p_proveedor_id uuid,
  p_bodega_id uuid,
  p_fecha date,
  p_fecha_original date,
  p_numero_externo text,
  p_observaciones text,
  p_lineas jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linea jsonb;
  v_lineas_resueltas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_codigo_interno text;
  v_descripcion text;
  v_precio_venta numeric(15,2);
  v_gtin text;
  v_codigo_proveedor text;
  v_crear_equivalencia boolean;
  v_persistir_gtin boolean;
  v_codigo_ambiguo boolean;
  v_impuesto_id uuid;
  v_impuesto_pct numeric(5,2);
  v_observaciones text;
  v_doc_id uuid;
BEGIN
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Se requiere al menos una linea';
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    IF COALESCE(v_linea->>'accion', '') NOT IN ('usar_existente', 'crear_nuevo') THEN
      RAISE EXCEPTION 'Todas las lineas deben resolverse a un producto existente o nuevo';
    END IF;

    v_gtin := NULLIF(regexp_replace(COALESCE(v_linea->>'gtin', ''), '[^0-9]', '', 'g'), '');
    v_codigo_proveedor := NULLIF(upper(btrim(COALESCE(v_linea->>'codigo_proveedor', ''))), '');
    v_persistir_gtin := COALESCE(NULLIF(v_linea->>'persistir_gtin', '')::boolean, FALSE);
    v_crear_equivalencia := COALESCE(NULLIF(v_linea->>'crear_equivalencia', '')::boolean, FALSE);

    IF v_gtin IS NULL THEN
      SELECT COUNT(*) > 1
      INTO v_codigo_ambiguo
      FROM jsonb_array_elements(p_lineas) AS other_linea(value)
      WHERE NULLIF(regexp_replace(COALESCE(other_linea.value->>'gtin', ''), '[^0-9]', '', 'g'), '') IS NULL
        AND NULLIF(upper(btrim(COALESCE(other_linea.value->>'codigo_proveedor', ''))), '') = v_codigo_proveedor;
    ELSE
      v_codigo_ambiguo := FALSE;
    END IF;

    v_impuesto_pct := COALESCE(NULLIF(v_linea->>'porcentaje_iva', '')::numeric, 0);
    IF v_impuesto_pct > 0 THEN
      SELECT id
      INTO v_impuesto_id
      FROM public.impuestos
      WHERE empresa_id = p_empresa_id
        AND ROUND(COALESCE(porcentaje, 0)::numeric, 2) = ROUND(v_impuesto_pct, 2)
      ORDER BY id
      LIMIT 1;
    ELSE
      v_impuesto_id := NULL;
    END IF;

    IF v_linea->>'accion' = 'usar_existente' THEN
      v_producto_id := NULLIF(v_linea->>'producto_id', '')::uuid;
      IF v_producto_id IS NULL THEN
        RAISE EXCEPTION 'Las lineas con producto existente requieren producto_id';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.productos
        WHERE id = v_producto_id
          AND empresa_id = p_empresa_id
      ) THEN
        RAISE EXCEPTION 'El producto seleccionado no pertenece a la empresa';
      END IF;

      IF v_persistir_gtin AND v_gtin IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM public.productos
          WHERE empresa_id = p_empresa_id
            AND codigo_barras = v_gtin
            AND id <> v_producto_id
        ) THEN
          RAISE EXCEPTION 'El GTIN % ya esta asignado a otro producto', v_gtin;
        END IF;

        UPDATE public.productos
        SET
          codigo_barras = CASE
            WHEN codigo_barras IS NULL OR codigo_barras = v_gtin THEN v_gtin
            ELSE codigo_barras
          END,
          updated_at = NOW()
        WHERE id = v_producto_id
          AND empresa_id = p_empresa_id;

        IF EXISTS (
          SELECT 1
          FROM public.productos
          WHERE id = v_producto_id
            AND empresa_id = p_empresa_id
            AND codigo_barras IS NOT NULL
            AND codigo_barras <> v_gtin
        ) THEN
          RAISE EXCEPTION 'El producto seleccionado ya tiene un codigo_barras distinto al GTIN importado';
        END IF;
      END IF;

      UPDATE public.productos
      SET
        precio_compra = COALESCE(NULLIF(v_linea->>'precio_unitario', '')::numeric, precio_compra),
        impuesto_id = COALESCE(v_impuesto_id, impuesto_id),
        updated_at = NOW()
      WHERE id = v_producto_id
        AND empresa_id = p_empresa_id;
    ELSE
      v_codigo_interno := NULLIF(upper(btrim(COALESCE(v_linea->>'nuevo_codigo', ''))), '');
      v_descripcion := COALESCE(NULLIF(btrim(COALESCE(v_linea->>'nueva_descripcion', '')), ''), NULLIF(btrim(COALESCE(v_linea->>'descripcion', '')), ''));
      v_precio_venta := COALESCE(NULLIF(v_linea->>'nuevo_precio_venta', '')::numeric, NULLIF(v_linea->>'precio_unitario', '')::numeric, 0);

      IF v_codigo_interno IS NULL THEN
        RAISE EXCEPTION 'Los productos nuevos requieren nuevo_codigo';
      END IF;

      IF v_descripcion IS NULL THEN
        RAISE EXCEPTION 'Los productos nuevos requieren descripcion';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.productos
        WHERE empresa_id = p_empresa_id
          AND codigo = v_codigo_interno
      ) THEN
        RAISE EXCEPTION 'Ya existe un producto con codigo %', v_codigo_interno;
      END IF;

      IF v_persistir_gtin AND v_gtin IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.productos
        WHERE empresa_id = p_empresa_id
          AND codigo_barras = v_gtin
      ) THEN
        RAISE EXCEPTION 'El GTIN % ya esta asignado a otro producto', v_gtin;
      END IF;

      INSERT INTO public.productos (
        empresa_id,
        codigo,
        codigo_barras,
        descripcion,
        precio_venta,
        precio_compra,
        impuesto_id,
        activo,
        updated_at
      ) VALUES (
        p_empresa_id,
        v_codigo_interno,
        CASE WHEN v_persistir_gtin AND v_gtin IS NOT NULL THEN v_gtin ELSE NULL END,
        v_descripcion,
        v_precio_venta,
        COALESCE(NULLIF(v_linea->>'precio_unitario', '')::numeric, 0),
        v_impuesto_id,
        TRUE,
        NOW()
      ) RETURNING id INTO v_producto_id;
    END IF;

    IF v_crear_equivalencia AND (v_gtin IS NOT NULL OR (v_codigo_proveedor IS NOT NULL AND NOT v_codigo_ambiguo)) THEN
      PERFORM public.upsert_producto_codigo_proveedor(
        p_empresa_id,
        p_proveedor_id,
        v_producto_id,
        v_codigo_proveedor,
        v_gtin,
        v_linea->>'descripcion'
      );
    END IF;

    v_lineas_resueltas := v_lineas_resueltas || jsonb_build_array(
      jsonb_build_object(
        'producto_id', v_producto_id,
        'variante_id', NULL,
        'descripcion', COALESCE(NULLIF(btrim(COALESCE(v_linea->>'descripcion', '')), ''), 'Importacion factura electronica'),
        'cantidad', COALESCE(NULLIF(v_linea->>'cantidad', '')::numeric, 0),
        'precio_unitario', COALESCE(NULLIF(v_linea->>'precio_unitario', '')::numeric, 0),
        'descuento_porcentaje', 0,
        'impuesto_id', v_impuesto_id
      )
    );
  END LOOP;

  v_observaciones := concat_ws(
    E'\n',
    NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''),
    'Importada desde factura electronica',
    CASE
      WHEN p_fecha_original IS NOT NULL THEN 'Fecha DIAN original: ' || p_fecha_original::text
      ELSE NULL
    END
  );

  v_doc_id := public.crear_factura_compra(
    p_empresa_id,
    p_ejercicio_id,
    p_proveedor_id,
    p_bodega_id,
    p_fecha,
    p_numero_externo,
    v_observaciones,
    v_lineas_resueltas
  );

  RETURN v_doc_id;
END;
$$;
