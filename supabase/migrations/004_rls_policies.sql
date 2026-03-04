-- ============================================================
-- MIGRACIÓN 004 — ROW LEVEL SECURITY (RLS)
-- Cada usuario solo ve los datos de su empresa.
-- ============================================================

-- Función helper: obtener empresa_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Función helper: obtener rol del usuario
CREATE OR REPLACE FUNCTION get_rol_nombre()
RETURNS TEXT AS $$
  SELECT r.nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  WHERE u.id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE empresas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejercicios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodegas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_puc          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_especiales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE impuestos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pago          ENABLE ROW LEVEL SECURITY;
ALTER TABLE consecutivos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE familias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabricantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportadoras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_gasto          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acreedores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_variantes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock                ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_precios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_lineas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos_lineas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movimientos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_tecnicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE garantias            ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- POLÍTICAS GENÉRICAS POR EMPRESA
-- Patrón: usuario ve solo datos de su empresa
-- ──────────────────────────────────────────────────────────────

-- Macro para crear política SELECT por empresa_id
-- Se aplica a todas las tablas con empresa_id

-- EMPRESAS: usuario ve su propia empresa
CREATE POLICY "usuarios ven su empresa" ON empresas
  FOR SELECT USING (id = get_empresa_id());

CREATE POLICY "admin puede actualizar empresa" ON empresas
  FOR UPDATE USING (id = get_empresa_id() AND get_rol_nombre() = 'admin');

-- USUARIOS: ven usuarios de su empresa
CREATE POLICY "ver usuarios misma empresa" ON usuarios
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "admin gestiona usuarios" ON usuarios
  FOR ALL USING (empresa_id = get_empresa_id() AND get_rol_nombre() = 'admin');

-- TABLAS MAESTRAS (lectura para todos, escritura para admin)
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'ejercicios', 'bodegas', 'cuentas_puc', 'cuentas_especiales',
    'impuestos', 'formas_pago', 'consecutivos', 'familias',
    'fabricantes', 'transportadoras', 'tipos_gasto'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'CREATE POLICY "ver %1$s" ON %1$s FOR SELECT
       USING (empresa_id = get_empresa_id())', t
    );
    EXECUTE format(
      'CREATE POLICY "admin modifica %1$s" ON %1$s FOR ALL
       USING (empresa_id = get_empresa_id() AND get_rol_nombre() IN (''admin'', ''contador''))', t
    );
  END LOOP;
END $$;

-- ENTIDADES (lectura para todos, escritura según rol)
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'colaboradores', 'grupos_clientes', 'clientes',
    'proveedores', 'acreedores', 'productos', 'listas_precios'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'CREATE POLICY "ver %1$s" ON %1$s FOR SELECT
       USING (empresa_id = get_empresa_id())', t
    );
    EXECUTE format(
      'CREATE POLICY "gestionar %1$s" ON %1$s FOR ALL
       USING (empresa_id = get_empresa_id() AND get_rol_nombre() IN (''admin'', ''vendedor'', ''contador''))', t
    );
  END LOOP;
END $$;

-- TABLAS DEPENDIENTES (sin empresa_id directa, se une a tabla padre)
CREATE POLICY "ver clientes_direcciones" ON clientes_direcciones
  FOR SELECT USING (
    cliente_id IN (SELECT id FROM clientes WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "gestionar clientes_direcciones" ON clientes_direcciones
  FOR ALL USING (
    cliente_id IN (SELECT id FROM clientes WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "ver producto_variantes" ON producto_variantes
  FOR SELECT USING (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "gestionar producto_variantes" ON producto_variantes
  FOR ALL USING (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "ver stock" ON stock
  FOR SELECT USING (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "gestionar stock" ON stock
  FOR ALL USING (
    producto_id IN (SELECT id FROM productos WHERE empresa_id = get_empresa_id())
  );

-- DOCUMENTOS (vendedores ven sus propios, admin ve todos)
CREATE POLICY "admin ve todos los documentos" ON documentos
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND (
      get_rol_nombre() IN ('admin', 'contador')
      OR colaborador_id IN (
        SELECT id FROM colaboradores
        WHERE empresa_id = get_empresa_id()
        -- En producción: filtrar por el colaborador ligado al usuario
      )
    )
  );

CREATE POLICY "crear documentos" ON documentos
  FOR INSERT WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'vendedor', 'contador')
  );

CREATE POLICY "actualizar documentos" ON documentos
  FOR UPDATE USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE POLICY "ver lineas documentos" ON documentos_lineas
  FOR SELECT USING (
    documento_id IN (SELECT id FROM documentos WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "gestionar lineas documentos" ON documentos_lineas
  FOR ALL USING (
    documento_id IN (SELECT id FROM documentos WHERE empresa_id = get_empresa_id())
  );

-- RECIBOS, ASIENTOS (solo admin y contador)
CREATE POLICY "ver recibos" ON recibos
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "gestionar recibos" ON recibos
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE POLICY "ver asientos" ON asientos
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "gestionar asientos" ON asientos
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'contador')
  );

CREATE POLICY "ver asientos_lineas" ON asientos_lineas
  FOR SELECT USING (
    asiento_id IN (SELECT id FROM asientos WHERE empresa_id = get_empresa_id())
  );

CREATE POLICY "gestionar asientos_lineas" ON asientos_lineas
  FOR ALL USING (
    asiento_id IN (SELECT id FROM asientos WHERE empresa_id = get_empresa_id())
    AND get_rol_nombre() IN ('admin', 'contador')
  );

-- STOCK MOVIMIENTOS (solo lectura para vendedores)
CREATE POLICY "ver movimientos stock" ON stock_movimientos
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "registrar movimientos stock" ON stock_movimientos
  FOR INSERT WITH CHECK (empresa_id = get_empresa_id());

-- NOTIFICACIONES (usuario ve las suyas + las globales)
CREATE POLICY "ver notificaciones propias" ON notificaciones
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND (usuario_id = auth.uid() OR usuario_id IS NULL)
  );

CREATE POLICY "marcar leida notificacion" ON notificaciones
  FOR UPDATE USING (
    empresa_id = get_empresa_id()
    AND usuario_id = auth.uid()
  );

-- AUDIT LOG (solo lectura para admin)
CREATE POLICY "ver audit log" ON audit_log
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() = 'admin'
  );

-- SERVICIOS Y GARANTÍAS
CREATE POLICY "ver servicios" ON servicios_tecnicos
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "gestionar servicios" ON servicios_tecnicos
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'vendedor', 'contador')
  );

CREATE POLICY "ver garantias" ON garantias
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "gestionar garantias" ON garantias
  FOR ALL USING (
    empresa_id = get_empresa_id()
    AND get_rol_nombre() IN ('admin', 'vendedor', 'contador')
  );
