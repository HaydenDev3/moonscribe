import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/literata/400.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/literata/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import { AppProvider } from './context/AppContext'
import { ContextMenuProvider } from './components/ContextMenu'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <ContextMenuProvider>
        <App />
      </ContextMenuProvider>
    </AppProvider>
  </React.StrictMode>
)
