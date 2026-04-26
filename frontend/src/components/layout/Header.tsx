import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `font-mono text-[12px] uppercase tracking-[0.14em] transition ${
      isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink'
    }`

  const mobileLinkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] transition rounded-md ${
      isActive ? 'bg-paper-100 text-brand-600' : 'text-ink-500 hover:bg-paper-100 hover:text-ink'
    }`

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-200 ${
        scrolled
          ? 'bg-paper/85 backdrop-blur-md border-b border-paper-200'
          : 'bg-paper border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          onClick={() => setMobileOpen(false)}
        >
          <span className="text-lg">🐦</span>
          <span className="font-serif text-[17px] font-semibold tracking-tight text-ink">
            Daily AI Bird
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          <NavLink to="/" end className={linkCls}>Feed</NavLink>
          <NavLink to="/digest" className={linkCls}>Digest</NavLink>
          <NavLink to="/topics" className={linkCls}>Topics</NavLink>
          <NavLink to="/sources" className={linkCls}>Sources</NavLink>
          <a
            href="#newsletter"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('newsletter')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-paper hover:bg-brand-700 transition"
          >
            Subscribe
          </a>
          <NavLink
            to="/admin"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 hover:text-ink transition"
          >
            Admin
          </NavLink>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 p-2 text-ink hover:text-brand-600 transition"
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
        <nav className="md:hidden border-t border-paper-200 bg-paper px-4 py-3 space-y-1">
          <NavLink to="/" end className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Feed</NavLink>
          <NavLink to="/digest" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Digest</NavLink>
          <NavLink to="/topics" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Topics</NavLink>
          <NavLink to="/sources" className={mobileLinkCls} onClick={() => setMobileOpen(false)}>Sources</NavLink>
          <a
            href="#newsletter"
            onClick={() => setMobileOpen(false)}
            className="block px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-paper bg-ink rounded-md text-center"
          >
            Subscribe
          </a>
          <NavLink
            to="/admin"
            className={mobileLinkCls}
            onClick={() => setMobileOpen(false)}
          >
            Admin
          </NavLink>
        </nav>
      )}
    </header>
  )
}
