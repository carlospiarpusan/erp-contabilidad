'use client'

import { FileText, Printer, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

type FacturaPrintContext = 'factura' | 'pos'
type FacturaPrintFormat = 'normal' | 'termica'

interface Props {
  facturaId: string
  open: boolean
  onClose: () => void
  context?: FacturaPrintContext
}

function buildFacturaPrintUrl(facturaId: string, formato: FacturaPrintFormat) {
  const params = new URLSearchParams({ formato })
  return `/print/factura/${facturaId}?${params.toString()}`
}

export function FacturaPrintSelector({
  facturaId,
  open,
  onClose,
  context = 'factura',
}: Props) {
  const description = context === 'pos'
    ? 'Selecciona la impresora que vas a usar para imprimir la factura del POS.'
    : 'Elige si vas a imprimir la factura en una impresora normal o en una térmica.'

  function handleSelect(formato: FacturaPrintFormat) {
    const url = buildFacturaPrintUrl(facturaId, formato)
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo="Selecciona la impresora"
      descripcion={description}
      size="md"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleSelect('normal')}
          className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-teal-400 hover:bg-teal-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-teal-500 dark:hover:bg-teal-950/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Impresora normal</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Carta, A4 o media carta</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Abre la factura completa, con detalle amplio y formato de documento estándar.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('termica')}
          className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-teal-400 hover:bg-teal-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-teal-500 dark:hover:bg-teal-950/20"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Impresora térmica</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ticket angosto tipo POS</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Abre la factura en formato compacto para papel térmico de 80 mm.
          </p>
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          <Printer className="h-4 w-4" />
          Cerrar
        </Button>
      </div>
    </Modal>
  )
}
