import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import waripayLoading from './assets/waripay_loading.png'
import { AppProvider, useApp } from './contexts/AppContext'
import { track } from './lib/analytics'
import { initGA } from './lib/analytics'
import Login from './pages/Login'
import Home from './pages/Home'
import RoomPage from './pages/RoomPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Hub from './pages/Hub'

initGA()

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <img src={waripayLoading} alt="loading" className="w-24 h-24 animate-bounce" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  if (loading) return <Spinner />
  if (!user) {
    const joinId = new URLSearchParams(window.location.search).get('join')
    if (joinId) sessionStorage.setItem('pendingJoin', joinId)
    return <Navigate to="/login" replace />
  }
  return children
}

function AppRoutes() {
  const { user, loading, language } = useApp()
  const location = useLocation()

  useEffect(() => {
    track('page_view', {
      language,
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [language, location.pathname, location.search])

  if (loading) return <Spinner />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const isHubHost = window.location.hostname === 'www.washcc.cc' || window.location.hostname === 'washcc.cc'
  if (isHubHost) return <Hub />

  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
