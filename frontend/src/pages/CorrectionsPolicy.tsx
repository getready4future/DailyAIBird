import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function CorrectionsPolicy() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <Link to="/editorial-standards" className="hover:text-gray-600">Editorial Standards</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">Corrections Policy</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">Transparency</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">Corrections Policy</h1>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        We correct errors quickly, transparently, and without deleting history.
      </p>

      <Section title="Our Commitment">
        <p>
          Accuracy matters. When we make a mistake — whether in an AI-generated summary or in editorial
          judgement — we correct it promptly, label the correction clearly, and do not silently delete
          or overwrite the original content.
        </p>
      </Section>

      <Section title="Types of Corrections">
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="font-semibold text-gray-800 mb-1">Minor correction</p>
            <p>Spelling, punctuation, or minor factual clarifications that do not change the substance of a story. These are corrected inline without a separate notice, as they do not affect the integrity of the reporting.</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900 mb-1">Significant correction</p>
            <p className="text-amber-800">Factual errors that materially misrepresent the source material. These receive a clearly labelled correction notice at the top of the article, noting what was changed and when.</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="font-semibold text-red-900 mb-1">Retraction</p>
            <p className="text-red-800">In rare cases where an article is fundamentally flawed and cannot be corrected, it will be retracted. Retracted articles are replaced with a retraction notice explaining why — they are not silently removed.</p>
          </div>
        </div>
      </Section>

      <Section title="How to Submit a Correction">
        <p>
          If you believe an article contains an error, please email us at{' '}
          <a href="mailto:corrections@dailyaibird.com" className="text-brand-600 hover:underline">
            corrections@dailyaibird.com
          </a>{' '}
          with:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>The URL of the article</li>
          <li>The specific claim you believe is incorrect</li>
          <li>A source or evidence supporting the correction</li>
        </ul>
        <p>We aim to review correction requests within 24 hours on weekdays.</p>
      </Section>

      <Section title="AI-Specific Corrections">
        <p>
          Because summaries are AI-generated, they may diverge from source material in subtle ways.
          Common AI errors include: over-simplification, slight misattribution, or omission of important
          caveats from the original. We take these seriously — they affect reader trust.
        </p>
        <p>
          If a summary inaccurately represents the original article, please report it. We will compare
          against the source and correct the summary if warranted.
        </p>
      </Section>
    </div>
  )
}
