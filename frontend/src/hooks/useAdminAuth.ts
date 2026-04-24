const STORAGE_KEY = 'dailyaibird_admin'

export interface AdminSession {
  token: string
  username: string
}

export function getSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isLoggedIn(): boolean {
  return getSession() !== null
}
