-- ============================================================
-- MIGRACIÓN 039 — ASSERT_PERIODO: AUTO-CREAR EN VEZ DE BLOQUEAR
-- Si no existe periodo contable para la fecha, lo crea
-- automáticamente (junto con el ejercicio si es necesario).
-- Solo bloquea si el periodo existe y está "cerrado".
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_periodo_contable_abierto(p_empresa_id UUID, p_fecha DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo RECORD;
  v_ejercicio_id UUID;
  v_año INTEGER;
  v_mes INTEGER;
  v_mes_inicio DATE;
  v_mes_fin DATE;
BEGIN
  -- 1. Buscar periodo existente
  SELECT id, estado
  INTO v_periodo
  FROM periodos_contables
  WHERE empresa_id = p_empresa_id
    AND fecha_inicio <= p_fecha
    AND fecha_fin >= p_fecha
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_periodo.estado = 'cerrado' THEN
      RAISE EXCEPTION 'El periodo contable correspondiente a la fecha % está cerrado', p_fecha;
    END IF;
    RETURN v_periodo.id;
  END IF;

  -- 2. No existe periodo → auto-crear
  v_año := EXTRACT(YEAR FROM p_fecha)::INTEGER;
  v_mes := EXTRACT(MONTH FROM p_fecha)::INTEGER;

  -- 2a. Asegurar que exista el ejercicio
  SELECT id INTO v_ejercicio_id
  FROM ejercicios
  WHERE empresa_id = p_empresa_id AND año = v_año
  LIMIT 1;

  IF v_ejercicio_id IS NULL THEN
    INSERT INTO ejercicios (empresa_id, año, fecha_inicio, fecha_fin, estado)
    VALUES (p_empresa_id, v_año, (v_año || '-01-01')::DATE, (v_año || '-12-31')::DATE, 'activo')
    ON CONFLICT (empresa_id, año) DO NOTHING
    RETURNING id INTO v_ejercicio_id;

    -- Si ON CONFLICT, buscar el existente
    IF v_ejercicio_id IS NULL THEN
      SELECT id INTO v_ejercicio_id
      FROM ejercicios
      WHERE empresa_id = p_empresa_id AND año = v_año
      LIMIT 1;
    END IF;
  END IF;

  -- El trigger sync_periodos_contables_after_ejercicio pudo haber creado los periodos
  -- Re-buscar
  SELECT id, estado
  INTO v_periodo
  FROM periodos_contables
  WHERE empresa_id = p_empresa_id
    AND fecha_inicio <= p_fecha
    AND fecha_fin >= p_fecha
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_periodo.estado = 'cerrado' THEN
      RAISE EXCEPTION 'El periodo contable correspondiente a la fecha % está cerrado', p_fecha;
    END IF;
    RETURN v_periodo.id;
  END IF;

  -- 2b. Crear periodo directamente si el trigger no lo generó
  IF v_ejercicio_id IS NOT NULL THEN
    v_mes_inicio := (v_año || '-' || LPAD(v_mes::TEXT, 2, '0') || '-01')::DATE;
    v_mes_fin := (v_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    INSERT INTO periodos_contables (empresa_id, ejercicio_id, año, mes, fecha_inicio, fecha_fin, estado)
    VALUES (p_empresa_id, v_ejercicio_id, v_año, v_mes, v_mes_inicio, v_mes_fin, 'abierto')
    ON CONFLICT (ejercicio_id, mes) DO NOTHING
    RETURNING id INTO v_periodo;

    IF v_periodo IS NOT NULL THEN
      RETURN v_periodo.id;
    END IF;

    -- ON CONFLICT → re-buscar
    SELECT id, estado
    INTO v_periodo
    FROM periodos_contables
    WHERE empresa_id = p_empresa_id
      AND ejercicio_id = v_ejercicio_id
      AND mes = v_mes
    LIMIT 1;

    IF FOUND THEN
      IF v_periodo.estado = 'cerrado' THEN
        RAISE EXCEPTION 'El periodo contable correspondiente a la fecha % está cerrado', p_fecha;
      END IF;
      RETURN v_periodo.id;
    END IF;
  END IF;

  -- 3. No se pudo crear → permitir la operación (no bloquear)
  RETURN NULL;
END;
$$;
