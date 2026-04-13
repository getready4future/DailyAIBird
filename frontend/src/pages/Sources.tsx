import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useSources } from '../hooks/useSources'
import Spinner from '../components/ui/Spinner'

const CATEGORY_COLORS: Record<string, string> = {
  blog: 'bg-purple-100 text-purple-700',
  news: 'bg-blue-100 text-blue-700',
  research: 'bg-indigo-100 text-indigo-700',
  social: 'bg-green-100 text-green-700',
}

export default function Sources() {
  const { data: sources, isLoading } = useSources()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">News Sources</h1>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Last Scraped</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Articles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(sources || []).map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/?source_slug=${s.slug}`} className="font-medium text-brand-600 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[s.category] || 'bg-gray-100 text-gray-600'}`}>
                    {s.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.last_scraped_at
                    ? formatDistanceToNow(new Date(s.last_scraped_at), { addSuffix: true })
                    : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/?source_slug=${s.slug}`} className="text-brand-600 hover:underline">
                    Browse →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
