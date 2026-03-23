import { cn } from '@/utils/cn'

type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<BrandMarkSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
}

interface BrandMarkProps {
  size?: BrandMarkSize
  className?: string
}

export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-teal-500 via-emerald-500 to-emerald-600 shadow-[0_16px_34px_rgba(19,148,135,0.24)]',
        SIZE_CLASSES[size],
        className
      )}
    >
      <span className="absolute left-[17%] top-[17%] h-[28%] w-[28%] rounded-[70%_70%_58%_58%] bg-white/96 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="absolute right-[17%] top-[17%] h-[28%] w-[28%] rounded-[70%_70%_58%_58%] bg-white/96 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="absolute bottom-[17%] left-[17%] h-[28%] w-[28%] rounded-[58%_58%_70%_70%] bg-white/96 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="absolute bottom-[17%] right-[17%] h-[28%] w-[28%] rounded-[58%_58%_70%_70%] bg-white/96 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="absolute bottom-[8%] left-[48%] h-[22%] w-[8%] -translate-x-1/2 rotate-[24deg] rounded-full bg-white/92" />
      <span className="absolute h-[10%] w-[10%] rounded-full bg-emerald-50/95" />
    </div>
  )
}
