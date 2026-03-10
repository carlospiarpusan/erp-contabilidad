# AGENTS Guide - ERP Contable

This file is the operational guide for future AI/code agents working in this repository.

## 1. Project goals

- Multi-tenant ERP for accounting and operations.
- Every business record must stay isolated by `empresa_id`.
- Main environments: Vercel (app) + Supabase (db/auth).

## 2. Stack and conventions

- Next.js 16 App Router.
- React 19.
- TypeScript strict mode.
- Tailwind CSS v4.
- Supabase SSR client for server/client contexts.

Code style expectations:
- Keep business logic in `src/lib/db/*`.
- Keep pages as orchestration + UI only.
- Validate role and session in protected routes.
- Prefer typed return payloads for new services.
- Keep changes incremental and testable.

## 3. High-value paths

- `src/app/(dashboard)/*`: authenticated ERP pages.
- `src/app/api/*`: API endpoints grouped by domain.
- `src/lib/db/*`: data access services (core logic).
- `src/lib/auth/session.ts`: session and role context.
- `src/components/layout/Sidebar.tsx`: module navigation by role.
- `supabase/migrations/*`: schema, RLS and RPC.

## 4. Multi-tenant and security invariants

Never break these invariants:
- Tenant isolation by `empresa_id`.
- RLS remains enabled for business tables.
- Service role key is server-only.
- No sensitive secrets in client bundles.
- Superadmin scope must not leak into tenant user scope.

Before merging db/security changes:
- Re-check policies and role assumptions.
- Verify CRUD flows with at least admin + vendedor roles.

## 5. Module map

Core modules:
- Ventas
- Compras
- Productos/Inventario
- Gastos
- Contabilidad
- Informes
- Configuracion
- Notificaciones
- Superadmin
- Documentacion (internal page)

Special feature:
- `Compras > Sugeridos` (`/compras/sugeridos`) uses predictive restock logic from `getSugeridoCompra` in `src/lib/db/informes.ts`.

## 6. Required quality checks

Run all three before finishing relevant changes:

```bash
npm run lint
npm run typecheck
npm run build
```

If any command fails, fix or explicitly document blockers.

## 7. Deployment notes (Vercel + Supabase)

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Production checks after deploy:
- login by role
- dashboard load
- superadmin area
- critical APIs
- `/compras/sugeridos`

## 8. Documentation index

Read these docs before major refactors:
- `README.md`
- `docs/INDEX.md`
- `docs/DOCUMENTACION_PLATAFORMA.md`
- `docs/ARQUITECTURA_TECNICA.md`
- `docs/RUTAS_APP.md`
- `docs/RUTAS_API.md`
- `docs/OPERACION_VERIFICACION.md`
- `docs/IA_HANDBOOK.md`

## 9. Practical workflow for future agents

1. Identify impacted module(s) and role(s).
2. Read matching service in `src/lib/db`.
3. Update UI/API with minimal blast radius.
4. Validate with lint/typecheck/build.
5. Update docs if behavior or routes changed.

