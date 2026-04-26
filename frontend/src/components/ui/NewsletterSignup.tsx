import { useState } from 'react'

type Variant = 'inline' | 'banner'

const BUTTONDOWN_USER = 'dailyaibird'  // change to your actual handle when set up
const BUTTONDOWN_URL  = `https://buttondown.email/api/emails/embed-subscribe/${BUTTONDOWN_USER}`

export default function NewsletterSignup({ variant = 'inline' }: { variant?: Variant }) {
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState('')

  const isBanner = variant === 'banner'
  const eyebrowCls = isBanner ? 'text-brand-200' : 'text-brand-600'
  const titleCls = isBanner ? 'text-paper' : 'text-ink'
  const bodyCls = isBanner ? 'text-paper/70' : 'text-ink-500'
  const inputCls = isBanner
    ? 'border-paper/20 bg-paper/10 text-paper placeholder:text-paper/40'
    : 'border-paper-300 bg-paper text-ink placeholder:text-ink-400'
  const finePrintCls = isBanner ? 'text-paper/50' : 'text-ink-400'

  return (
    <section
      id="newsletter"
      className={
        isBanner
          ? 'bg-ink text-paper px-6 py-12 md:px-12 md:py-16 -mx-4 sm:-mx-6 sm:rounded-md sm:mx-0'
          : 'border-y border-paper-200 py-12'
      }
    >
      <div className="mx-auto max-w-reading-lg">
        <p className={`mb-2 font-mono text-[11px] uppercase tracking-[0.18em] ${eyebrowCls}`}>
          The Daily Bird
        </p>
        <h3 className={`font-serif text-2xl md:text-3xl font-semibold leading-tight ${titleCls}`}>
          Today's AI in 5 minutes.
        </h3>
        <p className={`mt-2 text-[15px] leading-relaxed ${bodyCls}`}>
          One email each morning before 9am. Curated by AI, reviewed by humans —
          no hype, no ads, no <em>"prompt engineer"</em> threads.
        </p>

        {submitted ? (
          <div className={`mt-5 rounded-md px-4 py-3 ${isBanner ? 'bg-paper/10 text-paper' : 'bg-brand-50 text-brand-800'}`}>
            <p className="text-[14px]">
              ✓ Almost there — confirm via the email we just sent. Check your spam folder if it doesn't arrive in a minute.
            </p>
          </div>
        ) : (
          <form
            action={BUTTONDOWN_URL}
            method="post"
            target="popupwindow"
            onSubmit={(e) => {
              if (!email.trim()) {
                e.preventDefault()
                return
              }
              // Optimistic UI; popup carries through to Buttondown for confirmation
              setSubmitted(true)
              window.open('', 'popupwindow', 'width=520,height=520')
            }}
            className="mt-5 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@work.com"
              autoComplete="email"
              className={`flex-1 rounded-md border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500 ${inputCls}`}
            />
            <input type="hidden" name="tag" value={isBanner ? 'banner' : 'inline'} />
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-6 py-3 text-[14px] font-semibold text-paper hover:bg-brand-600 transition whitespace-nowrap"
            >
              Subscribe →
            </button>
          </form>
        )}

        <p className={`mt-3 text-[12px] ${finePrintCls}`}>
          Free forever · unsubscribe in one click · we never share your email.
        </p>
      </div>
    </section>
  )
}
