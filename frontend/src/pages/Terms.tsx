import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">Terms of Use</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">Legal</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">Terms of Use</h1>
      <p className="mb-2 text-sm text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        Please read these terms before using Daily AI Bird.
      </p>

      <Section title="Acceptance of Terms">
        <p>
          By using Daily AI Bird ("the Service"), you agree to these Terms of Use. If you do not agree,
          please do not use the Service.
        </p>
      </Section>

      <Section title="Description of Service">
        <p>
          Daily AI Bird is a news aggregation and intelligence platform. We collect, process, and summarise
          publicly available articles about artificial intelligence. Summaries are generated with AI assistance
          and reviewed by human editors. We link to original source articles and do not claim ownership of
          source content.
        </p>
      </Section>

      <Section title="Content Accuracy">
        <p>
          While we strive for accuracy, Daily AI Bird does not warrant that summaries or editorial scores
          are error-free. AI-generated summaries may contain inaccuracies. Always refer to the original
          source article for authoritative information. The Service is provided for informational purposes
          only and is not a substitute for professional advice.
        </p>
      </Section>

      <Section title="Intellectual Property">
        <p>
          Article summaries and editorial content created by Daily AI Bird are our intellectual property.
          Original article content belongs to the respective source publications. Source links are provided
          for attribution and under fair use for transformative commentary.
        </p>
        <p>
          You may share links to Daily AI Bird content. You may not scrape, reproduce, or redistribute
          our summaries at scale without permission.
        </p>
      </Section>

      <Section title="Prohibited Use">
        <p>You agree not to:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Scrape or bulk-download content via automated means without permission</li>
          <li>Use the Service to train AI models without a separate licensing agreement</li>
          <li>Misrepresent our AI-generated summaries as original source reporting</li>
          <li>Attempt to gain unauthorised access to our systems</li>
        </ul>
      </Section>

      <Section title="Disclaimer of Warranties">
        <p>
          The Service is provided "as is" without warranties of any kind. We do not guarantee
          uninterrupted access, real-time updates, or fitness for any particular purpose.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          Daily AI Bird is not liable for damages arising from use of or reliance on content on this Service,
          including but not limited to financial, professional, or personal decisions based on our summaries.
        </p>
      </Section>

      <Section title="Changes to Terms">
        <p>
          We may update these terms. Continued use of the Service after changes constitutes acceptance
          of the updated terms. Significant changes will be announced on the site.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Legal questions:{' '}
          <a href="mailto:legal@dailyaibird.com" className="text-brand-600 hover:underline">
            legal@dailyaibird.com
          </a>
        </p>
      </Section>
    </div>
  )
}
