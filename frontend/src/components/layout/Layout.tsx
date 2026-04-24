import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <p className="font-medium text-gray-500">Daily AI Bird</p>
        <p className="mt-1">AI-curated news · reviewed by humans · powered by Claude</p>
      </footer>
    </div>
  )
}
