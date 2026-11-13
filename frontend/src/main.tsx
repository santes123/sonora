import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { LikesProvider } from './context/LikesContext'
import { OfflineProvider } from './context/OfflineContext'
import { PlayerProvider } from './context/PlayerContext'
import { ToastProvider } from './context/ToastContext'
import { ApiError } from './lib/api'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          [400, 401, 403, 404, 422].includes(error.status)
        ) {
          return false
        }

        return failureCount < 1
      },
    },
  },
})

const container = document.getElementById('root')

if (!container) {
  throw new Error('No se encontró el elemento #root')
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <LikesProvider>
            <OfflineProvider>
              <PlayerProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </PlayerProvider>
            </OfflineProvider>
          </LikesProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
