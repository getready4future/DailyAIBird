import { Link, NavLink } from 'react-router-dom'

export default function Header() {
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${isActive ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'}`

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-2xl">🐦</span>
          <span>Daily AI Bird</span>
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink to="/" end className={linkCls}>Feed</NavLink>
          <NavLink to="/digest" className={linkCls}>Digest</NavLink>
          <NavLink to="/topics" className={linkCls}>Topics</NavLink>
          <NavLink to="/sources" className={linkCls}>Sources</NavLink>
          <NavLink to="/admin" className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
            Admin
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
