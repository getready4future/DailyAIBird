import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${
      isActive ? 'text-white' : 'text-gray-300 hover:text-white'
    }`

  const mobileLinkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2.5 text-sm font-medium transition rounded-lg ${
      isActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-10 bg-gray-950 border-b border-brand-500/30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <span className="text-xl">🐦</span>
          <span className="font-bold text-white tracking-tight">Daily AI Bird</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={linkCls}>Feed</NavLink>
          <NavLink to="/digest" className={linkCls}>Digest</NavLink>
          <NavLink to="/topics" className={linkCls}>Topics</NavLink>
          <NavLink to="/sources" className={linkCls}>Sources</NavLink>
          <NavLink
            to="/admin"
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
          >
            Admin →
          </NavLink>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 p-2 text-gray-400 hover:text-white transition"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          <span className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-5 bg-current transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 space-y-1">
          <NavLink to="/" end className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Feed</NavLink>
          <NavLink to="/digest" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Digest</NavLink>
          <NavLink to="/topics" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Topics</NavLink>
          <NavLink to="/sources" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Sources</NavLink>
          <NavLink
            to="/admin"
            className="block px-4 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            Admin →
          </NavLink>
        </nav>
      )}
    </header>
  )
}
