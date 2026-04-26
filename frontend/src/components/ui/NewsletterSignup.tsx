export default function NewsletterSignup() {
  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-6 py-6">
      <p className="mb-1 text-[10px] font-bold tracking-widest text-brand-600 uppercase">Newsletter</p>
      <h3 className="text-lg font-bold text-gray-900">Daily AI Digest</h3>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        The most important AI news of the day, curated and summarised. Delivered before 9 AM.
      </p>
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-sm font-medium text-brand-800">
          Newsletter coming soon — we'll announce when it launches.
        </p>
        <p className="mt-1 text-xs text-brand-500">Follow us on the feed for now.</p>
      </div>
    </div>
  )
}
