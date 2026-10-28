import { createRoot } from 'react-dom/client'
import '../styles.css'
import './picker.css'
import { Picker } from './Picker'

createRoot(document.getElementById('root')!).render(<Picker />)
