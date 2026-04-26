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
import AdminPipelineHealth from './pages/AdminPipelineHealth'
import AdminPrompts from './pages/AdminPrompts'
import AdminSeo from './pages/AdminSeo'
import AboutPage from './pages/AboutPage'
import EditorialStandards from './pages/EditorialStandards'
import AiUsePolicy from './pages/AiUsePolicy'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import AdvertisingPolicy from './pages/AdvertisingPolicy'
import CorrectionsPolicy from './pages/CorrectionsPolicy'

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

        {/* Policy & trust pages */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/editorial-standards" element={<EditorialStandards />} />
        <Route path="/ai-use-policy" element={<AiUsePolicy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/advertising-policy" element={<AdvertisingPolicy />} />
        <Route path="/corrections-policy" element={<CorrectionsPolicy />} />
        <Route path="/contact" element={<AboutPage />} />
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
        <Route path="/admin/pipeline/health" element={<AdminPipelineHealth />} />
        <Route path="/admin/pipeline/prompts" element={<AdminPrompts />} />
        <Route path="/admin/seo" element={<AdminSeo />} />
      </Route>
    </Routes>
  )
}
