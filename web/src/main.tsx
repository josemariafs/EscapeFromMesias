import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AdminDashboardPage } from './components/AdminDashboardPage.tsx'
import { AdminRoutesPage } from './components/AdminRoutesPage.tsx'
import { SiteAuthGate } from './context/SiteAuthContext.tsx'
import './index.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminDashboard = path === '/admin'
const isAdminRoutes = path === '/admin/routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminDashboard ? (
      <AdminDashboardPage />
    ) : isAdminRoutes ? (
      <AdminRoutesPage />
    ) : (
      <SiteAuthGate>
        <App />
      </SiteAuthGate>
    )}
  </StrictMode>,
)
