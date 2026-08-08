import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AdminRoutesPage } from './components/AdminRoutesPage.tsx'
import { SiteAuthGate } from './context/SiteAuthContext.tsx'
import { migrateGroundZeroLocalMarkers } from './utils/groundZeroMapMigration'
import { migrateLighthouseLocalMarkers } from './utils/lighthouseMapMigration'
import { migrateStreetsOfTarkovLocalMarkers } from './utils/streetsOfTarkovMapMigration'
import './index.css'

migrateGroundZeroLocalMarkers()
migrateLighthouseLocalMarkers()
migrateStreetsOfTarkovLocalMarkers()

const isAdminRoutes = window.location.pathname.replace(/\/+$/, '') === '/admin/routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteAuthGate>
      {isAdminRoutes ? <AdminRoutesPage /> : <App />}
    </SiteAuthGate>
  </StrictMode>,
)
