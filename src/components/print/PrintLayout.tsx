/**
 * PrintLayout — injects CSS for the selected PDF template.
 * Usage: add data-plantilla={plantilla} to root div, then render <PrintLayout plantilla={plantilla} />.
 */

export type Plantilla = 'clasica' | 'moderna' | 'minimalista' | 'compacta'

export const PLANTILLA_LABELS: Record<Plantilla, string> = {
  clasica:     'Clásica',
  moderna:     'Moderna',
  minimalista: 'Minimalista',
  compacta:    'Compacta',
}

export function PrintLayout({ plantilla }: { plantilla?: string | null }) {
  const p = (plantilla ?? 'clasica') as Plantilla
  const css = getPlantillaCSS(p)
  if (!css) return null
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

function getPlantillaCSS(p: Plantilla): string {
  switch (p) {
    case 'moderna':
      return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        [data-plantilla=moderna] { font-family: 'Inter', sans-serif; }
        [data-plantilla=moderna] .print-header-empresa h1 { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.02em; }
        [data-plantilla=moderna] .print-header-empresa { padding: 20px 24px; background: #1e3a8a; color: white; margin: -32px -32px 32px; }
        [data-plantilla=moderna] .print-header-empresa p { color: rgba(255,255,255,0.75); }
        [data-plantilla=moderna] .print-doc-number { background: white; color: #1e3a8a; border: none; border-radius: 8px; padding: 8px 12px; }
        [data-plantilla=moderna] .print-doc-number p:last-child { color: #1e3a8a; font-size: 1.6rem; }
        [data-plantilla=moderna] thead tr { background: #eff6ff; }
        [data-plantilla=moderna] th { color: #1e40af !important; }
      `
    case 'minimalista':
      return `
        [data-plantilla=minimalista] .print-header-empresa { border-bottom: 1px solid #e5e7eb; margin-bottom: 32px; padding-bottom: 16px; }
        [data-plantilla=minimalista] .print-header-empresa h1 { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        [data-plantilla=minimalista] .print-doc-number { border: none !important; box-shadow: none; }
        [data-plantilla=minimalista] .print-doc-number p:last-child { font-size: 1.8rem; font-weight: 300; }
        [data-plantilla=minimalista] table th, [data-plantilla=minimalista] table td { border-bottom: 1px solid #f3f4f6 !important; }
        [data-plantilla=minimalista] thead tr { border-bottom: 1px solid #111827 !important; }
      `
    case 'compacta':
      return `
        [data-plantilla=compacta] { font-size: 11px; }
        [data-plantilla=compacta] h1 { font-size: 0.85rem !important; }
        [data-plantilla=compacta] p, [data-plantilla=compacta] td, [data-plantilla=compacta] th { font-size: 10px !important; }
        [data-plantilla=compacta] .max-w-2xl { max-width: 520px; }
        [data-plantilla=compacta] table th, [data-plantilla=compacta] table td { padding: 3px 6px !important; }
        [data-plantilla=compacta] .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
        [data-plantilla=compacta] .mb-8 { margin-bottom: 12px !important; }
        [data-plantilla=compacta] .pb-6 { padding-bottom: 8px !important; }
        [data-plantilla=compacta] .mt-12 { margin-top: 16px !important; }
      `
    default: // clasica — no extra CSS needed
      return ''
  }
}
