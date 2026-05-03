export default function EmptyState({
  message = "No stories here just yet.",
  hint = "We refresh every six hours — pop back soon.",
}: {
  message?: string
  hint?: string
}) {
  return (
    <div className="border-y border-paper-200 py-20 text-center">
      <p className="font-serif text-2xl text-ink">{message}</p>
      {hint && <p className="mt-2 text-[14px] text-ink-500">{hint}</p>}
    </div>
  )
}
