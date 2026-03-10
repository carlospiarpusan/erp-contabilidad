-- ============================================================
-- MIGRACION 027 - AGREGADOS DE VENTAS POR PRODUCTO
-- Soporta analitica de reposicion sin releer documentos_lineas crudos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ventas_producto_documento_detalle (
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  cantidad_total numeric(15,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (documento_id, producto_id)
);

CREATE TABLE IF NOT EXISTS public.ventas_producto_diarias (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  cantidad_total numeric(15,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, producto_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_ventas_producto_detalle_empresa_fecha
  ON public.ventas_producto_documento_detalle (empresa_id, fecha);

CREATE INDEX IF NOT EXISTS idx_ventas_producto_diarias_empresa_fecha
  ON public.ventas_producto_diarias (empresa_id, fecha);

CREATE INDEX IF NOT EXISTS idx_ventas_producto_diarias_empresa_producto_fecha
  ON public.ventas_producto_diarias (empresa_id, producto_id, fecha);

ALTER TABLE public.ventas_producto_documento_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_producto_diarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_producto_documento_detalle_tenant_select ON public.ventas_producto_documento_detalle;
CREATE POLICY ventas_producto_documento_detalle_tenant_select
  ON public.ventas_producto_documento_detalle
  FOR SELECT
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS ventas_producto_documento_detalle_tenant_write ON public.ventas_producto_documento_detalle;
CREATE POLICY ventas_producto_documento_detalle_tenant_write
  ON public.ventas_producto_documento_detalle
  FOR ALL
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS ventas_producto_diarias_tenant_select ON public.ventas_producto_diarias;
CREATE POLICY ventas_producto_diarias_tenant_select
  ON public.ventas_producto_diarias
  FOR SELECT
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS ventas_producto_diarias_tenant_write ON public.ventas_producto_diarias;
CREATE POLICY ventas_producto_diarias_tenant_write
  ON public.ventas_producto_diarias
  FOR ALL
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

GRANT SELECT ON public.ventas_producto_diarias TO authenticated, service_role;
GRANT SELECT ON public.ventas_producto_documento_detalle TO service_role;

CREATE OR REPLACE FUNCTION public.apply_delta_ventas_producto_diarias(
  p_empresa_id uuid,
  p_producto_id uuid,
  p_fecha date,
  p_delta numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF p_empresa_id IS NULL OR p_producto_id IS NULL OR p_fecha IS NULL OR COALESCE(p_delta, 0) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.ventas_producto_diarias (
    empresa_id,
    producto_id,
    fecha,
    cantidad_total
  ) VALUES (
    p_empresa_id,
    p_producto_id,
    p_fecha,
    p_delta
  )
  ON CONFLICT (empresa_id, producto_id, fecha)
  DO UPDATE
    SET cantidad_total = public.ventas_producto_diarias.cantidad_total + EXCLUDED.cantidad_total,
        updated_at = now();

  SELECT cantidad_total
  INTO v_total
  FROM public.ventas_producto_diarias
  WHERE empresa_id = p_empresa_id
    AND producto_id = p_producto_id
    AND fecha = p_fecha;

  IF COALESCE(v_total, 0) <= 0 THEN
    DELETE FROM public.ventas_producto_diarias
    WHERE empresa_id = p_empresa_id
      AND producto_id = p_producto_id
      AND fecha = p_fecha;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_ventas_producto_documento(
  p_documento_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_prev record;
BEGIN
  FOR v_prev IN
    SELECT empresa_id, producto_id, fecha, cantidad_total
    FROM public.ventas_producto_documento_detalle
    WHERE documento_id = p_documento_id
  LOOP
    PERFORM public.apply_delta_ventas_producto_diarias(
      v_prev.empresa_id,
      v_prev.producto_id,
      v_prev.fecha,
      -v_prev.cantidad_total
    );
  END LOOP;

  DELETE FROM public.ventas_producto_documento_detalle
  WHERE documento_id = p_documento_id;

  SELECT id, empresa_id, tipo, estado, fecha
  INTO v_doc
  FROM public.documentos
  WHERE id = p_documento_id;

  IF NOT FOUND THEN
    RETURN p_documento_id;
  END IF;

  IF v_doc.tipo != 'factura_venta' OR v_doc.estado = 'cancelada' OR v_doc.fecha IS NULL THEN
    RETURN p_documento_id;
  END IF;

  INSERT INTO public.ventas_producto_documento_detalle (
    documento_id,
    empresa_id,
    producto_id,
    fecha,
    cantidad_total
  )
  SELECT
    dl.documento_id,
    v_doc.empresa_id,
    dl.producto_id,
    v_doc.fecha,
    SUM(dl.cantidad)::numeric(15,3)
  FROM public.documentos_lineas dl
  WHERE dl.documento_id = p_documento_id
    AND dl.producto_id IS NOT NULL
  GROUP BY dl.documento_id, dl.producto_id
  ON CONFLICT (documento_id, producto_id)
  DO UPDATE
    SET empresa_id = EXCLUDED.empresa_id,
        fecha = EXCLUDED.fecha,
        cantidad_total = EXCLUDED.cantidad_total,
        updated_at = now();

  FOR v_prev IN
    SELECT empresa_id, producto_id, fecha, cantidad_total
    FROM public.ventas_producto_documento_detalle
    WHERE documento_id = p_documento_id
  LOOP
    PERFORM public.apply_delta_ventas_producto_diarias(
      v_prev.empresa_id,
      v_prev.producto_id,
      v_prev.fecha,
      v_prev.cantidad_total
    );
  END LOOP;

  RETURN p_documento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_rebuild_ventas_producto_documento_lineas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.documento_id IS DISTINCT FROM NEW.documento_id THEN
    PERFORM public.rebuild_ventas_producto_documento(OLD.documento_id);
    PERFORM public.rebuild_ventas_producto_documento(NEW.documento_id);
    RETURN NEW;
  END IF;

  PERFORM public.rebuild_ventas_producto_documento(COALESCE(NEW.documento_id, OLD.documento_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_rebuild_ventas_producto_documento_documentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rebuild_ventas_producto_documento(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_lineas_ins ON public.documentos_lineas;
CREATE TRIGGER rebuild_ventas_producto_documento_lineas_ins
AFTER INSERT ON public.documentos_lineas
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_lineas();

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_lineas_upd ON public.documentos_lineas;
CREATE TRIGGER rebuild_ventas_producto_documento_lineas_upd
AFTER UPDATE OF documento_id, producto_id, cantidad ON public.documentos_lineas
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_lineas();

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_lineas_del ON public.documentos_lineas;
CREATE TRIGGER rebuild_ventas_producto_documento_lineas_del
AFTER DELETE ON public.documentos_lineas
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_lineas();

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_doc_ins ON public.documentos;
CREATE TRIGGER rebuild_ventas_producto_documento_doc_ins
AFTER INSERT ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_documentos();

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_doc_upd ON public.documentos;
CREATE TRIGGER rebuild_ventas_producto_documento_doc_upd
AFTER UPDATE OF tipo, estado, fecha ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_documentos();

DROP TRIGGER IF EXISTS rebuild_ventas_producto_documento_doc_del ON public.documentos;
CREATE TRIGGER rebuild_ventas_producto_documento_doc_del
AFTER DELETE ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ventas_producto_documento_documentos();

INSERT INTO public.ventas_producto_documento_detalle (
  documento_id,
  empresa_id,
  producto_id,
  fecha,
  cantidad_total
)
SELECT
  dl.documento_id,
  d.empresa_id,
  dl.producto_id,
  d.fecha,
  SUM(dl.cantidad)::numeric(15,3)
FROM public.documentos_lineas dl
JOIN public.documentos d ON d.id = dl.documento_id
WHERE d.tipo = 'factura_venta'
  AND d.estado != 'cancelada'
  AND d.fecha IS NOT NULL
  AND dl.producto_id IS NOT NULL
GROUP BY dl.documento_id, d.empresa_id, dl.producto_id, d.fecha
ON CONFLICT (documento_id, producto_id)
DO UPDATE
  SET empresa_id = EXCLUDED.empresa_id,
      fecha = EXCLUDED.fecha,
      cantidad_total = EXCLUDED.cantidad_total,
      updated_at = now();

INSERT INTO public.ventas_producto_diarias (
  empresa_id,
  producto_id,
  fecha,
  cantidad_total
)
SELECT
  empresa_id,
  producto_id,
  fecha,
  SUM(cantidad_total)::numeric(15,3)
FROM public.ventas_producto_documento_detalle
GROUP BY empresa_id, producto_id, fecha
ON CONFLICT (empresa_id, producto_id, fecha)
DO UPDATE
  SET cantidad_total = EXCLUDED.cantidad_total,
      updated_at = now();
