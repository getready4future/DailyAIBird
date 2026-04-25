import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <nav className="mb-6 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600">Privacy Policy</span>
      </nav>

      <p className="mb-2 text-[11px] font-bold tracking-widest text-brand-600 uppercase">Legal</p>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-gray-950">Privacy Policy</h1>
      <p className="mb-2 text-sm text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p className="mb-10 text-lg text-gray-500 leading-relaxed">
        We collect minimal data and we do not sell it.
      </p>

      <Section title="What We Collect">
        <p>Daily AI Bird collects only what is necessary to operate the service:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li><strong>Server logs</strong> — IP address, request path, timestamp, and browser user-agent. Retained for up to 30 days for security and abuse prevention.</li>
          <li><strong>Newsletter email</strong> (if you subscribe) — used only to send the newsletter. Never shared or sold.</li>
          <li><strong>Admin credentials</strong> — username and bcrypt-hashed password for editorial team members only.</li>
        </ul>
      </Section>

      <Section title="What We Do Not Collect">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>We do not use tracking pixels or fingerprinting</li>
          <li>We do not use third-party analytics (no Google Analytics, Meta Pixel, etc.)</li>
          <li>We do not use advertising cookies or cross-site tracking</li>
          <li>We do not build user profiles or behavioural models</li>
          <li>We do not collect payment information (we have no paid plans)</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p>
          We use session cookies for admin authentication only. Public readers do not have cookies set.
          If you use our newsletter signup, a functional cookie may be set to prevent duplicate submissions.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <p>We use the following third-party services that may process data on your behalf:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li><strong>Railway</strong> — cloud hosting provider. Your IP may appear in their infrastructure logs.</li>
          <li><strong>Anthropic API</strong> — processes article text for AI summarisation. No user data is sent to Anthropic.</li>
        </ul>
        <p>
          We do not use advertising networks, social media SDKs, or marketing platforms.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>
          You may request deletion of any personal data we hold (e.g. your newsletter subscription email)
          by contacting us at{' '}
          <a href="mailto:privacy@dailyaibird.com" className="text-brand-600 hover:underline">
            privacy@dailyaibird.com
          </a>.
          We will respond within 30 days.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Privacy questions or requests:{' '}
          <a href="mailto:privacy@dailyaibird.com" className="text-brand-600 hover:underline">
            privacy@dailyaibird.com
          </a>
        </p>
      </Section>
    </div>
  )
}
