import { useParams } from 'react-router-dom'
import { useTodayDigest, useDigestByDate } from '../hooks/useDigest'
import DigestHero from '../components/digest/DigestHero'
import DigestSectionComp from '../components/digest/DigestSection'
import Spinner from '../components/ui/Spinner'

export default function DailyDigest() {
  const { date } = useParams<{ date?: string }>()
  const todayQuery = useTodayDigest()
  const dateQuery = useDigestByDate(date || '')

  const query = date ? dateQuery : todayQuery
  const { data: digest, isLoading, error } = query

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  if (error || !digest) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-500">
          {date
            ? `No digest available for ${date}.`
            : "Today's digest hasn't been published yet. Check back after 7:15 AM UTC."}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <DigestHero digest={digest} />
      {digest.sections.map((section, i) => (
        <DigestSectionComp key={i} section={section} />
      ))}
    </div>
  )
}
