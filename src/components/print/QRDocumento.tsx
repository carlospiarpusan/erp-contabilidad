'use client'

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  url: string
  size?: number
}

export function QRDocumento({ url, size = 80 }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCodeSVG value={url} size={size} level="M" />
      <p className="text-xs text-gray-400 text-center" style={{ fontSize: '9px' }}>Escanear para ver online</p>
    </div>
  )
}
