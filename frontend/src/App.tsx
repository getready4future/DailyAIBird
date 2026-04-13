import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import DailyDigest from './pages/DailyDigest'
import Topics from './pages/Topics'
import Sources from './pages/Sources'
import ArticleDetail from './pages/ArticleDetail'
import AdminQueue from './pages/AdminQueue'
import AdminDigests from './pages/AdminDigests'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/digest" element={<DailyDigest />} />
        <Route path="/digest/:date" element={<DailyDigest />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
        <Route path="/admin" element={<AdminQueue />} />
        <Route path="/admin/digests" element={<AdminDigests />} />
      </Route>
    </Routes>
  )
}
