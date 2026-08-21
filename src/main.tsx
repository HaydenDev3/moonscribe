import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/600-italic.css'
import '@fontsource/literata/400.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/literata/600.css'
import '@fontsource/literata/600-italic.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/lora/500.css'
import '@fontsource/lora/600.css'
import '@fontsource/lora/600-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './styles/tokens.css'
import './styles/tailwind.css'
import './styles/base.css'
import './styles/app.css'
import { AppProvider } from './context/AppContext'
import { ContextMenuProvider } from './components/ContextMenu'
import App from './App'

const legacyDesignerFontOptions = [
  { key: 'cormorant', label: 'Cormorant italic' },
  { key: 'literata', label: 'Literata italic' },
  { key: 'cursive', label: 'Handwritten' },
]

if (typeof window !== 'undefined' && !window.designerFontOptions) {
  window.designerFontOptions = legacyDesignerFontOptions
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <ContextMenuProvider>
        <App />
      </ContextMenuProvider>
    </AppProvider>
  </React.StrictMode>
)
