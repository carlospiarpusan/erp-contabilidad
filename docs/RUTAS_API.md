# Rutas API

Inventario de endpoints detectados en `src/app/api`.

## Total

- Endpoints: 98

## Notas relevantes

- `/api/import/factura-electronica/parse/route.ts`: acepta `XML`, `ZIP` y `PDF`; soporta `AttachedDocument` DIAN con `Invoice` embebida y, si el ZIP incluye PDF, usa ese PDF para enriquecer codigos detallados del proveedor antes de homologar productos. Si se sube un `PDF` suelto, intenta importar cabecera y lineas desde el texto visible del documento.
- `/api/import/factura-electronica/confirmar/route.ts`: exige todas las lineas resueltas, registra compatibilidades proveedor-producto, confirma la compra de forma atomica y sincroniza stock, precio de compra e IVA del producto.

## Lista completa

- `/api/auditoria/route.ts`
- `/api/busqueda/route.ts`
- `/api/auth/login/route.ts`
- `/api/clientes/[id]/route.ts`
- `/api/clientes/grupos/[id]/route.ts`
- `/api/clientes/grupos/route.ts`
- `/api/clientes/route.ts`
- `/api/compras/facturas/[id]/route.ts`
- `/api/compras/facturas/route.ts`
- `/api/compras/ordenes/[id]/route.ts`
- `/api/compras/ordenes/route.ts`
- `/api/compras/proveedores/[id]/route.ts`
- `/api/compras/proveedores/route.ts`
- `/api/configuracion/bodegas/route.ts`
- `/api/configuracion/colaboradores/route.ts`
- `/api/configuracion/empresa/route.ts`
- `/api/configuracion/transportadoras/route.ts`
- `/api/contabilidad/asientos-masivo/route.ts`
- `/api/contabilidad/asientos/[id]/revertir/route.ts`
- `/api/contabilidad/asientos/[id]/route.ts`
- `/api/contabilidad/asientos/route.ts`
- `/api/contabilidad/consecutivos/[id]/route.ts`
- `/api/contabilidad/consecutivos/route.ts`
- `/api/contabilidad/cuentas-especiales/route.ts`
- `/api/contabilidad/cuentas/[id]/route.ts`
- `/api/contabilidad/cuentas/route.ts`
- `/api/contabilidad/ejercicios/[id]/route.ts`
- `/api/contabilidad/ejercicios/route.ts`
- `/api/contabilidad/formas-pago/[id]/route.ts`
- `/api/contabilidad/formas-pago/route.ts`
- `/api/contabilidad/impuestos/[id]/route.ts`
- `/api/contabilidad/impuestos/route.ts`
- `/api/dashboard/route.ts`
- `/api/documentos/duplicar/route.ts`
- `/api/email/cotizacion/route.ts`
- `/api/email/factura/route.ts`
- `/api/email/nota-credito/route.ts`
- `/api/email/nota-debito/route.ts`
- `/api/email/pedido/route.ts`
- `/api/email/recordatorio-cobro/route.ts`
- `/api/email/remision/route.ts`
- `/api/export/balance-situacion/route.ts`
- `/api/export/clientes/route.ts`
- `/api/export/compras/route.ts`
- `/api/export/inventario/route.ts`
- `/api/export/pyg/route.ts`
- `/api/export/proveedores/route.ts`
- `/api/export/sumas-saldos/route.ts`
- `/api/export/ventas/route.ts`
- `/api/export/ventas-por-medio-pago/route.ts`
- `/api/gastos/[id]/route.ts`
- `/api/gastos/acreedores/[id]/route.ts`
- `/api/gastos/acreedores/route.ts`
- `/api/gastos/route.ts`
- `/api/gastos/tipos/[id]/route.ts`
- `/api/gastos/tipos/route.ts`
- `/api/health/route.ts`
- `/api/import/clientes/route.ts`
- `/api/import/factura-electronica/confirmar/route.ts`
- `/api/import/factura-electronica/parse/route.ts`
- `/api/import/facturas-compra/route.ts`
- `/api/import/productos/route.ts`
- `/api/import/proveedores/route.ts`
- `/api/informes/cartera/route.ts`
- `/api/inventario/ajuste/route.ts`
- `/api/notificaciones/route.ts`
- `/api/perfil/route.ts`
- `/api/productos/[id]/route.ts`
- `/api/productos/fabricantes/[id]/route.ts`
- `/api/productos/fabricantes/route.ts`
- `/api/productos/familias/[id]/route.ts`
- `/api/productos/familias/route.ts`
- `/api/productos/route.ts`
- `/api/superadmin/empresas/[id]/usuarios/route.ts`
- `/api/superadmin/empresas/route.ts`
- `/api/usuarios/[id]/route.ts`
- `/api/usuarios/route.ts`
- `/api/ventas/cotizaciones/[id]/route.ts`
- `/api/ventas/cotizaciones/route.ts`
- `/api/ventas/facturas/[id]/dian/route.ts`
- `/api/ventas/facturas/[id]/route.ts`
- `/api/ventas/facturas/route.ts`
- `/api/ventas/garantias/[id]/route.ts`
- `/api/ventas/garantias/route.ts`
- `/api/ventas/notas-credito/[id]/route.ts`
- `/api/ventas/notas-credito/route.ts`
- `/api/ventas/notas-debito/[id]/route.ts`
- `/api/ventas/notas-debito/route.ts`
- `/api/ventas/pedidos/[id]/route.ts`
- `/api/ventas/pedidos/route.ts`
- `/api/ventas/precios/[id]/route.ts`
- `/api/ventas/precios/route.ts`
- `/api/ventas/recibos/route.ts`
- `/api/ventas/recibos/sistecredito/route.ts`
- `/api/ventas/remisiones/[id]/route.ts`
- `/api/ventas/remisiones/route.ts`
- `/api/ventas/servicios/[id]/route.ts`
- `/api/ventas/servicios/route.ts`
