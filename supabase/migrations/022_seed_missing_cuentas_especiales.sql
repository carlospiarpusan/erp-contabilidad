-- ============================================================
-- MIGRACIÓN 022 — SEMBRAR CUENTAS ESPECIALES FALTANTES
-- ============================================================
-- Inserta cuentas especiales faltantes usando los códigos PUC
-- base sembrados por defecto. No sobrescribe configuraciones
-- existentes.
-- ============================================================

INSERT INTO cuentas_especiales (empresa_id, tipo, cuenta_id)
SELECT c.empresa_id, mapa.tipo, c.id
FROM cuentas_puc c
JOIN (
  VALUES
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
) AS mapa(tipo, codigo)
  ON mapa.codigo = c.codigo
LEFT JOIN cuentas_especiales ce
  ON ce.empresa_id = c.empresa_id
 AND ce.tipo = mapa.tipo
WHERE ce.id IS NULL;
