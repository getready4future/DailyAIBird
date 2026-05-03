import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-serif text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="space-y-4 font-serif text-[17px] leading-[1.65] text-ink-700">{children}</div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-reading">
      <Helmet>
        <title>About — Daily AI Bird</title>
        <meta
          name="description"
          content="Daily AI Bird cuts through the AI hype. Five minutes of curated AI news every morning, summarised in plain language and reviewed by humans."
        />
        <link rel="canonical" href="https://dailyaibird.com/about" />
      </Helmet>

      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
        <Link to="/" className="hover:text-ink transition-colors">Home</Link>
        <span>/</span>
        <span className="text-ink-500">About</span>
      </nav>

      <p className="eyebrow mb-2">About</p>
      <h1 className="mb-4 font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-[1.05]">
        Daily AI Bird
      </h1>
      <p className="mb-12 font-serif text-[19px] leading-[1.55] text-ink-500 max-w-prose">
        Cut through the AI hype. Every morning: the stories that actually matter,
        summarised in plain language, reviewed by humans — no ads, no clickbait,
        no <em>"prompt engineer"</em> threads.
      </p>

      <Section title="Who this is for">
        <p>
          Most AI coverage is written for one of two crowds: hardcore researchers reading arXiv
          all day, or hype-chasers retweeting whatever sounds exciting. Both are exhausting.
        </p>
        <p>
          Daily AI Bird is for the rest of us — curious readers who use AI tools, follow the
          field casually, and want to understand what's happening without parsing benchmark
          tables or sitting through Twitter drama. If you read The Atlantic, MIT Tech Review,
          or Hard Fork and want a daily five-minute briefing, you're in the right place.
        </p>
        <p>
          Researchers and developers are welcome too — we surface arXiv preprints and
          open-source releases the same morning they drop.
        </p>
      </Section>

      <Section title="How a story reaches this site">
        <ol className="list-decimal pl-5 space-y-2.5 marker:font-mono marker:text-ink-400">
          <li>
            <strong className="text-ink">Scrape.</strong> Every six hours, we pull from a
            curated list of AI lab blogs, research servers, tier-1 tech press, and developer
            communities. (See the full list on the <Link to="/sources" className="text-brand-700 underline-grow">Sources</Link> page.)
          </li>
          <li>
            <strong className="text-ink">Quality gate.</strong> Claude evaluates each article
            against our <Link to="/editorial-standards" className="text-brand-700 underline-grow">editorial standards</Link>:
            verifiable facts, named sources, genuine novelty. Marketing fluff and rumour-mill
            posts are filtered out.
          </li>
          <li>
            <strong className="text-ink">Plain-language summary.</strong> The articles that
            pass are rewritten in two passes — fidelity first, then voice — to read smoothly
            without sacrificing accuracy. Every fact in our summary can be traced back to the
            original source.
          </li>
          <li>
            <strong className="text-ink">Human review.</strong> An editor reads the queue,
            approves what holds up, rejects what doesn't, and writes the daily digest.
          </li>
          <li>
            <strong className="text-ink">Publish.</strong> Only articles that clear human
            review appear on the site or in the morning email.
          </li>
        </ol>
        <p>
          AI scores are advisory. A human always has the final word, and you can read our
          full <Link to="/ai-use-policy" className="text-brand-700 underline-grow">AI Use Policy</Link> for
          the details.
        </p>
      </Section>

      <Section title="Why we exist">
        <p>
          The AI field moves fast and gets reported badly. A good morning briefing should
          tell you what changed, why it matters, and what to actually do with the information —
          in five minutes, not fifty tabs.
        </p>
        <p>
          We measure success the way a small magazine does: are readers getting smarter
          about AI, or are we just adding to the noise? If the answer drifts toward the
          latter, we change what we're doing.
        </p>
      </Section>

      <Section title="Transparency">
        <p>The full editorial paperwork, in plain English:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
          <li><Link to="/editorial-standards" className="text-brand-700 underline-grow">Editorial standards</Link> — what we publish and what we don't</li>
          <li><Link to="/ai-use-policy" className="text-brand-700 underline-grow">AI use policy</Link> — exactly how Claude is used in the pipeline</li>
          <li><Link to="/corrections-policy" className="text-brand-700 underline-grow">Corrections policy</Link> — how we handle errors when (not if) we make them</li>
          <li><Link to="/advertising-policy" className="text-brand-700 underline-grow">Advertising policy</Link> — what we will and won't ever do</li>
          <li><Link to="/privacy-policy" className="text-brand-700 underline-grow">Privacy policy</Link> — what we collect (very little) and why</li>
        </ul>
      </Section>

      <Section title="Get in touch">
        <p>
          Tip, correction, complaint, partnership, or kind word — we read every email at{' '}
          <a href="mailto:hello@dailyaibird.com" className="text-brand-700 underline-grow">
            hello@dailyaibird.com
          </a>
          . For corrections to a specific story, the "Report an error" link at the bottom
          of every article goes straight to the editor on duty.
        </p>
      </Section>
    </div>
  )
}
