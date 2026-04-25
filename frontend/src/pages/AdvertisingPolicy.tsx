import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function AdvertisingPolicy() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">Advertising Policy</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">Legal</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">Advertising Policy</h1>
      <p className="mb-2 text-sm text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        Our commitments on advertising, sponsored content, and affiliate relationships.
      </p>

      <Section title="Editorial Independence">
        <p>
          Advertising and sponsorship relationships never influence editorial decisions. Advertisers
          cannot pay to have their products or services covered, excluded, or favourably reviewed.
          Source selection and article curation are conducted independently of commercial relationships.
        </p>
      </Section>

      <Section title="Advertising Disclosure">
        <p>
          All advertising on Daily AI Bird is clearly labelled. Display advertisements are marked with
          an "Advertisement" label. Sponsored content (if any) will be labelled "Sponsored" or
          "Partner Content" in a visible location at the top of the content.
        </p>
        <p>
          We will never publish sponsored content that mimics editorial content without clear disclosure.
        </p>
      </Section>

      <Section title="Affiliate Links">
        <p>
          Daily AI Bird may use affiliate links when linking to products or services. When a link is
          affiliate-tracked, it will be disclosed with an "(affiliate link)" notation or a site-wide
          affiliate disclosure notice. Affiliate relationships do not influence which products we
          mention or recommend.
        </p>
      </Section>

      <Section title="Acceptable Advertising Categories">
        <p>We accept advertising from:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>AI tools, platforms, and developer services</li>
          <li>Technical education and training programs</li>
          <li>Developer-focused SaaS products</li>
          <li>AI research conferences and events</li>
        </ul>
        <p>We do not accept advertising for:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Gambling, adult content, or weapons</li>
          <li>Financial products making performance guarantees</li>
          <li>Health claims that are unsubstantiated</li>
          <li>Political candidates or parties</li>
        </ul>
      </Section>

      <Section title="Advertising Enquiries">
        <p>
          To advertise on Daily AI Bird, contact:{' '}
          <a href="mailto:ads@dailyaibird.com" className="text-brand-600 hover:underline">
            ads@dailyaibird.com
          </a>
        </p>
      </Section>
    </div>
  )
}
