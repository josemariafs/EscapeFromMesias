import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AdminRoutesPage } from './components/AdminRoutesPage.tsx'
import './index.css'

const isAdminRoutes = window.location.pathname.replace(/\/+$/, '') === '/admin/routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoutes ? <AdminRoutesPage /> : <App />}
  </StrictMode>,
)
