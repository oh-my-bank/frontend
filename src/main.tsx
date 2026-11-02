import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import { AuthProvider } from './stores/auth'
import './style.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        {/* Last resort for the header, menu and footer; screens have their own boundary in App. */}
        <RouteErrorBoundary>
          <App />
        </RouteErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
