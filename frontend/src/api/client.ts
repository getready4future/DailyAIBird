import axios from 'axios'
import { getSession } from '../hooks/useAdminAuth'

const BASE_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export const adminApi = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Dynamically attach admin token from session
adminApi.interceptors.request.use((config) => {
  const session = getSession()
  const token = session?.token || import.meta.env.VITE_ADMIN_TOKEN || ''
  if (token) config.headers['X-Admin-Token'] = token
  return config
})
