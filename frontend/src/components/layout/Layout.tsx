import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        Daily AI Bird · AI-curated news for developers · Powered by Claude
      </footer>
    </div>
  )
}
