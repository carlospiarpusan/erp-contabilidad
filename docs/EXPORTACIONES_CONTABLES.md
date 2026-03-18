# Exportaciones Contables

## Objetivo

Definir cómo debe comportarse el módulo de exportaciones del ERP a partir de prácticas observadas en software contable real y aplicarlas al árbol del proyecto.

## Patrones observados

Patrones comunes detectados en documentación oficial:
- Las exportaciones parten desde reportes o listados con filtros previos, no como archivos “sueltos”.
- Los formatos más comunes son `Excel/CSV` y, para reportes presentacionales, `PDF`.
- Los módulos suelen cubrir dos tipos de salida:
  - reportes operativos: ventas, compras, inventario, cartera
  - datos maestros o contables: clientes, proveedores, balances, sumas y saldos
- Cuando el volumen crece, el software mueve la exportación a procesos asincrónicos o historial de descargas.

Referencias oficiales revisadas:
- QuickBooks: [Export reports, lists, and other data from QuickBooks Online](https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L0DfI0XuR_US_en_US)
- Alegra: [Cómo exportar un reporte a Excel](https://ayuda.alegra.com/es/como-exportar-un-reporte-a-excel)
- Siigo: [Exportar reportes o informes a Excel](https://siigonube.portaldeclientes.siigo.com/exportar-reportes-o-informes-a-excel/)
- Odoo: [Export data from any list view](https://www.odoo.com/documentation/17.0/applications/essentials/export_import_data.html)

## Decisión para este ERP

Primera implementación:
- Crear un `Centro de exportaciones` en `/informes/exportaciones`.
- Centralizar el catálogo exportable en `src/lib/export/registry.ts`.
- Mantener `CSV` como formato inicial estable.
- Cubrir exportaciones operativas, contables y maestras desde un solo punto.
- Añadir exportaciones maestras faltantes: `clientes` y `proveedores`.

Fases siguientes:
1. Historial de exportaciones por usuario y empresa.
2. Exportaciones asíncronas para datasets grandes.
3. Formatos adicionales (`XLSX`, `PDF`, y fiscales si el negocio lo requiere).
4. Presets guardados de filtros por usuario.

## Árbol de desarrollo

Nodos agregados o definidos:
- `src/lib/export/registry.ts`
- `src/app/(dashboard)/informes/exportaciones/page.tsx`
- `src/app/api/export/clientes/route.ts`
- `src/app/api/export/proveedores/route.ts`

Dependencias existentes reutilizadas:
- `src/lib/utils/csv.ts`
- `src/app/api/export/*`
- `src/lib/auth/permissions.ts`
- `src/components/layout/navigation.ts`
