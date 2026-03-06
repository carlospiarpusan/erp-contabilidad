-- ============================================================
-- MIGRACIÓN 011 — NOTA CRÉDITO / DEVOLUCIONES
-- ============================================================

-- Agregar columna para referenciar el documento origen (factura original)
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS documento_origen_id UUID REFERENCES documentos(id);

-- Agregar columna para motivo de la nota crédito
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS motivo TEXT;

-- ──────────────────────────────────────────────────────────────
-- FUNCIÓN: crear_nota_credito
-- Crea una nota crédito que revierte (total o parcialmente)
-- una factura de venta, devuelve stock y genera asiento inverso.
--
-- p_lineas es un JSON array de objetos:
--   [{ "linea_id": "uuid", "cantidad": 2 }, ...]
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_nota_credito(
  p_empresa_id    UUID,
  p_ejercicio_id  UUID,
  p_factura_id    UUID,
  p_motivo        TEXT,
  p_lineas        JSONB  -- array de {linea_id, cantidad}
) RETURNS UUID AS $$
DECLARE
  v_factura       RECORD;
  v_doc_id        UUID;
  v_num           INTEGER;
  v_prefijo       TEXT;
  v_serie_id      UUID;
  v_asiento_id    UUID;
  v_asiento_num   INTEGER;
  v_subtotal      DECIMAL := 0;
  v_total_iva     DECIMAL := 0;
  v_total_desc    DECIMAL := 0;
  v_total         DECIMAL := 0;
  v_linea         RECORD;
  v_item          JSONB;
  v_cant_devuelta DECIMAL;
  v_cuenta        RECORD;
BEGIN
  -- 1. Obtener la factura original
  SELECT * INTO v_factura
  FROM documentos
  WHERE id = p_factura_id
    AND empresa_id = p_empresa_id
    AND tipo = 'factura_venta'
    AND estado != 'cancelada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada o ya cancelada: %', p_factura_id;
  END IF;

  -- 2. Obtener consecutivo para nota_credito
  SELECT numero, prefijo, serie_id
  INTO v_num, v_prefijo, v_serie_id
  FROM siguiente_consecutivo(p_empresa_id, 'nota_credito');

  -- 3. Pre-calcular totales de la nota crédito
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    SELECT dl.*
    INTO v_linea
    FROM documentos_lineas dl
    WHERE dl.id = (v_item->>'linea_id')::UUID
      AND dl.documento_id = p_factura_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Línea % no pertenece a la factura %', v_item->>'linea_id', p_factura_id;
    END IF;

    v_cant_devuelta := (v_item->>'cantidad')::DECIMAL;

    IF v_cant_devuelta <= 0 OR v_cant_devuelta > v_linea.cantidad THEN
      RAISE EXCEPTION 'Cantidad a devolver inválida: % (máximo %)', v_cant_devuelta, v_linea.cantidad;
    END IF;

    v_subtotal    := v_subtotal    + ROUND(v_linea.subtotal    / v_linea.cantidad * v_cant_devuelta, 2);
    v_total_iva   := v_total_iva   + ROUND(v_linea.total_iva   / v_linea.cantidad * v_cant_devuelta, 2);
    v_total_desc  := v_total_desc  + ROUND(v_linea.total_descuento / v_linea.cantidad * v_cant_devuelta, 2);
    v_total       := v_total       + ROUND(v_linea.total       / v_linea.cantidad * v_cant_devuelta, 2);
  END LOOP;

  -- 4. Crear documento nota_credito
  INSERT INTO documentos (
    empresa_id, ejercicio_id, tipo, numero, prefijo, serie_id,
    cliente_id, bodega_id, forma_pago_id, colaborador_id,
    fecha, fecha_vencimiento,
    subtotal, total_iva, total_descuento, total, total_costo,
    estado, observaciones,
    documento_origen_id, motivo
  )
  SELECT
    p_empresa_id, p_ejercicio_id, 'nota_credito', v_num, v_prefijo, v_serie_id,
    v_factura.cliente_id, v_factura.bodega_id, v_factura.forma_pago_id, v_factura.colaborador_id,
    CURRENT_DATE, CURRENT_DATE,
    v_subtotal, v_total_iva, v_total_desc, v_total, 0,
    'pagada', p_motivo,
    p_factura_id, p_motivo
  RETURNING id INTO v_doc_id;

  -- 5. Crear líneas y devolver stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    SELECT dl.*
    INTO v_linea
    FROM documentos_lineas dl
    WHERE dl.id = (v_item->>'linea_id')::UUID;

    v_cant_devuelta := (v_item->>'cantidad')::DECIMAL;

    -- Insertar línea de nota crédito
    INSERT INTO documentos_lineas (
      documento_id, producto_id, variante_id,
      descripcion, cantidad,
      precio_unitario, precio_costo,
      descuento_porcentaje, impuesto_id,
      subtotal, total_descuento, total_iva, total
    )
    SELECT
      v_doc_id, v_linea.producto_id, v_linea.variante_id,
      v_linea.descripcion, v_cant_devuelta,
      v_linea.precio_unitario, v_linea.precio_costo,
      v_linea.descuento_porcentaje, v_linea.impuesto_id,
      ROUND(v_linea.subtotal    / v_linea.cantidad * v_cant_devuelta, 2),
      ROUND(v_linea.total_descuento / v_linea.cantidad * v_cant_devuelta, 2),
      ROUND(v_linea.total_iva   / v_linea.cantidad * v_cant_devuelta, 2),
      ROUND(v_linea.total       / v_linea.cantidad * v_cant_devuelta, 2);

    -- Devolver stock al almacén
    IF v_linea.producto_id IS NOT NULL THEN
      PERFORM actualizar_stock(
        v_linea.producto_id,
        v_linea.variante_id,
        v_factura.bodega_id,
        v_cant_devuelta,         -- positivo = entrada (devolución)
        'entrada_devolucion',
        v_doc_id,
        v_linea.precio_costo
      );
    END IF;
  END LOOP;

  -- 6. Generar asiento contable inverso al de la factura
  --    CR Clientes (reducción cartera) / DB Ingresos + DB IVA
  SELECT numero INTO v_asiento_num
  FROM siguiente_consecutivo(p_empresa_id, 'asiento');

  INSERT INTO asientos (
    empresa_id, ejercicio_id, numero, tipo, tipo_doc,
    documento_id, concepto, fecha, importe
  ) VALUES (
    p_empresa_id, p_ejercicio_id, v_asiento_num,
    'automatico', 'nota_credito', v_doc_id,
    'NC ' || v_prefijo || v_num::TEXT || ' - Devolución FV ' || v_factura.prefijo || v_factura.numero::TEXT,
    CURRENT_DATE, v_total
  ) RETURNING id INTO v_asiento_id;

  -- CRÉDITO: Clientes (reduce la deuda del cliente)
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'clientes';
  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Reducción cartera cliente', 0, v_total);

  -- DÉBITO: Ingresos (revierte el ingreso)
  SELECT cuenta_id INTO v_cuenta
  FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'ingresos';
  INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
  VALUES (v_asiento_id, v_cuenta.cuenta_id, 'Devolución en ventas', v_subtotal, 0);

  -- DÉBITO: IVA (si aplica)
  IF v_total_iva > 0 THEN
    SELECT cuenta_id INTO v_cuenta
    FROM cuentas_especiales WHERE empresa_id = p_empresa_id AND tipo = 'iva_ventas';
    INSERT INTO asientos_lineas (asiento_id, cuenta_id, descripcion, debe, haber)
    VALUES (v_asiento_id, v_cuenta.cuenta_id, 'IVA devuelto', v_total_iva, 0);
  END IF;

  RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Índice para consultas por documento origen
CREATE INDEX IF NOT EXISTS idx_documentos_origen ON documentos(documento_origen_id) WHERE documento_origen_id IS NOT NULL;
