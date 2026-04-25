type Size = 'leaderboard' | 'rectangle' | 'sidebar'

const SIZES: Record<Size, { label: string; cls: string }> = {
  leaderboard: { label: '728×90 — Leaderboard', cls: 'h-[90px] w-full max-w-[728px]' },
  rectangle:   { label: '300×250 — Medium Rectangle', cls: 'h-[250px] w-[300px]' },
  sidebar:     { label: '160×600 — Wide Skyscraper', cls: 'h-[600px] w-[160px]' },
}

interface Props {
  size?: Size
  label?: string
}

export default function AdPlaceholder({ size = 'rectangle', label }: Props) {
  const { label: defaultLabel, cls } = SIZES[size]
  return (
    <div className={`${cls} flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 mx-auto`}>
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Advertisement</p>
        <p className="mt-0.5 text-[10px] text-gray-300">{label || defaultLabel}</p>
      </div>
    </div>
  )
}
