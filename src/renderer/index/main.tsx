import { createRoot } from 'react-dom/client'
import '../styles.css'
import '../dashboard/dashboard.css'
import { App } from '../dashboard/App'

createRoot(document.getElementById('root')!).render(<App />)
