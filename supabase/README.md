# Base de Datos — ERP Contabilidad

## Orden de ejecución en Supabase SQL Editor

1. `migrations/001_schema_maestros.sql`   → Tablas base (empresas, usuarios, PUC, etc.)
2. `migrations/002_schema_entidades.sql`  → Clientes, Productos, Stock, Variantes
3. `migrations/003_schema_documentos.sql` → Facturas, Recibos, Asientos, Servicios
4. `migrations/004_rls_policies.sql`      → Seguridad por empresa (RLS)
5. `migrations/005_funciones_negocio.sql` → Lógica contable y de inventario
6. `seeds/001_seed_colombia.sql`          → Datos base Colombia (PUC, impuestos, etc.)

## Configurar .env.local con las credenciales de Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Funciones SQL disponibles

| Función | Descripción |
|---------|-------------|
| `siguiente_consecutivo(empresa_id, tipo)` | Reserva el próximo número de serie |
| `actualizar_stock(...)` | Mueve stock y registra movimiento |
| `generar_asiento_factura_venta(doc_id)` | Asiento DB Clientes / CR Ingresos+IVA |
| `generar_asiento_recibo_venta(recibo_id)` | Asiento DB Caja / CR Clientes |
| `generar_asiento_factura_compra(doc_id)` | Asiento DB Inventario+IVA / CR Proveedores |
| `crear_factura_venta(...)` | Crea factura + mueve stock + genera asiento (atómico) |
| `get_kpis_dashboard(empresa_id, año)` | KPIs para el dashboard |
| `get_resumen_mensual(empresa_id, año)` | Ventas/Compras/Gastos por mes |
