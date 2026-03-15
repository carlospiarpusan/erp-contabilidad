import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Clase base para tarjetas/paneles del sistema */
export const cardCls = 'rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatFecha(fecha: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fecha))
}

export function calcularTotal(
  cantidad: number,
  precioUnitario: number,
  descuentoPct: number,
  ivaPct: number
) {
  const subtotal = cantidad * precioUnitario
  const descuento = subtotal * (descuentoPct / 100)
  const base = subtotal - descuento
  const iva = base * (ivaPct / 100)
  return { subtotal, descuento, base, iva, total: base + iva }
}
