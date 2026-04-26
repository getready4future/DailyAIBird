import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
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

  const digestTitle = digest.headline
    ? `${digest.headline} — Daily AI Bird Digest`
    : `AI News Digest ${digest.digest_date} — Daily AI Bird`

  return (
    <div className="mx-auto max-w-3xl">
      <Helmet>
        <title>{digestTitle}</title>
        <meta name="description" content={digest.intro?.slice(0, 160) ?? 'The daily AI news digest from Daily AI Bird.'} />
        <link rel="canonical" href={`https://dailyaibird.com/digest${date ? `/${date}` : ''}`} />
        <meta property="og:title" content={digestTitle} />
        <meta property="og:type" content="article" />
      </Helmet>
      <DigestHero digest={digest} />
      {digest.sections.map((section, i) => (
        <DigestSectionComp key={i} section={section} />
      ))}
    </div>
  )
}
