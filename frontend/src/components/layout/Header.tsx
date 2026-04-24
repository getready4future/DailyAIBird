import { Link, NavLink } from 'react-router-dom'

export default function Header() {
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${
      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-10 bg-gray-950 border-b border-brand-500/30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🐦</span>
          <span className="font-bold text-white tracking-tight">Daily AI Bird</span>
        </Link>

        <nav className="flex items-center gap-6">
          <NavLink to="/" end className={linkCls}>Feed</NavLink>
          <NavLink to="/digest" className={linkCls}>Digest</NavLink>
          <NavLink to="/topics" className={linkCls}>Topics</NavLink>
          <NavLink to="/sources" className={linkCls}>Sources</NavLink>
          <NavLink
            to="/admin"
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
          >
            Admin
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
