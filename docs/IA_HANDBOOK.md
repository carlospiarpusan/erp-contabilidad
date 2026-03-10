# Manual IA

## 1. Objetivo

Permitir que futuras IAs entiendan y modifiquen el ERP con menor riesgo y mayor velocidad.

## 2. Donde empezar

1. Leer `AGENTS.md`.
2. Revisar `docs/ARQUITECTURA_TECNICA.md`.
3. Ubicar modulo en `src/app/(dashboard)` y `src/lib/db`.

## 3. Reglas de trabajo

- No romper aislamiento multiempresa.
- Evitar cambios masivos sin validacion.
- Mantener compatibilidad con Vercel y Supabase.
- Documentar cambios funcionales y tecnicos.

## 4. Convenciones de cambio

- Si cambias una ruta, actualizar `docs/RUTAS_APP.md` o `docs/RUTAS_API.md`.
- Si cambias logica de negocio, actualizar modulo correspondiente en docs.
- Si cambias seguridad, detallar impacto en RLS/permisos.

## 5. Comandos utiles

```bash
# rutas app
find src/app/\(dashboard\) -type f -name 'page.tsx'

# rutas api
find src/app/api -type f -name 'route.ts'

# chequeo general
npm run check
```

## 6. Riesgos comunes

- Mezclar scope superadmin con scope empresa.
- Exponer secretos en componentes cliente.
- Cambiar contratos de datos sin ajustar UI/API.
- No ejecutar build antes de entregar.

