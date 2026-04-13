import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fetchPendingDigests, approveDigest, rejectDigest } from '../api/admin'
import type { DailyDigest } from '../types'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import TopicBadge from '../components/ui/TopicBadge'

function DigestPreviewCard({ digest, onApprove, onReject }: {
  digest: DailyDigest
  onApprove: (id: number) => void
  onReject: (id: number) => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">
        {format(new Date(digest.digest_date), 'MMMM d, yyyy')}
      </div>
      <h2 className="mb-3 text-xl font-bold text-gray-900">{digest.headline}</h2>
      <p className="mb-4 text-sm text-gray-600 leading-relaxed">{digest.intro}</p>

      <div className="mb-4 space-y-3">
        {digest.sections.map((section, i) => (
          <div key={i} className="rounded-lg bg-gray-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <TopicBadge topic={section.topic} />
              <span className="text-sm font-semibold text-gray-700">{section.heading}</span>
            </div>
            <ul className="space-y-1 text-xs text-gray-600">
              {section.items.slice(0, 3).map((item, j) => (
                <li key={j}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {item.title}
                  </a>
                  <span className="text-gray-400"> — {item.one_liner}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{digest.article_count} articles · {digest.model_used}</span>
        <div className="flex gap-3">
          <button
            onClick={() => onReject(digest.id)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
          >
            Reject
          </button>
          <button
            onClick={() => onApprove(digest.id)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            Approve & Publish
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDigests() {
  const qc = useQueryClient()

  const { data: digests = [], isLoading } = useQuery({
    queryKey: ['admin-digests-pending'],
    queryFn: fetchPendingDigests,
  })

  const approveMut = useMutation({
    mutationFn: approveDigest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-digests-pending'] }),
  })

  const rejectMut = useMutation({
    mutationFn: rejectDigest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-digests-pending'] }),
  })

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Digest Review</h1>
      <p className="mb-6 text-sm text-gray-500">Review and approve AI-generated daily digests before publishing.</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : digests.length === 0 ? (
        <EmptyState message="No digests pending review." />
      ) : (
        <div className="space-y-6">
          {digests.map((d) => (
            <DigestPreviewCard
              key={d.id}
              digest={d}
              onApprove={(id) => approveMut.mutate(id)}
              onReject={(id) => rejectMut.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
