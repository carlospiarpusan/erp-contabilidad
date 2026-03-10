export type AppRole = 'superadmin' | 'admin' | 'contador' | 'vendedor' | 'solo_lectura'

export type AccessScope = 'read' | 'manage'

export type AppModule =
  | 'dashboard'
  | 'ventas'
  | 'clientes'
  | 'productos'
  | 'inventario'
  | 'compras'
  | 'gastos'
  | 'contabilidad'
  | 'informes'
  | 'configuracion'
  | 'notificaciones'
  | 'perfil'
  | 'documentacion'
  | 'superadmin'

type ModuleAccessRule = {
  read: readonly AppRole[]
  manage: readonly AppRole[]
}

type RouteAccess = {
  module: AppModule
  scope: AccessScope
}

type RouteRule = {
  prefix: string
  module: AppModule
  exact?: boolean
}

const TENANT_ROLES = ['admin', 'contador', 'vendedor', 'solo_lectura'] as const satisfies readonly AppRole[]
const VENTAS_WRITE_ROLES = ['admin', 'contador', 'vendedor'] as const satisfies readonly AppRole[]
const ACCOUNTING_ROLES = ['admin', 'contador'] as const satisfies readonly AppRole[]
const INFORMES_ROLES = ['admin', 'contador', 'vendedor'] as const satisfies readonly AppRole[]
const ADMIN_ROLES = ['admin'] as const satisfies readonly AppRole[]
const PROFILE_ROLES = ['superadmin', ...TENANT_ROLES] as const satisfies readonly AppRole[]
const SUPERADMIN_ROLES = ['superadmin'] as const satisfies readonly AppRole[]

export const ROLE_IDS = {
  admin: '10000000-0000-0000-0000-000000000001',
  vendedor: '10000000-0000-0000-0000-000000000002',
  contador: '10000000-0000-0000-0000-000000000003',
  solo_lectura: '10000000-0000-0000-0000-000000000004',
  superadmin: '10000000-0000-0000-0000-000000000005',
} as const satisfies Record<AppRole, string>

export const ROLE_LABELS = {
  admin: 'Admin',
  contador: 'Contador',
  vendedor: 'Vendedor',
  solo_lectura: 'Solo lectura',
  superadmin: 'Superadmin',
} as const satisfies Record<AppRole, string>

export const ROLE_BY_ID: Record<string, AppRole> = Object.fromEntries(
  Object.entries(ROLE_IDS).map(([role, id]) => [id, role as AppRole])
)

export const TENANT_ROLE_OPTIONS = [
  { id: ROLE_IDS.admin, nombre: 'admin', descripcion: 'Acceso completo al ERP' },
  { id: ROLE_IDS.contador, nombre: 'contador', descripcion: 'Contabilidad e informes' },
  { id: ROLE_IDS.vendedor, nombre: 'vendedor', descripcion: 'Ventas y clientes' },
  { id: ROLE_IDS.solo_lectura, nombre: 'solo_lectura', descripcion: 'Solo consultas' },
] as const

export const MODULE_ACCESS = {
  dashboard: { read: TENANT_ROLES, manage: VENTAS_WRITE_ROLES },
  ventas: { read: TENANT_ROLES, manage: VENTAS_WRITE_ROLES },
  clientes: { read: TENANT_ROLES, manage: VENTAS_WRITE_ROLES },
  productos: { read: TENANT_ROLES, manage: VENTAS_WRITE_ROLES },
  inventario: { read: ACCOUNTING_ROLES, manage: ACCOUNTING_ROLES },
  compras: { read: ACCOUNTING_ROLES, manage: ACCOUNTING_ROLES },
  gastos: { read: ACCOUNTING_ROLES, manage: ACCOUNTING_ROLES },
  contabilidad: { read: ACCOUNTING_ROLES, manage: ACCOUNTING_ROLES },
  informes: { read: INFORMES_ROLES, manage: INFORMES_ROLES },
  configuracion: { read: ADMIN_ROLES, manage: ADMIN_ROLES },
  notificaciones: { read: TENANT_ROLES, manage: TENANT_ROLES },
  perfil: { read: PROFILE_ROLES, manage: PROFILE_ROLES },
  documentacion: { read: TENANT_ROLES, manage: TENANT_ROLES },
  superadmin: { read: SUPERADMIN_ROLES, manage: SUPERADMIN_ROLES },
} as const satisfies Record<AppModule, ModuleAccessRule>

const PAGE_ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/superadmin', module: 'superadmin' },
  { prefix: '/configuracion/perfil', module: 'perfil' },
  { prefix: '/configuracion', module: 'configuracion' },
  { prefix: '/contabilidad', module: 'contabilidad' },
  { prefix: '/compras', module: 'compras' },
  { prefix: '/gastos', module: 'gastos' },
  { prefix: '/informes', module: 'informes' },
  { prefix: '/inventario/ajuste', module: 'inventario' },
  { prefix: '/notificaciones', module: 'notificaciones' },
  { prefix: '/documentacion', module: 'documentacion' },
  { prefix: '/productos', module: 'productos' },
  { prefix: '/clientes', module: 'clientes' },
  { prefix: '/ventas/recibos/sistecredito', module: 'contabilidad' },
  { prefix: '/ventas', module: 'ventas' },
  { prefix: '/pos', module: 'ventas' },
  { prefix: '/', module: 'dashboard', exact: true },
] as const

const API_ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/api/superadmin', module: 'superadmin' },
  { prefix: '/api/auditoria', module: 'configuracion' },
  { prefix: '/api/configuracion', module: 'configuracion' },
  { prefix: '/api/usuarios', module: 'configuracion', exact: true },
  { prefix: '/api/contabilidad', module: 'contabilidad' },
  { prefix: '/api/ventas/recibos/sistecredito', module: 'contabilidad' },
  { prefix: '/api/inventario/ajuste', module: 'inventario' },
  { prefix: '/api/compras', module: 'compras' },
  { prefix: '/api/gastos', module: 'gastos' },
  { prefix: '/api/clientes', module: 'clientes' },
  { prefix: '/api/productos', module: 'productos' },
  { prefix: '/api/ventas', module: 'ventas' },
  { prefix: '/api/documentos/duplicar', module: 'ventas' },
  { prefix: '/api/email', module: 'ventas' },
  { prefix: '/api/import', module: 'configuracion' },
  { prefix: '/api/export/compras', module: 'compras' },
  { prefix: '/api/export/pyg', module: 'contabilidad' },
  { prefix: '/api/export/balance-situacion', module: 'contabilidad' },
  { prefix: '/api/export/sumas-saldos', module: 'contabilidad' },
  { prefix: '/api/export/inventario', module: 'productos' },
  { prefix: '/api/export/ventas', module: 'informes' },
  { prefix: '/api/informes', module: 'informes' },
  { prefix: '/api/dashboard', module: 'dashboard' },
  { prefix: '/api/busqueda', module: 'dashboard' },
  { prefix: '/api/notificaciones', module: 'notificaciones' },
] as const

function matchesRule(pathname: string, rule: RouteRule) {
  return rule.exact ? pathname === rule.prefix : pathname.startsWith(rule.prefix)
}

function getRouteModule(pathname: string, rules: readonly RouteRule[]) {
  return rules.find((rule) => matchesRule(pathname, rule)) ?? null
}

export function resolveRoleById(roleId?: string | null): AppRole | null {
  if (!roleId) return null
  return ROLE_BY_ID[roleId] ?? null
}

export function getRoleLabel(role: AppRole) {
  return ROLE_LABELS[role]
}

export function getRoleLabelFromId(roleId?: string | null) {
  const role = resolveRoleById(roleId)
  return role ? getRoleLabel(role) : 'Sin rol'
}

export function getRolesForModule(module: AppModule, scope: AccessScope = 'read') {
  return MODULE_ACCESS[module][scope] as readonly AppRole[]
}

export function canAccessModule(role: AppRole, module: AppModule, scope: AccessScope = 'read') {
  return getRolesForModule(module, scope).includes(role)
}

export function getPageRouteAccess(pathname: string): RouteAccess | null {
  const match = getRouteModule(pathname, PAGE_ROUTE_RULES)
  return match ? { module: match.module, scope: 'read' } : null
}

export function getApiRouteAccess(pathname: string, method: string): RouteAccess | null {
  const match = getRouteModule(pathname, API_ROUTE_RULES)
  if (!match) return null

  const scope: AccessScope = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    ? 'read'
    : 'manage'

  return { module: match.module, scope }
}
