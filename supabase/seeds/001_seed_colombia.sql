-- ============================================================
-- SEED 001 — DATOS BASE COLOMBIA
-- Ejecutar después de crear la empresa manualmente.
-- Reemplaza :empresa_id con el UUID real de la empresa.
-- ============================================================

-- Variables de uso (reemplazar con el UUID real)
DO $$
DECLARE
  v_empresa UUID := '00000000-0000-0000-0000-000000000001'; -- REEMPLAZAR

BEGIN

-- ──────────────────────────────────────────────────────────────
-- ROLES
-- ──────────────────────────────────────────────────────────────
INSERT INTO roles (id, nombre, descripcion, permisos) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin', 'Acceso total al sistema',
   '{"ventas":true,"compras":true,"gastos":true,"contabilidad":true,"config":true,"eliminar":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'vendedor', 'Puede crear ventas y ver clientes',
   '{"ventas":true,"compras":false,"gastos":false,"contabilidad":false,"config":false,"eliminar":false}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'contador', 'Acceso a contabilidad e informes',
   '{"ventas":true,"compras":true,"gastos":true,"contabilidad":true,"config":false,"eliminar":false}'::jsonb),
  ('10000000-0000-0000-0000-000000000004', 'solo_lectura', 'Solo puede consultar',
   '{"ventas":false,"compras":false,"gastos":false,"contabilidad":false,"config":false,"eliminar":false}'::jsonb)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- EJERCICIOS CONTABLES (2024, 2025, 2026)
-- ──────────────────────────────────────────────────────────────
INSERT INTO ejercicios (empresa_id, año, fecha_inicio, fecha_fin, estado) VALUES
  (v_empresa, 2024, '2024-01-01', '2024-12-31', 'cerrado'),
  (v_empresa, 2025, '2025-01-01', '2025-12-31', 'cerrado'),
  (v_empresa, 2026, '2026-01-01', '2026-12-31', 'activo');

-- ──────────────────────────────────────────────────────────────
-- BODEGA PRINCIPAL
-- ──────────────────────────────────────────────────────────────
INSERT INTO bodegas (empresa_id, codigo, nombre, principal) VALUES
  (v_empresa, '001', 'Bodega Principal', TRUE);

-- ──────────────────────────────────────────────────────────────
-- PUC — PLAN ÚNICO DE CUENTAS COLOMBIA (cuentas esenciales)
-- ──────────────────────────────────────────────────────────────
INSERT INTO cuentas_puc (empresa_id, codigo, descripcion, tipo, nivel, naturaleza) VALUES
  -- CLASES
  (v_empresa, '1', 'ACTIVO', 'activo', 1, 'debito'),
  (v_empresa, '2', 'PASIVO', 'pasivo', 1, 'credito'),
  (v_empresa, '3', 'PATRIMONIO', 'patrimonio', 1, 'credito'),
  (v_empresa, '4', 'INGRESOS', 'ingreso', 1, 'credito'),
  (v_empresa, '5', 'GASTOS', 'gasto', 1, 'debito'),
  (v_empresa, '6', 'COSTO DE VENTAS', 'costo', 1, 'debito'),
  -- ACTIVO CORRIENTE
  (v_empresa, '11', 'EFECTIVO Y EQUIVALENTES', 'activo', 2, 'debito'),
  (v_empresa, '1105', 'Caja', 'activo', 3, 'debito'),
  (v_empresa, '110505', 'Caja General', 'activo', 4, 'debito'),
  (v_empresa, '1110', 'Bancos', 'activo', 3, 'debito'),
  (v_empresa, '111005', 'Bancolombia Ahorros', 'activo', 4, 'debito'),
  (v_empresa, '13', 'DEUDORES', 'activo', 2, 'debito'),
  (v_empresa, '1305', 'Clientes', 'activo', 3, 'debito'),
  (v_empresa, '130505', 'Clientes Nacionales', 'activo', 4, 'debito'),
  (v_empresa, '14', 'INVENTARIOS', 'activo', 2, 'debito'),
  (v_empresa, '1435', 'Mercancías no fabricadas por la empresa', 'activo', 3, 'debito'),
  (v_empresa, '143505', 'Inventario de Mercancías', 'activo', 4, 'debito'),
  -- PASIVO CORRIENTE
  (v_empresa, '22', 'PROVEEDORES', 'pasivo', 2, 'credito'),
  (v_empresa, '2205', 'Proveedores Nacionales', 'pasivo', 3, 'credito'),
  (v_empresa, '220505', 'Proveedores', 'pasivo', 4, 'credito'),
  (v_empresa, '23', 'CUENTAS POR PAGAR', 'pasivo', 2, 'credito'),
  (v_empresa, '2335', 'Costos y gastos por pagar', 'pasivo', 3, 'credito'),
  (v_empresa, '233505', 'Gastos por pagar', 'pasivo', 4, 'credito'),
  (v_empresa, '24', 'IMPUESTOS GRAVÁMENES Y TASAS', 'pasivo', 2, 'credito'),
  (v_empresa, '2408', 'IVA por pagar', 'pasivo', 3, 'credito'),
  (v_empresa, '240805', 'IVA Generado', 'pasivo', 4, 'credito'),
  (v_empresa, '240806', 'IVA Descontable', 'pasivo', 4, 'debito'),
  -- INGRESOS
  (v_empresa, '41', 'INGRESOS OPERACIONALES', 'ingreso', 2, 'credito'),
  (v_empresa, '4135', 'Comercio al por mayor y al por menor', 'ingreso', 3, 'credito'),
  (v_empresa, '413505', 'Ventas de Mercancías', 'ingreso', 4, 'credito'),
  -- COSTOS
  (v_empresa, '61', 'COSTO DE VENTAS Y PRESTACIÓN DE SERVICIOS', 'costo', 2, 'debito'),
  (v_empresa, '6135', 'Comercio al por mayor y al por menor', 'costo', 3, 'debito'),
  (v_empresa, '613505', 'Costo Mercancía Vendida', 'costo', 4, 'debito'),
  -- GASTOS OPERACIONALES
  (v_empresa, '51', 'GASTOS OPERACIONALES DE ADMINISTRACIÓN', 'gasto', 2, 'debito'),
  (v_empresa, '5105', 'Gastos de personal', 'gasto', 3, 'debito'),
  (v_empresa, '510506', 'Sueldos', 'gasto', 4, 'debito'),
  (v_empresa, '5110', 'Honorarios', 'gasto', 3, 'debito'),
  (v_empresa, '5115', 'Impuestos', 'gasto', 3, 'debito'),
  (v_empresa, '5120', 'Arrendamientos', 'gasto', 3, 'debito'),
  (v_empresa, '5125', 'Contribuciones y afiliaciones', 'gasto', 3, 'debito'),
  (v_empresa, '5130', 'Seguros', 'gasto', 3, 'debito'),
  (v_empresa, '5135', 'Servicios', 'gasto', 3, 'debito'),
  (v_empresa, '513510', 'Transporte, fletes y acarreos', 'gasto', 4, 'debito'),
  (v_empresa, '513515', 'Publicidad y propaganda', 'gasto', 4, 'debito'),
  (v_empresa, '5145', 'Mantenimiento y reparaciones', 'gasto', 3, 'debito'),
  (v_empresa, '5195', 'Diversos', 'gasto', 3, 'debito'),
  (v_empresa, '519595', 'Gastos varios', 'gasto', 4, 'debito');

-- ──────────────────────────────────────────────────────────────
-- IMPUESTOS
-- ──────────────────────────────────────────────────────────────
INSERT INTO impuestos (empresa_id, codigo, descripcion, porcentaje, por_defecto) VALUES
  (v_empresa, 'CO0',  'Exento de IVA (0%)', 0, FALSE),
  (v_empresa, 'CO5',  'IVA 5%', 5, FALSE),
  (v_empresa, 'CO19', 'IVA 19%', 19, TRUE);

-- Asignar subcuentas a impuestos (se hace después de insertar cuentas)
UPDATE impuestos i
SET
  subcuenta_ventas_id  = (SELECT id FROM cuentas_puc WHERE codigo = '240805' AND empresa_id = v_empresa),
  subcuenta_compras_id = (SELECT id FROM cuentas_puc WHERE codigo = '240806' AND empresa_id = v_empresa)
WHERE i.empresa_id = v_empresa AND i.codigo = 'CO19';

-- ──────────────────────────────────────────────────────────────
-- FORMAS DE PAGO
-- ──────────────────────────────────────────────────────────────
INSERT INTO formas_pago (empresa_id, descripcion, tipo, dias_vencimiento) VALUES
  (v_empresa, 'Efectivo', 'contado', 0),
  (v_empresa, 'Transferencia Bancolombia', 'contado', 0),
  (v_empresa, 'Nequi', 'contado', 0),
  (v_empresa, 'Daviplata', 'contado', 0),
  (v_empresa, 'Tarjeta débito o crédito', 'contado', 0),
  (v_empresa, 'Contra entrega', 'contado', 3),
  (v_empresa, 'A crédito 30 días', 'credito', 30),
  (v_empresa, 'A crédito 60 días', 'credito', 60);

-- ──────────────────────────────────────────────────────────────
-- CONSECUTIVOS / SERIES
-- ──────────────────────────────────────────────────────────────
INSERT INTO consecutivos (empresa_id, descripcion, prefijo, consecutivo_actual, tipo) VALUES
  (v_empresa, 'Facturación',            'F',   0, 'factura_venta'),
  (v_empresa, 'Facturación POS 1',      'P1',  0, 'factura_venta'),
  (v_empresa, 'Facturación POS 2',      'P2',  0, 'factura_venta'),
  (v_empresa, 'Nota Crédito',           'NC',  0, 'nota_credito'),
  (v_empresa, 'Nota Débito',            'ND',  0, 'nota_debito'),
  (v_empresa, 'Nota Débito Proveedor',  'NDP', 0, 'nota_debito'),
  (v_empresa, 'Documento Soporte',      'DS',  0, 'factura_compra'),
  (v_empresa, 'Facturas de Compra',     'C',   0, 'factura_compra'),
  (v_empresa, 'Órdenes de Compra',      'OC',  0, 'orden_compra'),
  (v_empresa, 'Cotizaciones',           'CO',  0, 'cotizacion'),
  (v_empresa, 'Pedidos',                'PE',  0, 'pedido'),
  (v_empresa, 'Remisiones',             'RE',  0, 'remision'),
  (v_empresa, 'Recibos de Caja Ventas', 'RV',  0, 'recibo_venta'),
  (v_empresa, 'Recibos de Compra',      'RC',  0, 'recibo_compra'),
  (v_empresa, 'Gastos',                 'G',   0, 'gasto'),
  (v_empresa, 'Asientos',               'A',   0, 'asiento');

-- ──────────────────────────────────────────────────────────────
-- CUENTAS ESPECIALES (para asientos automáticos)
-- ──────────────────────────────────────────────────────────────
INSERT INTO cuentas_especiales (empresa_id, tipo, cuenta_id)
SELECT v_empresa, tipo, (SELECT id FROM cuentas_puc WHERE codigo = cuenta AND empresa_id = v_empresa)
FROM (VALUES
  ('caja',          '110505'),
  ('banco',         '111005'),
  ('clientes',      '130505'),
  ('inventario',    '143505'),
  ('proveedores',   '220505'),
  ('acreedores',    '233505'),
  ('iva_ventas',    '240805'),
  ('iva_compras',   '240806'),
  ('ingresos',      '413505'),
  ('costo_ventas',  '613505')
) AS t(tipo, cuenta);

-- ──────────────────────────────────────────────────────────────
-- FAMILIAS DE PRODUCTOS (específicas del negocio)
-- ──────────────────────────────────────────────────────────────
INSERT INTO familias (empresa_id, nombre) VALUES
  (v_empresa, 'FAJAS'),
  (v_empresa, 'BRASIER'),
  (v_empresa, 'ADELGAZANTES'),
  (v_empresa, 'JABON'),
  (v_empresa, 'ACCESORIOS'),
  (v_empresa, 'SERVICIOS');

-- ──────────────────────────────────────────────────────────────
-- FABRICANTES / MARCAS
-- ──────────────────────────────────────────────────────────────
INSERT INTO fabricantes (empresa_id, nombre) VALUES
  (v_empresa, 'FAJATE'),
  (v_empresa, 'IRENE MELO'),
  (v_empresa, 'GENÉRICO');

-- ──────────────────────────────────────────────────────────────
-- TIPOS DE GASTO
-- ──────────────────────────────────────────────────────────────
INSERT INTO tipos_gasto (empresa_id, descripcion) VALUES
  (v_empresa, 'Arriendo'),
  (v_empresa, 'Servicios públicos'),
  (v_empresa, 'Transporte y fletes'),
  (v_empresa, 'Publicidad'),
  (v_empresa, 'Sueldos y salarios'),
  (v_empresa, 'Honorarios'),
  (v_empresa, 'Mantenimiento'),
  (v_empresa, 'Seguros'),
  (v_empresa, 'Papelería y útiles'),
  (v_empresa, 'Gastos de representación'),
  (v_empresa, 'Impuestos y contribuciones'),
  (v_empresa, 'Varios');

-- ──────────────────────────────────────────────────────────────
-- TRANSPORTADORAS COMUNES EN COLOMBIA
-- ──────────────────────────────────────────────────────────────
INSERT INTO transportadoras (empresa_id, nombre, url_rastreo) VALUES
  (v_empresa, 'Servientrega', 'https://www.servientrega.com/rastreo'),
  (v_empresa, 'Deprisa',      'https://www.deprisa.com/rastreo'),
  (v_empresa, 'Interrapidísimo', 'https://www.interrapidisimo.com/rastreo'),
  (v_empresa, 'Coordinadora', 'https://www.coordinadora.com/rastreo'),
  (v_empresa, 'Envía',        'https://www.envia.com/rastreo'),
  (v_empresa, 'TCC',          'https://www.tcc.com.co/rastreo'),
  (v_empresa, 'Propio / Personal', NULL);

-- ──────────────────────────────────────────────────────────────
-- COLABORADOR POR DEFECTO
-- ──────────────────────────────────────────────────────────────
INSERT INTO colaboradores (empresa_id, nombre, porcentaje_comision) VALUES
  (v_empresa, 'Maria Esperanza Tengana', 0),
  (v_empresa, 'Martha Jurado', 0),
  (v_empresa, 'Pilar Revelo', 0);

END $$;
