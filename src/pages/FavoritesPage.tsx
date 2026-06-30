import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/i18n/LanguageContext'
import { Heart, RefreshCw, Package, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RepoCard } from '@/components/RepoCard'
import { Button } from '@/components/ui/button'
import { getRepo } from '@/lib/api'
import type { GitHubRepo } from '@/lib/api'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export function FavoritesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updateInfos, setUpdateInfos] = useState<Map<string, UpdateInfo>>(new Map())
  const favsRef = useRef<string[]>([])
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    function onUpdates(e: CustomEvent<UpdateInfo[]>) {
      const map = new Map<string, UpdateInfo>()
      const favSet = new Set(favsRef.current)
      for (const info of e.detail) {
        if (favSet.has(info.fullName)) {
          map.set(info.fullName, info)
        }
      }
      setUpdateInfos(map)
    }
    window.addEventListener('updates-changed', onUpdates as EventListener)
    return () => window.removeEventListener('updates-changed', onUpdates as EventListener)
  }, [])

  async function loadFavorites() {
    if (!isElectron) return
    setLoading(true)
    setError('')
    try {
      const favs = await window.electronAPI!.getFavorites()
      favsRef.current = favs
      if (favs.length === 0) {
        setRepos([])
        return
      }
      const results = await Promise.allSettled(
        favs.map(fullName => {
          const [owner, repo] = fullName.split('/')
          return getRepo(owner, repo)
        })
      )
      const loaded: GitHubRepo[] = []
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          loaded.push(result.value)
        }
      }
      setRepos(loaded)
      setLoadKey(k => k + 1)
    } catch {
      setError(t('favorites.loadError'))
    } finally {
      setLoading(false)
    }
  }

  // Check updates after favorites load
  useEffect(() => {
    if (loadKey === 0 || !isElectron) return
    window.electronAPI!.checkUpdates().then(results => {
      const map = new Map<string, UpdateInfo>()
      const favSet = new Set(favsRef.current)
      for (const info of results) {
        if (favSet.has(info.fullName)) {
          map.set(info.fullName, info)
        }
      }
      setUpdateInfos(map)
    })
  }, [loadKey])

  useEffect(() => {
    loadFavorites()
  }, [])

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Heart className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('favorites.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {repos.length > 0
                    ? t('favorites.repoCount', { count: repos.length })
                    : t('favorites.emptyHint')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={loadFavorites} disabled={loading}>
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={loadFavorites}>{t('favorites.retry')}</Button>
            </motion.div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-52 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : repos.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              onClickCapture={() => sessionStorage.setItem('detail-from', '/favorites')}
            >
              {repos.map((repo, i) => (
                <RepoCard key={repo.id} repo={repo}
                  updateInfo={updateInfos.get(repo.full_name)} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-24">
              <Heart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-2">{t('favorites.empty')}</p>
              <p className="text-sm text-muted-foreground/60 mb-6">
                {t('favorites.emptyHint')}
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('nav.home')}
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
