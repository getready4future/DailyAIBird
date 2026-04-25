import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import AdminLayout from './components/layout/AdminLayout'
import Home from './pages/Home'
import DailyDigest from './pages/DailyDigest'
import Topics from './pages/Topics'
import Sources from './pages/Sources'
import ArticleDetail from './pages/ArticleDetail'
import AdminLogin from './pages/AdminLogin'
import AdminQueue from './pages/AdminQueue'
import AdminDigests from './pages/AdminDigests'
import AdminSources from './pages/AdminSources'
import AdminModels from './pages/AdminModels'
import AdminScheduler from './pages/AdminScheduler'
import AdminUsers from './pages/AdminUsers'
import AdminSourceDiscover from './pages/AdminSourceDiscover'
import AdminPipeline from './pages/AdminPipeline'
import AdminMonitor from './pages/AdminMonitor'

export default function App() {
  return (
    <Routes>
      {/* Public site */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/digest" element={<DailyDigest />} />
        <Route path="/digest/:date" element={<DailyDigest />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
      </Route>

      {/* Admin login — no layout */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin panel — sidebar layout with auth guard */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminQueue />} />
        <Route path="/admin/digests" element={<AdminDigests />} />
        <Route path="/admin/sources" element={<AdminSources />} />
        <Route path="/admin/models" element={<AdminModels />} />
        <Route path="/admin/scheduler" element={<AdminScheduler />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/sources/find" element={<AdminSourceDiscover />} />
        <Route path="/admin/pipeline" element={<AdminPipeline />} />
        <Route path="/admin/monitor" element={<AdminMonitor />} />
      </Route>
    </Routes>
  )
}
