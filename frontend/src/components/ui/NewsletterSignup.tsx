import { useState } from 'react'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    // Placeholder — wire to backend when email service is configured
    setSubmitted(true)
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-6 py-6">
      <p className="mb-1 text-[10px] font-bold tracking-widest text-brand-600 uppercase">Newsletter</p>
      <h3 className="text-lg font-bold text-gray-900">Daily AI Digest</h3>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        The most important AI news of the day, curated and summarised. Delivered before 9 AM.
      </p>

      {submitted ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          ✓ You're on the list! We'll send you a confirmation shortly.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
          >
            Subscribe
          </button>
        </form>
      )}
      <p className="mt-2 text-[10px] text-gray-400">No spam. Unsubscribe any time. See our <a href="/privacy-policy" className="underline hover:text-gray-600">Privacy Policy</a>.</p>
    </div>
  )
}
