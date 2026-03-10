# Arquitectura Tecnica

## 1. Capas

- Presentacion: `src/app` y `src/components`.
- Servicios de datos: `src/lib/db`.
- Seguridad y sesion: `src/lib/auth`, `src/lib/supabase`.
- Persistencia: Supabase PostgreSQL con RLS.

## 2. Flujo base

1. Usuario autenticado abre ruta del dashboard.
2. Layout valida sesion y rol.
3. Pagina invoca servicios en `lib/db`.
4. Servicios consultan Supabase con politicas RLS.
5. UI renderiza resultados.

## 3. Estructura recomendada por modulo

- Paginas: `src/app/(dashboard)/<modulo>`
- API: `src/app/api/<modulo>`
- Logica: `src/lib/db/<modulo>.ts`
- Componentes: `src/components/<modulo>`

## 4. Seguridad

Invariantes:
- aislamiento por `empresa_id`
- politicas RLS activas
- claves sensibles solo en servidor
- validacion de rol por accion

## 5. Rendimiento

Patrones usados:
- server components para consultas iniciales
- consultas paralelas con `Promise.all`
- cache de reportes en funciones de informes
- paginacion en listados grandes

## 6. Modulo Sugeridos de compra

Ruta UI:
- `/compras/sugeridos`

Servicio:
- `getSugeridoCompra()` en `src/lib/db/informes.ts`

Entradas:
- `dias` ventana de ventas
- `lead_time` dias de abastecimiento
- `max_items` tope de productos

Salida por item:
- demanda proyectada
- cobertura en dias
- cantidad sugerida
- prioridad y motivo

