import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const from   = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

export function getResend() {
  if (!apiKey || apiKey === 're_YOUR_API_KEY_HERE') {
    throw new Error('RESEND_API_KEY no está configurada. Agrégala en .env.local')
  }
  return new Resend(apiKey)
}

export { from as emailFrom }

// ── Plantillas HTML básicas ────────────────────────────────────────────────

export function htmlFactura(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; total: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #2563eb; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .total { font-size: 22px; font-weight: 700; color: #2563eb; font-family: monospace; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Adjuntamos la siguiente factura de venta:</p>
      <div class="kv"><span>Número</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <div class="kv"><span>Total</span><span class="total">${params.total}</span></div>
      <a href="${params.link}" class="btn">Ver factura completa →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}

export function htmlCotizacion(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; vencimiento: string; total: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #7c3aed; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .total { font-size: 22px; font-weight: 700; color: #7c3aed; font-family: monospace; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #7c3aed; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Le enviamos la siguiente cotización:</p>
      <div class="kv"><span>Cotización N°</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <div class="kv"><span>Válida hasta</span><span>${params.vencimiento}</span></div>
      <div class="kv"><span>Total</span><span class="total">${params.total}</span></div>
      <a href="${params.link}" class="btn">Ver cotización completa →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}

export function htmlNotaCredito(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; motivo: string; total: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #dc2626; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .total { font-size: 22px; font-weight: 700; color: #dc2626; font-family: monospace; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #dc2626; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Le informamos que se ha generado la siguiente nota crédito a su favor:</p>
      <div class="kv"><span>Nota Crédito N°</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <div class="kv"><span>Motivo</span><span>${params.motivo}</span></div>
      <div class="kv"><span>Valor</span><span class="total">${params.total}</span></div>
      <a href="${params.link}" class="btn">Ver nota crédito →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}

export function htmlNotaDebito(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; motivo: string; total: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #d97706; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .total { font-size: 22px; font-weight: 700; color: #d97706; font-family: monospace; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #d97706; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Le informamos que se ha generado la siguiente nota débito:</p>
      <div class="kv"><span>Nota Débito N°</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <div class="kv"><span>Motivo</span><span>${params.motivo}</span></div>
      <div class="kv"><span>Total</span><span class="total">${params.total}</span></div>
      <a href="${params.link}" class="btn">Ver nota débito →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}

export function htmlPedido(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; total: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #0891b2; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .total { font-size: 22px; font-weight: 700; color: #0891b2; font-family: monospace; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #0891b2; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Hemos recibido su pedido y está en proceso:</p>
      <div class="kv"><span>Pedido N°</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <div class="kv"><span>Total estimado</span><span class="total">${params.total}</span></div>
      <a href="${params.link}" class="btn">Ver pedido completo →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}

export function htmlRemision(params: {
  empresa: string; nit: string
  cliente: string; numero: string
  fecha: string; link: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .header { background: #059669; color: #fff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
  .body { padding: 32px; }
  .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .kv span:first-child { color: #6b7280; }
  .kv span:last-child { font-weight: 600; }
  .btn { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #059669; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; text-align: center; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${params.empresa}</h1>
      <p>NIT: ${params.nit}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-top:0">Hola <strong>${params.cliente}</strong>,</p>
      <p style="font-size:14px;color:#6b7280">Le informamos el despacho del siguiente pedido:</p>
      <div class="kv"><span>Remisión N°</span><span>${params.numero}</span></div>
      <div class="kv"><span>Fecha</span><span>${params.fecha}</span></div>
      <a href="${params.link}" class="btn">Ver remisión completa →</a>
    </div>
    <div class="footer">Este correo fue enviado automáticamente desde el sistema ERP.</div>
  </div>
</body></html>`
}
