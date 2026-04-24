import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fetchUsers, createUser, updateUser, deleteUser, type AdminUserRecord } from '../api/admin'
import Spinner from '../components/ui/Spinner'

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:  { label: 'Admin',  cls: 'bg-brand-900/40 border-brand-700/50 text-brand-400' },
  editor: { label: 'Editor', cls: 'bg-gray-800 border-gray-700 text-gray-400' },
}

function UserRow({ user, currentCount, onUpdate, onDelete }: {
  user: AdminUserRecord
  currentCount: number
  onUpdate: (id: number, data: Partial<AdminUserRecord & { password?: string }>) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [role, setRole] = useState(user.role)
  const [newPassword, setNewPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const roleCfg = ROLE_LABELS[user.role] ?? ROLE_LABELS.editor

  function handleSave() {
    onUpdate(user.id, {
      display_name: displayName,
      role,
      ...(newPassword ? { password: newPassword } : {}),
    })
    setEditing(false)
    setNewPassword('')
  }

  return (
    <div className={`rounded-xl border bg-gray-900 overflow-hidden ${
      user.is_active ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-bold text-gray-300">
          {(user.display_name || user.username).charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{user.display_name || user.username}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleCfg.cls}`}>
              {roleCfg.label}
            </span>
            {!user.is_active && (
              <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">Suspended</span>
            )}
          </div>
          <p className="text-xs text-gray-500">@{user.username}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-600">
            {user.last_login_at
              ? `Last login ${formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })}`
              : 'Never logged in'}
          </p>
          <p className="text-[10px] text-gray-700 mt-0.5">
            Created {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'editor')}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              New Password <span className="normal-case font-normal text-gray-600">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={`flex items-center gap-2 px-5 py-3 ${editing ? 'border-t border-gray-800' : ''}`}>
        {editing ? (
          <>
            <button onClick={handleSave}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-500 transition">
              Save
            </button>
            <button onClick={() => { setEditing(false); setNewPassword('') }}
              className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:text-white transition">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-500 hover:text-white transition">
              Edit
            </button>
            <button
              onClick={() => onUpdate(user.id, { is_active: !user.is_active })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                user.is_active
                  ? 'border-gray-700 text-gray-500 hover:border-amber-700 hover:text-amber-400'
                  : 'border-emerald-800 text-emerald-500 hover:border-emerald-600'
              }`}
            >
              {user.is_active ? 'Suspend' : 'Reactivate'}
            </button>
            <div className="ml-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Sure?</span>
                  <button onClick={() => onDelete(user.id)}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 transition">
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:text-white transition">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={currentCount <= 1}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-800 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AddUserForm({ onAdd }: { onAdd: () => void }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('editor')
  const [error, setError] = useState('')

  const qc = useQueryClient()
  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setUsername(''); setDisplayName(''); setPassword(''); setRole('editor'); setError('')
      onAdd()
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create user.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    createMut.mutate({ username, password, display_name: displayName, role })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-700/30 bg-gray-900 p-6">
      <p className="mb-4 text-[10px] font-bold tracking-widest text-brand-500 uppercase">Add New User</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Username *</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="johndoe"
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="John Doe"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Password *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="editor">Editor — can approve/reject articles</option>
            <option value="admin">Admin — full access including user management</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={createMut.isPending || !username || !password}
          className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
        >
          {createMut.isPending ? 'Creating…' : 'Create User'}
        </button>
        <p className="text-[10px] text-gray-600">
          Editor: can approve/reject articles. Admin: full panel access.
        </p>
      </div>
    </form>
  )
}

export default function AdminUsers() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Users</p>
            <h1 className="text-xl font-bold text-white">User Management</h1>
            <p className="mt-1 text-xs text-gray-500">Manage who can access the admin panel.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{users.filter(u => u.is_active).length}<span className="text-gray-600">/{users.length}</span></p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active</p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                showForm
                  ? 'bg-gray-700 text-white'
                  : 'bg-brand-600 text-white hover:bg-brand-500'
              }`}
            >
              {showForm ? '✕ Cancel' : '+ Add User'}
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="mb-6">
          <AddUserForm onAdd={() => setShowForm(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentCount={users.length}
              onUpdate={(id, data) => updateMut.mutate({ id, data })}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
