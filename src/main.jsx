import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ExplodedProvider } from './ExplodedContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ExplodedProvider>
      <App />
    </ExplodedProvider>
  </StrictMode>,
)
