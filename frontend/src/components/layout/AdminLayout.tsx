import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { isLoggedIn, clearSession, getSession } from '../../hooks/useAdminAuth'

const NAV = [
  { to: '/admin',           label: 'Queue',      icon: '📋', end: true },
  { to: '/admin/digests',   label: 'Digests',    icon: '📰' },
  { to: '/admin/sources',   label: 'Sources',    icon: '🔗' },
  { to: '/admin/models',    label: 'Models',     icon: '🤖' },
  { to: '/admin/scheduler', label: 'Scheduler',  icon: '⏰' },
  { to: '/admin/users',     label: 'Users',      icon: '👥' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoggedIn()) navigate('/admin/login', { replace: true })
  }, [navigate])

  function handleLogout() {
    clearSession()
    navigate('/admin/login', { replace: true })
  }

  const session = getSession()

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-800 bg-gray-950">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="text-base font-bold text-white">🐦 Daily AI Bird</p>
          <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mt-0.5">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="mb-2 text-xs text-gray-500">
            Signed in as <span className="font-semibold text-gray-300">{session?.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-700 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-600 hover:text-white transition"
          >
            Sign Out
          </button>
          <a
            href="/"
            className="mt-2 block text-center text-xs text-gray-600 hover:text-gray-400 transition"
          >
            ← Back to site
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
