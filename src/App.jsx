import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import waripayLoading from './assets/waripay_loading.png'
import { AppProvider, useApp } from './contexts/AppContext'
import { initGA } from './lib/analytics'
import Login from './pages/Login'
import Home from './pages/Home'
import RoomPage from './pages/RoomPage'
import PrivacyPolicy from './pages/PrivacyPolicy'

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
  const { user, loading } = useApp()
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
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
