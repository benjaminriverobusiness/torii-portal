import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Portal } from './pages/Portal'
import { Admin } from './pages/Admin'
import { AdminClient } from './pages/AdminClient'
import { NewClient } from './pages/NewClient'
import { ReportesPage } from './pages/ReportesPage'
import { RecorridoPage } from './pages/RecorridoPage'
import { VentasPage } from './pages/VentasPage'
import { Spinner } from './components/Spinner'

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole: 'client' | 'admin'
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#08090f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size={40} />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role !== requiredRole) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/portal'} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#08090f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size={40} />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user && profile ? (
            <Navigate to={profile.role === 'admin' ? '/admin' : '/portal'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/portal"
        element={
          <ProtectedRoute requiredRole="client">
            <Portal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/informes"
        element={
          <ProtectedRoute requiredRole="client">
            <ReportesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/recorrido"
        element={
          <ProtectedRoute requiredRole="client">
            <RecorridoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/ventas"
        element={
          <ProtectedRoute requiredRole="client">
            <VentasPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/new"
        element={
          <ProtectedRoute requiredRole="admin">
            <NewClient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/client/:id"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminClient />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
