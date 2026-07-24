import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const LIFF_ID = import.meta.env.VITE_LIFF_ID
const NO_LIFF = !LIFF_ID || LIFF_ID === 'your-liff-id-here'

const mount = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

if (NO_LIFF || import.meta.env.DEV) {
  mount()
} else {
  // 先跑 liff.init() 再掛載 React，避免 React Router 搶走 URL 參數
  import('./lib/liff.js').then(({ initLiff }) => {
    initLiff().catch(console.error).finally(mount)
  })
}
