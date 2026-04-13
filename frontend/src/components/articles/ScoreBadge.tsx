export default function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const pct = Math.round(score * 100)
  const label = score >= 0.85 ? 'High Impact' : score >= 0.65 ? 'Notable' : 'General'
  const cls =
    score >= 0.85
      ? 'bg-emerald-100 text-emerald-800'
      : score >= 0.65
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label} · {pct}%
    </span>
  )
}
