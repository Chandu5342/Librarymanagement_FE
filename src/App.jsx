import { LibraryProvider } from './context/LibraryContext.jsx'
import { LibraryWorkspace } from './pages/LibraryWorkspace.jsx'
import './App.css'

function App() {
  return (
    <LibraryProvider>
      <LibraryWorkspace />
    </LibraryProvider>
  )
}

export default App
