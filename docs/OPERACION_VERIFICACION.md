# Operacion y Verificacion

## 1. Entorno local

```bash
npm install
npm run dev
```

## 2. Calidad obligatoria

```bash
npm run lint
npm run typecheck
npm run build
```

## 3. Checklist funcional rapida

- Login por rol (admin, contador, vendedor, superadmin).
- Dashboard principal carga sin errores.
- Modulos base: ventas, compras, productos, contabilidad.
- APIs principales responden correctamente.
- `/compras/sugeridos` muestra recomendaciones.

## 4. Checklist Vercel

- Variables de entorno completas.
- Build en Vercel sin fallos.
- Rutas criticas operativas post deploy.
- Logs sin excepciones server-side.

## 5. Checklist Supabase

- Migraciones aplicadas.
- RLS activa en tablas de negocio.
- RPC criticas con permisos correctos.
- service role solo en contexto server.

