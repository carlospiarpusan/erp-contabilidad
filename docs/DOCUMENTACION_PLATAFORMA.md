# Documentacion Plataforma ERP Contable

## 1. Resumen

ERP Contable es una plataforma SaaS multiempresa para operaciones comerciales y contables en Colombia.
Cada empresa tiene aislamiento de datos por `empresa_id` y control de acceso por rol.

Stack principal:
- Next.js 16 (App Router)
- Supabase (PostgreSQL + RLS + Auth)
- Tailwind CSS
- Despliegue en Vercel

## 2. Arquitectura

Capas:
- `src/app`: paginas y API routes.
- `src/components`: UI y componentes de dominio.
- `src/lib/db`: acceso a datos por modulo.
- `src/lib/auth` y `src/lib/supabase`: sesion y clientes Supabase.
- `supabase/migrations`: esquema y funciones SQL.

Patron general:
- UI (Server Components) llama funciones en `lib/db/*`.
- API routes se usan para operaciones cliente/servidor y procesos externos.
- RLS garantiza aislamiento por empresa.

## 3. Roles y permisos

Roles implementados:
- `superadmin`: administracion global de empresas y usuarios.
- `admin`: gestion total de su empresa.
- `contador`: ventas, compras, gastos, contabilidad e informes.
- `vendedor`: ventas, clientes y productos.
- `solo_lectura`: consulta sin edicion.

Navegacion y permisos se controlan desde `Sidebar` y validaciones de sesion.

## 4. Modulos funcionales

### Ventas
- Facturas, recibos, cotizaciones, pedidos, remisiones, notas credito/debito, garantias, servicio tecnico.

### Clientes
- Maestro de clientes, grupos, cartera y deudores.

### Compras
- Facturas de compra, ordenes, recibos y proveedores.
- **Sugeridos de compra** en `/compras/sugeridos`.

### Productos e Inventario
- Catalogo, familias, fabricantes, stock bajo, ajustes de inventario.

### Gastos
- Registro de gastos, tipos de gasto y acreedores.

### Contabilidad
- Asientos, PUC, impuestos, formas de pago, ejercicios y consecutivos.

### Informes
- Balances, cartera, PyG, libro mayor, reportes por documentos y reportes de inventario.

### Configuracion
- Empresa, usuarios, bodegas, transportadoras, auditoria e importaciones.

### Superadmin
- Gestion de empresas, usuarios globales y metricas de plataforma.

## 5. Sugeridos de compra (funcion nueva)

Ruta:
- `/compras/sugeridos`

Funcion principal:
- `getSugeridoCompra()` en `src/lib/db/informes.ts`

Variables de entrada:
- `dias`: ventana de analisis de ventas (30 a 365).
- `lead_time`: dias esperados de reposicion (7 a 120).
- `max_items`: maximo de productos sugeridos (50 a 2000).

Factores usados en el calculo:
- Ventas recientes en la ventana (`ventas_ventana`).
- Ventas del mes actual con proyeccion a cierre de mes.
- Promedio de ventas del mismo mes en anos anteriores (estacionalidad).
- Stock actual y stock minimo.
- Cobertura en dias (`dias_cobertura`).

Salida por producto:
- `cantidad_sugerida`
- `prioridad` (`urgente`, `media`, `baja`, `sin_movimiento`)
- `valor_pedido`
- `motivo` operativo de la recomendacion

Comportamiento de pantalla:
- Por defecto oculta productos sin ventas ni historico; el checkbox `Incluir sin movimiento` los vuelve a mostrar.
- La tabla muestra `Ventas (Nd)` y `Ventas mes` para diferenciar rotacion reciente frente al comportamiento del mes actual.

Formula de planeacion:
- Horizonte objetivo = `lead_time + 15` dias de seguridad.
- `stock_objetivo = max(stock_minimo, demanda_diaria * horizonte)`
- `cantidad_sugerida = max(0, ceil(stock_objetivo - stock_actual))`

## 6. Modo oscuro y UX

El modo oscuro se basa en una paleta suave para reducir fatiga visual:
- variables globales en `src/app/globals.css`
- superficies y textos con contraste controlado
- scrollbar y estados de foco armonizados

Componentes base ajustados para consistencia:
- botones, inputs, selects, tablas, modales, badges, sidebar/header.

## 7. Seguridad

Controles aplicados:
- RLS en tablas de negocio.
- Sesion obligatoria para rutas protegidas.
- Separacion entre clave anonima y `service_role`.
- API privadas para operaciones sensibles.
- Auditoria y observabilidad en modulos habilitados.

Buenas practicas de operacion:
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en cliente.
- Mantener variables solo en entorno servidor (Vercel env vars).
- Revisar politicas RLS al agregar tablas o RPC nuevas.

## 8. Despliegue (Vercel + Supabase)

Variables minimas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Checklist previo a deploy:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Checklist posterior a deploy:
- Login por rol.
- Dashboard y rutas criticas.
- `/compras/sugeridos` con datos reales.
- APIs de negocio y exportaciones.

## 9. Mantenimiento y soporte

Comandos utiles:
- desarrollo: `npm run dev`
- calidad: `npm run check`
- build prod: `npm run build`

Flujo recomendado:
1. Cambios en feature branch.
2. Validaciones locales.
3. Deploy preview en Vercel.
4. Prueba funcional por modulo.
5. Merge a `main`.

## 10. Documentacion complementaria

Para contexto tecnico completo, revisar:
- `docs/INDEX.md`
- `docs/ARQUITECTURA_TECNICA.md`
- `docs/RUTAS_APP.md`
- `docs/RUTAS_API.md`
- `docs/OPERACION_VERIFICACION.md`
- `docs/IA_HANDBOOK.md`
- `AGENTS.md`
