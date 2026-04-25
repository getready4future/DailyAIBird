import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      {/* Breadcrumb */}
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">About</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">About</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">Daily AI Bird</h1>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        AI-assisted news intelligence for developers, researchers, and curious minds.
      </p>

      <Section title="What We Are">
        <p>
          Daily AI Bird is a news intelligence platform focused exclusively on the AI ecosystem — from research
          breakthroughs and product launches to policy debates and open-source releases. We use AI to help us
          process, summarise, and score hundreds of articles every day, so our editorial team can focus on
          surfacing what actually matters.
        </p>
        <p>
          Every article you see on this site has been processed by our AI pipeline <em>and</em> approved by a
          human editor. We are not a content farm. We are not fully automated. We're a hybrid — using AI as a
          force multiplier for human editorial judgment.
        </p>
      </Section>

      <Section title="How It Works">
        <p>
          Our pipeline continuously monitors dozens of trusted sources: academic preprint servers, research lab
          blogs, major tech publications, and developer communities. When a new article is published, our system:
        </p>
        <ol className="ml-4 list-decimal space-y-2">
          <li>Fetches and parses the full article text</li>
          <li>Uses Claude (Anthropic) to generate a concise summary and extract key claims</li>
          <li>Scores the article on relevance, impact, and curiosity for an AI-focused audience</li>
          <li>Clusters duplicate stories across multiple sources to surface the strongest version</li>
          <li>Queues the article for editorial review</li>
        </ol>
        <p>
          Only articles that pass editorial review are published. Editors can approve, reject, edit, or flag
          articles at any stage. AI scores are advisory — editorial judgment always takes precedence.
        </p>
      </Section>

      <Section title="Our Mission">
        <p>
          The AI field moves fast. Keeping up is a full-time job. Our mission is to reduce the signal-to-noise
          ratio for people who care about AI: surfacing the stories that matter, skipping the hype, and providing
          enough context to understand why something is significant — in 60 seconds or less per story.
        </p>
      </Section>

      <Section title="Transparency">
        <p>
          We believe in full transparency about how AI is used in our editorial process. You can read our
          detailed policies here:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li><Link to="/ai-use-policy" className="text-brand-600 hover:underline">AI Use Policy</Link> — exactly which AI tools we use and how</li>
          <li><Link to="/editorial-standards" className="text-brand-600 hover:underline">Editorial Standards</Link> — how we select and review content</li>
          <li><Link to="/corrections-policy" className="text-brand-600 hover:underline">Corrections Policy</Link> — how we handle errors</li>
        </ul>
      </Section>

      <Section title="Contact">
        <p>
          Have a question, tip, or correction? Reach us at{' '}
          <a href="mailto:hello@dailyaibird.com" className="text-brand-600 hover:underline">
            hello@dailyaibird.com
          </a>
          . For corrections, please use the corrections form on the relevant article page.
        </p>
      </Section>
    </div>
  )
}
