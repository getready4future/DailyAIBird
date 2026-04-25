import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function AiUsePolicy() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <Link to="/about" className="hover:text-gray-600">About</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">AI Use Policy</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">Transparency</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">AI Use Policy</h1>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        We use AI extensively. Here is exactly how, where, and why.
      </p>

      <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900 mb-1">Summary</p>
        <p className="text-sm text-amber-800 leading-relaxed">
          AI generates summaries and scores articles. Humans approve every article before it appears on the site.
          AI does not write headlines. AI does not make publish/reject decisions. AI output is always disclosed.
        </p>
      </div>

      <Section title="Which AI Systems We Use">
        <p>
          Our primary AI pipeline uses <strong>Claude</strong> (made by Anthropic) for article processing.
          Claude is used to:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Extract and summarise key claims from source articles</li>
          <li>Score articles on relevance, impact, and curiosity for an AI-focused audience</li>
          <li>Identify the primary topic category (research, products, policy, etc.)</li>
          <li>Extract named entities (companies, researchers, products mentioned)</li>
          <li>Detect sentiment (positive / neutral / negative framing)</li>
          <li>Generate the Daily Digest headline and section summaries</li>
        </ul>
      </Section>

      <Section title="What AI Does NOT Do">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>AI does not write or rewrite article headlines (these come from the original source)</li>
          <li>AI does not make final publish or reject decisions (editors do)</li>
          <li>AI does not generate original reporting, news, or analysis</li>
          <li>AI does not modify the factual content of source articles</li>
          <li>AI does not personalize content based on user data</li>
        </ul>
      </Section>

      <Section title="Human Oversight">
        <p>
          Every article goes through human editorial review before publication. Our editors can:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Approve or reject any article regardless of AI score</li>
          <li>Edit AI-generated summaries before publication</li>
          <li>Override topic classification</li>
          <li>Flag articles for further review or add correction notices</li>
        </ul>
        <p>
          The editorial team is responsible for all published content. AI scores and summaries are tools
          to assist editorial judgment, not replace it.
        </p>
      </Section>

      <Section title="Accuracy & Errors">
        <p>
          AI-generated summaries can contain errors. We take reasonable steps to catch these through
          editorial review, but we cannot guarantee 100% accuracy. If you notice a factual error in a
          summary, please contact us at{' '}
          <a href="mailto:corrections@dailyaibird.com" className="text-brand-600 hover:underline">
            corrections@dailyaibird.com
          </a>{' '}
          or use the corrections process described in our{' '}
          <Link to="/corrections-policy" className="text-brand-600 hover:underline">Corrections Policy</Link>.
        </p>
        <p>
          <strong>Always read the original source article</strong> before sharing, citing, or acting on
          any information found on this site.
        </p>
      </Section>

      <Section title="Data & Privacy">
        <p>
          When processing articles, we send the article text to Anthropic's API. We do not send user data
          to any AI provider. No reader behaviour or personal information is used in AI processing.
          See our <Link to="/privacy-policy" className="text-brand-600 hover:underline">Privacy Policy</Link> for details.
        </p>
      </Section>

      <Section title="Policy Updates">
        <p>
          This policy reflects our current AI use as of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.
          As our systems evolve, we will update this page. Material changes will be noted in our changelog.
        </p>
      </Section>
    </div>
  )
}
