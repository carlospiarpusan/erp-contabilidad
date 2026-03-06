# ERP Contable — Plataforma SaaS Multiempresa

Plataforma SaaS colombiana para gestión comercial y contable, construida con **Next.js 15** y **Supabase**. Permite que múltiples empresas lleven su contabilidad de forma independiente: cada empresa tiene sus propios usuarios, datos y configuración completamente aislados del resto.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router, Server Components) |
| Estilos | Tailwind CSS |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Autenticación | Supabase Auth (JWT) |
| Despliegue | Vercel |

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| **superadmin** | Panel global: gestión de empresas y usuarios de toda la plataforma |
| **admin** | Acceso completo al ERP de su empresa |
| **contador** | Ventas, compras, gastos, contabilidad, informes |
| **vendedor** | Ventas, clientes, productos, informes básicos |
| **solo_lectura** | Vista de ventas, clientes y productos sin modificar |

Cada empresa es completamente independiente. Un usuario solo puede ver y modificar los datos de su propia empresa (RLS en Supabase).

---

## Módulos del ERP

### Ventas
- **Facturas de venta** — emisión, seguimiento, impresión PDF
- **Recibos de caja** — registro de cobros
- **Cotizaciones** — presupuestos con conversión a factura
- **Pedidos** — órdenes de clientes
- **Remisiones** — despachos sin factura
- **Lista de precios** — precios por producto
- **Garantías** — gestión de devoluciones
- **Servicio técnico** — órdenes de servicio

### Clientes
- Directorio de clientes con grupos y segmentación
- Vista de mejores clientes por volumen de compras
- Vista de deudores con cartera por cobrar

### Compras
- **Facturas de compra** — registro de compras a proveedores
- **Órdenes de compra** — solicitudes a proveedores
- **Recibos de compra** — entrada de mercancía
- **Proveedores** — directorio de proveedores

### Productos
- Catálogo de artículos con familias y fabricantes
- Control de stock bajo
- Catálogo público

### Gastos
- Registro de gastos operacionales por tipo
- Acreedores

### Contabilidad
- Asientos contables
- PUC (Plan Único de Cuentas)
- Cuentas especiales
- Ejercicios contables
- Impuestos y retenciones
- Formas de pago
- Consecutivos de documentos

### Informes
- **Balances** — ventas vs compras vs gastos → utilidad por mes
- Informes de facturas, pedidos, cotizaciones, remisiones
- Informes de artículos, clientes y recibos

### Configuración (solo admin)
- Datos de la empresa
- Colaboradores
- Bodegas y transportadoras
- Gestión de usuarios de la empresa

---

## Panel Superadmin (`/superadmin`)

Exclusivo para el superadministrador de la plataforma (`carlospt@live.com`).

- **Dashboard global** — estadísticas de todas las empresas: total empresas, usuarios, facturas, volumen de ventas/compras
- **Empresas** — crear, ver y gestionar todas las empresas registradas
- **Usuarios** — ver todos los usuarios de la plataforma, crear nuevos, cambiar roles, activar/desactivar

El superadmin no tiene acceso a los módulos ERP de ninguna empresa.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (dashboard)/          # Páginas protegidas del ERP
│   │   ├── page.tsx          # Dashboard principal
│   │   ├── layout.tsx        # Layout con Sidebar + Header
│   │   ├── ventas/           # Facturas, recibos, cotizaciones, pedidos...
│   │   ├── clientes/         # Lista, grupos, detalle
│   │   ├── compras/          # Facturas, órdenes, proveedores
│   │   ├── productos/        # Artículos, stock, catálogo
│   │   ├── gastos/           # Gastos y acreedores
│   │   ├── contabilidad/     # Asientos, PUC, impuestos
│   │   ├── informes/         # Balances e informes
│   │   ├── configuracion/    # Empresa, usuarios, bodegas
│   │   └── superadmin/       # Panel de administración global
│   ├── api/                  # API Routes (Next.js)
│   │   ├── ventas/
│   │   ├── compras/
│   │   ├── gastos/
│   │   ├── clientes/
│   │   ├── usuarios/
│   │   └── superadmin/       # APIs protegidas solo para superadmin
│   ├── print/                # Páginas de impresión PDF (sin auth)
│   └── login/                # Página de inicio de sesión
├── components/
│   ├── layout/               # Sidebar, Header
│   ├── clientes/
│   ├── ventas/
│   ├── superadmin/           # Formularios y tablas del panel admin
│   └── ...
├── lib/
│   ├── auth/
│   │   └── session.ts        # getSession() — sesión del usuario con rol
│   ├── db/                   # Funciones de acceso a datos por módulo
│   │   ├── ventas.ts
│   │   ├── compras.ts
│   │   ├── clientes.ts
│   │   ├── informes.ts
│   │   └── superadmin.ts     # Estadísticas globales con service_role
│   └── supabase/             # Clientes Supabase (server, client, middleware)
├── proxy.ts                  # Middleware Next.js (autenticación básica)
└── utils/
    └── cn.ts                 # Utilidades CSS + formatCOP
```

---

## Variables de entorno

Configura en `.env.local` (local) y en **Vercel → Settings → Environment Variables** (producción):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> `SUPABASE_SERVICE_ROLE_KEY` es necesaria para las APIs del superadmin (crear empresas, crear usuarios) y para leer estadísticas globales.

---

## Base de datos

### Tablas principales

| Tabla | Descripción |
|---|---|
| `empresas` | Empresas registradas en la plataforma |
| `usuarios` | Usuarios con `empresa_id` y `rol_id` |
| `roles` | Roles: superadmin, admin, contador, vendedor, solo_lectura |
| `documentos` | Facturas venta/compra, cotizaciones, pedidos, remisiones, gastos |
| `clientes` | Clientes por empresa |
| `productos` | Productos/artículos por empresa |
| `proveedores` | Proveedores por empresa |
| `recibos` | Cobros y pagos |

### RLS (Row Level Security)

Todas las tablas tienen RLS activo. Cada usuario solo puede leer/escribir datos de su propia empresa. El superadmin usa `service_role` para acceso global.

### IDs fijos de roles

```
10000000-0000-0000-0000-000000000001  →  admin
10000000-0000-0000-0000-000000000002  →  vendedor
10000000-0000-0000-0000-000000000003  →  contador
10000000-0000-0000-0000-000000000004  →  solo_lectura
10000000-0000-0000-0000-000000000005  →  superadmin
```

---

## Instalación local

```bash
# 1. Clonar repositorio
git clone https://github.com/carlospiarpusan/erp-contabilidad.git
cd erp-contabilidad

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Despliegue en Vercel

1. Importa el repositorio en [vercel.com](https://vercel.com)
2. Agrega las tres variables de entorno en **Settings → Environment Variables**
3. El build command es `npm run build` (detectado automáticamente)
4. Cada push a `main` despliega automáticamente

---

## Notas

- Moneda configurada en pesos colombianos (COP)
- Cada empresa que se registra en la plataforma opera de forma completamente independiente
- El superadmin gestiona la plataforma globalmente sin acceso a los datos de ninguna empresa
