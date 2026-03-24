-- ============================================================
-- MIGRACIÓN 037 — CUMPLIMIENTO, PERIODOS, ADJUNTOS Y JOBS
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. Extensiones y ajustes base
-- ──────────────────────────────────────────────────────────────
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS obligado_a_facturar BOOLEAN DEFAULT TRUE;

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS documento_soporte_requerido BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS documento_soporte_estado TEXT DEFAULT 'no_requerido';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_documento_soporte_estado_check'
  ) THEN
    ALTER TABLE documentos
      ADD CONSTRAINT documentos_documento_soporte_estado_check
      CHECK (documento_soporte_estado IN ('no_requerido', 'pendiente', 'adjunto', 'validado', 'rechazado'));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 1. Configuración regulatoria por empresa
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion_regulatoria (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  UUID NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  obligado_fe                 BOOLEAN DEFAULT FALSE,
  usa_proveedor_fe            BOOLEAN DEFAULT FALSE,
  requiere_documento_soporte  BOOLEAN DEFAULT TRUE,
  reporta_exogena             BOOLEAN DEFAULT TRUE,
  usa_radian                  BOOLEAN DEFAULT FALSE,
  politica_datos_version      TEXT,
  politica_datos_url          TEXT,
  aviso_privacidad_url        TEXT,
  contacto_privacidad_email   TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE configuracion_regulatoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracion_regulatoria_select" ON configuracion_regulatoria;
CREATE POLICY "configuracion_regulatoria_select" ON configuracion_regulatoria
  FOR SELECT USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS "configuracion_regulatoria_manage" ON configuracion_regulatoria;
CREATE POLICY "configuracion_regulatoria_manage" ON configuracion_regulatoria
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE TRIGGER set_updated_at_configuracion_regulatoria
  BEFORE UPDATE ON configuracion_regulatoria
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 2. UVT por vigencia
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uvt_vigencias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  año         INTEGER NOT NULL,
  valor       DECIMAL(15,2) NOT NULL,
  fuente      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, año)
);

ALTER TABLE uvt_vigencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uvt_vigencias_select" ON uvt_vigencias;
CREATE POLICY "uvt_vigencias_select" ON uvt_vigencias
  FOR SELECT USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS "uvt_vigencias_manage" ON uvt_vigencias;
CREATE POLICY "uvt_vigencias_manage" ON uvt_vigencias
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE TRIGGER set_updated_at_uvt_vigencias
  BEFORE UPDATE ON uvt_vigencias
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 3. Consentimientos mínimos de privacidad
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consentimientos_privacidad (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo         TEXT NOT NULL DEFAULT 'politica_tratamiento',
  version      TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  aceptado_en  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consentimientos_privacidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consentimientos_privacidad_select" ON consentimientos_privacidad;
CREATE POLICY "consentimientos_privacidad_select" ON consentimientos_privacidad
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND (
      usuario_id = auth.uid()
      OR get_rol_nombre() IN ('admin', 'contador')
    )
  );

DROP POLICY IF EXISTS "consentimientos_privacidad_insert" ON consentimientos_privacidad;
CREATE POLICY "consentimientos_privacidad_insert" ON consentimientos_privacidad
  FOR INSERT WITH CHECK (
    empresa_id = get_empresa_id()
    AND (
      usuario_id = auth.uid()
      OR usuario_id IS NULL
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 4. Periodos contables mensuales
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS periodos_contables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ejercicio_id    UUID NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
  año             INTEGER NOT NULL,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'reabierto')),
  motivo          TEXT,
  cerrado_por     UUID REFERENCES auth.users(id),
  cerrado_at      TIMESTAMPTZ,
  reabierto_por   UUID REFERENCES auth.users(id),
  reabierto_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ejercicio_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_periodos_contables_empresa_fecha
  ON periodos_contables(empresa_id, fecha_inicio, fecha_fin, estado);

ALTER TABLE periodos_contables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periodos_contables_select" ON periodos_contables;
CREATE POLICY "periodos_contables_select" ON periodos_contables
  FOR SELECT USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS "periodos_contables_manage" ON periodos_contables;
CREATE POLICY "periodos_contables_manage" ON periodos_contables
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE TRIGGER set_updated_at_periodos_contables
  BEFORE UPDATE ON periodos_contables
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.regenerar_periodos_contables_desde_ejercicio(p_ejercicio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ejercicio RECORD;
  v_cursor DATE;
  v_mes_inicio DATE;
  v_mes_fin DATE;
BEGIN
  SELECT id, empresa_id, año, fecha_inicio, fecha_fin
  INTO v_ejercicio
  FROM ejercicios
  WHERE id = p_ejercicio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ejercicio no encontrado';
  END IF;

  v_cursor := date_trunc('month', v_ejercicio.fecha_inicio)::DATE;

  WHILE v_cursor <= v_ejercicio.fecha_fin LOOP
    v_mes_inicio := GREATEST(v_cursor, v_ejercicio.fecha_inicio);
    v_mes_fin := LEAST((date_trunc('month', v_cursor) + INTERVAL '1 month - 1 day')::DATE, v_ejercicio.fecha_fin);

    INSERT INTO periodos_contables (
      empresa_id,
      ejercicio_id,
      año,
      mes,
      fecha_inicio,
      fecha_fin
    ) VALUES (
      v_ejercicio.empresa_id,
      v_ejercicio.id,
      EXTRACT(YEAR FROM v_mes_inicio)::INTEGER,
      EXTRACT(MONTH FROM v_mes_inicio)::INTEGER,
      v_mes_inicio,
      v_mes_fin
    )
    ON CONFLICT (ejercicio_id, mes) DO UPDATE
      SET año = EXCLUDED.año,
          fecha_inicio = EXCLUDED.fecha_inicio,
          fecha_fin = EXCLUDED.fecha_fin;

    v_cursor := (date_trunc('month', v_cursor) + INTERVAL '1 month')::DATE;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_periodos_contables_from_ejercicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.regenerar_periodos_contables_desde_ejercicio(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_periodos_contables_after_ejercicio ON ejercicios;
CREATE TRIGGER sync_periodos_contables_after_ejercicio
  AFTER INSERT OR UPDATE OF fecha_inicio, fecha_fin ON ejercicios
  FOR EACH ROW EXECUTE FUNCTION public.sync_periodos_contables_from_ejercicio();

CREATE OR REPLACE FUNCTION public.assert_periodo_contable_abierto(p_empresa_id UUID, p_fecha DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_periodo RECORD;
BEGIN
  SELECT id, estado, fecha_inicio, fecha_fin
  INTO v_periodo
  FROM periodos_contables
  WHERE empresa_id = p_empresa_id
    AND fecha_inicio <= p_fecha
    AND fecha_fin >= p_fecha
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe periodo contable configurado para la fecha %', p_fecha;
  END IF;

  IF v_periodo.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El periodo contable correspondiente a la fecha % está cerrado', p_fecha;
  END IF;

  RETURN v_periodo.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_assert_documento_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.tipo IN ('cotizacion', 'pedido') THEN
    RETURN NEW;
  END IF;

  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_documento_periodo_abierto ON documentos;
CREATE TRIGGER assert_documento_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, estado ON documentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_documento_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_recibo_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_recibo_periodo_abierto ON recibos;
CREATE TRIGGER assert_recibo_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, valor ON recibos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_recibo_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_asiento_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_asiento_periodo_abierto ON asientos;
CREATE TRIGGER assert_asiento_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, concepto ON asientos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_asiento_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_traslado_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_traslado_periodo_abierto ON traslados;
CREATE TRIGGER assert_traslado_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, estado ON traslados
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_traslado_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_movimiento_bancario_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_movimiento_bancario_periodo_abierto ON movimientos_bancarios;
CREATE TRIGGER assert_movimiento_bancario_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, monto ON movimientos_bancarios
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_movimiento_bancario_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_pago_proveedor_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_pago_proveedor_periodo_abierto ON pagos_proveedores;
CREATE TRIGGER assert_pago_proveedor_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha, estado ON pagos_proveedores
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_pago_proveedor_periodo_abierto();

CREATE OR REPLACE FUNCTION public.trg_assert_conciliacion_periodo_abierto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.assert_periodo_contable_abierto(NEW.empresa_id, NEW.fecha_fin);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assert_conciliacion_periodo_abierto ON conciliaciones_bancarias;
CREATE TRIGGER assert_conciliacion_periodo_abierto
  BEFORE INSERT OR UPDATE OF fecha_inicio, fecha_fin, estado ON conciliaciones_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.trg_assert_conciliacion_periodo_abierto();

-- ──────────────────────────────────────────────────────────────
-- 5. Adjuntos privados
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_adjuntos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  bucket             TEXT NOT NULL DEFAULT 'adjuntos-privados',
  path               TEXT NOT NULL,
  nombre_archivo     TEXT NOT NULL,
  mime_type          TEXT,
  tamaño_bytes       BIGINT DEFAULT 0,
  sha256             TEXT,
  tipo_documental    TEXT NOT NULL,
  relacion_tipo      TEXT NOT NULL,
  relacion_id        UUID NOT NULL,
  documento_id       UUID REFERENCES documentos(id) ON DELETE CASCADE,
  asiento_id         UUID REFERENCES asientos(id) ON DELETE CASCADE,
  recibo_id          UUID REFERENCES recibos(id) ON DELETE CASCADE,
  pago_proveedor_id  UUID REFERENCES pagos_proveedores(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bucket, path)
);

CREATE INDEX IF NOT EXISTS idx_documentos_adjuntos_relacion
  ON documentos_adjuntos(empresa_id, relacion_tipo, relacion_id, created_at DESC);

ALTER TABLE documentos_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_adjuntos_select" ON documentos_adjuntos;
CREATE POLICY "documentos_adjuntos_select" ON documentos_adjuntos
  FOR SELECT USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS "documentos_adjuntos_manage" ON documentos_adjuntos;
CREATE POLICY "documentos_adjuntos_manage" ON documentos_adjuntos
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador', 'vendedor')
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('adjuntos-privados', 'adjuntos-privados', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 6. Documento soporte externo
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_soporte_externo (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  documento_id          UUID NOT NULL UNIQUE REFERENCES documentos(id) ON DELETE CASCADE,
  proveedor_id          UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  requerido             BOOLEAN DEFAULT TRUE,
  estado                TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('no_requerido', 'pendiente', 'adjunto', 'validado', 'rechazado')),
  proveedor_tecnologico TEXT,
  numero_externo        TEXT,
  fecha_emision         DATE,
  archivo_adjunto_id    UUID REFERENCES documentos_adjuntos(id) ON DELETE SET NULL,
  observaciones         TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_soporte_estado
  ON documentos_soporte_externo(empresa_id, estado, created_at DESC);

ALTER TABLE documentos_soporte_externo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_soporte_externo_select" ON documentos_soporte_externo;
CREATE POLICY "documentos_soporte_externo_select" ON documentos_soporte_externo
  FOR SELECT USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS "documentos_soporte_externo_manage" ON documentos_soporte_externo;
CREATE POLICY "documentos_soporte_externo_manage" ON documentos_soporte_externo
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE TRIGGER set_updated_at_documentos_soporte_externo
  BEFORE UPDATE ON documentos_soporte_externo
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.requires_documento_soporte(p_empresa_id UUID, p_proveedor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(cfg.requiere_documento_soporte, FALSE) AND COALESCE(NOT prov.obligado_a_facturar, FALSE)
  FROM proveedores prov
  LEFT JOIN configuracion_regulatoria cfg
    ON cfg.empresa_id = p_empresa_id
  WHERE prov.id = p_proveedor_id
$$;

CREATE OR REPLACE FUNCTION public.sync_documento_soporte_desde_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requerido BOOLEAN;
  v_estado TEXT;
BEGIN
  IF NEW.tipo <> 'factura_compra' THEN
    RETURN NEW;
  END IF;

  v_requerido := COALESCE(public.requires_documento_soporte(NEW.empresa_id, NEW.proveedor_id), FALSE);
  v_estado := CASE WHEN v_requerido THEN 'pendiente' ELSE 'no_requerido' END;

  INSERT INTO documentos_soporte_externo (
    empresa_id,
    documento_id,
    proveedor_id,
    requerido,
    estado,
    created_by
  ) VALUES (
    NEW.empresa_id,
    NEW.id,
    NEW.proveedor_id,
    v_requerido,
    v_estado,
    NEW.created_by
  )
  ON CONFLICT (documento_id) DO UPDATE
    SET proveedor_id = EXCLUDED.proveedor_id,
        requerido = EXCLUDED.requerido,
        estado = CASE
          WHEN EXCLUDED.requerido THEN
            CASE
              WHEN documentos_soporte_externo.estado = 'validado' THEN 'validado'
              WHEN documentos_soporte_externo.archivo_adjunto_id IS NOT NULL THEN 'adjunto'
              ELSE 'pendiente'
            END
          ELSE 'no_requerido'
        END;

  UPDATE documentos
  SET documento_soporte_requerido = v_requerido,
      documento_soporte_estado = (
        SELECT estado
        FROM documentos_soporte_externo
        WHERE documento_id = NEW.id
      )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_documento_soporte_compra ON documentos;
CREATE TRIGGER sync_documento_soporte_compra
  AFTER INSERT OR UPDATE OF proveedor_id ON documentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_documento_soporte_desde_compra();

CREATE OR REPLACE FUNCTION public.sync_estado_documento_desde_soporte()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE documentos
  SET documento_soporte_requerido = NEW.requerido,
      documento_soporte_estado = NEW.estado
  WHERE id = NEW.documento_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_estado_documento_desde_soporte ON documentos_soporte_externo;
CREATE TRIGGER sync_estado_documento_desde_soporte
  AFTER INSERT OR UPDATE OF requerido, estado ON documentos_soporte_externo
  FOR EACH ROW EXECUTE FUNCTION public.sync_estado_documento_desde_soporte();

-- ──────────────────────────────────────────────────────────────
-- 7. Observabilidad y jobs
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_event_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nivel       TEXT NOT NULL DEFAULT 'info',
  origen      TEXT NOT NULL,
  evento      TEXT NOT NULL,
  metodo      TEXT,
  ruta        TEXT,
  contexto    JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_event_logs_empresa_fecha
  ON app_event_logs(empresa_id, created_at DESC);

ALTER TABLE app_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_event_logs_select" ON app_event_logs;
CREATE POLICY "app_event_logs_select" ON app_event_logs
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

DROP POLICY IF EXISTS "app_event_logs_insert" ON app_event_logs;
CREATE POLICY "app_event_logs_insert" ON app_event_logs
  FOR INSERT WITH CHECK (empresa_id = get_empresa_id());

CREATE TABLE IF NOT EXISTS jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido', 'cancelado')),
  payload         JSONB NOT NULL DEFAULT '{}'::JSONB,
  resultado       JSONB,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  attempts        INTEGER DEFAULT 0,
  max_attempts    INTEGER DEFAULT 3,
  last_error      TEXT,
  locked_at       TIMESTAMPTZ,
  locked_by       TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_empresa_estado_run_at
  ON jobs(empresa_id, estado, run_at);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

DROP POLICY IF EXISTS "jobs_manage" ON jobs;
CREATE POLICY "jobs_manage" ON jobs
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE TRIGGER set_updated_at_jobs
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS job_ejecuciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  empresa_id   UUID REFERENCES empresas(id) ON DELETE CASCADE,
  estado       TEXT NOT NULL,
  detalle      JSONB DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE job_ejecuciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_ejecuciones_select" ON job_ejecuciones;
CREATE POLICY "job_ejecuciones_select" ON job_ejecuciones
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

DROP POLICY IF EXISTS "job_ejecuciones_insert" ON job_ejecuciones;
CREATE POLICY "job_ejecuciones_insert" ON job_ejecuciones
  FOR INSERT WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

-- ──────────────────────────────────────────────────────────────
-- 8. Seed inicial de periodos
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM ejercicios LOOP
    PERFORM public.regenerar_periodos_contables_desde_ejercicio(r.id);
  END LOOP;
END $$;
