import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AdminDashboardPage } from './components/AdminDashboardPage.tsx'
import { AdminRoutesPage } from './components/AdminRoutesPage.tsx'
import { SiteAuthGate } from './context/SiteAuthContext.tsx'
import { migrateGroundZeroLocalMarkers } from './utils/groundZeroMapMigration'
import { migrateLighthouseLocalMarkers } from './utils/lighthouseMapMigration'
import { migrateStreetsOfTarkovLocalMarkers } from './utils/streetsOfTarkovMapMigration'
import './index.css'

migrateGroundZeroLocalMarkers()
migrateLighthouseLocalMarkers()
migrateStreetsOfTarkovLocalMarkers()

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminRoutes = path === '/admin/routes'
const isAdminRoot = path === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoutes || isAdminRoot ? (
      isAdminRoutes ? <AdminRoutesPage /> : <AdminDashboardPage />
    ) : (
      <SiteAuthGate>
        <App />
      </SiteAuthGate>
    )}
  </StrictMode>,
)
