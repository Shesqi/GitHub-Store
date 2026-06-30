import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { RepoDetailPage } from '@/pages/RepoDetailPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { TitleBar } from '@/components/TitleBar'
import { ScrollToTop } from '@/components/ScrollToTop'
import { setAuthToken } from '@/lib/api'
import { LanguageProvider } from '@/i18n/LanguageContext'

export default function App() {
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAuthToken().then(token => setAuthToken(token))
    }
  }, [])

  return (
    <LanguageProvider>
      <HashRouter>
        <TitleBar />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/repo/:owner/:repo" element={<RepoDetailPage />} />
        </Routes>
      </HashRouter>
    </LanguageProvider>
  )
}
