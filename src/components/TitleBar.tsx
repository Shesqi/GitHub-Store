import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Minus, X, Copy, Package, Square, Settings, Download,
  CheckCircle2, AlertCircle, Heart, Bell, BellOff, LogIn, LogOut,
  Loader2, SquareX,
} from 'lucide-react'
import { SettingsModal } from './SettingsModal'
import { useLanguage } from '@/i18n/LanguageContext'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  return `${bytesPerSec} B/s`
}

export function TitleBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMaximized, setIsMaximized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; path?: string } | null>(null)
  const [updates, setUpdates] = useState<number>(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null)
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    document.documentElement.classList.add('has-titlebar')
    window.electronAPI!.isMaximized().then(setIsMaximized)
    window.electronAPI!.onWindowStateChanged(setIsMaximized)
    loadFavoritesCount()
    loadUser()
    window.addEventListener('favorites-changed', loadFavoritesCount)
    return () => {
      document.documentElement.classList.remove('has-titlebar')
      window.removeEventListener('favorites-changed', loadFavoritesCount)
    }
  }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function loadUser() {
    if (!isElectron) return
    const u = await window.electronAPI!.getUserInfo()
    setUser(u)
  }

  async function loadFavoritesCount() {
    if (!isElectron) return
    const favs = await window.electronAPI!.getFavorites()
    setFavoritesCount(favs.length)
  }

  // Listen for download events
  useEffect(() => {
    if (!isElectron) return
    function handler(e: CustomEvent) {
      const { url, filename, repoFullName, releaseTag, fileSize } = e.detail
      setDownloadProgress({ filename, percent: 0, speed: 0, downloadedBytes: 0, totalBytes: 0 })
      window.electronAPI!.getSettings().then(settings => {
        window.electronAPI!.downloadFile({
          url,
          filename,
          directory: settings.downloadDir,
          repoFullName,
          releaseTag,
          fileSize,
        }).then(result => {
          setDownloadProgress(null)
          loadFavoritesCount()
          if (result.success) {
            setToast({ type: 'success', message: t('download.success', { filename }), path: result.path })
            window.dispatchEvent(new CustomEvent('download-complete', { detail: { fullName: repoFullName } }))
          } else if (result.cancelled) {
            setToast({ type: 'error', message: t('download.cancelled', { filename }) })
          } else {
            setToast({ type: 'error', message: t('download.error', { message: result.error || filename }) })
          }
          setTimeout(() => setToast(null), 5000)
        })
      })
    }
    window.addEventListener('start-download', handler as EventListener)
    return () => window.removeEventListener('start-download', handler as EventListener)
  }, [])

  // Listen for download progress events
  useEffect(() => {
    if (!isElectron) return
    window.electronAPI!.onDownloadProgress((data: DownloadProgress) => {
      if (data.done) {
        setDownloadProgress(null)
        return
      }
      setDownloadProgress(data)
    })
  }, [])

  // Check for updates on focus
  useEffect(() => {
    if (!isElectron) return
    async function check() {
      const [results, favs] = await Promise.all([
        window.electronAPI!.checkUpdates(),
        window.electronAPI!.getFavorites(),
      ])
      const favSet = new Set(favs)
      const filtered = results.filter(r => favSet.has(r.fullName))
      setUpdates(filtered.length)
      window.dispatchEvent(new CustomEvent('updates-changed', { detail: filtered }))
      if (filtered.length > 0) {
        setToast({ type: 'success', message: t('updates.available', { count: filtered.length }) })
        setTimeout(() => setToast(null), 6000)
      }
    }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  function handleMinimize() { if (isElectron) window.electronAPI!.minimize() }
  function handleMaximize() { if (isElectron) window.electronAPI!.maximize() }
  function handleClose() { if (isElectron) window.electronAPI!.close() }
  function handleDoubleClick() { handleMaximize() }

  if (!isElectron) return null

  const isFavoritesPage = location.pathname === '/favorites'

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 h-10 z-50 flex items-center select-none transition-all duration-200 ${
          scrolled ? 'bg-background/70 backdrop-blur-lg shadow-lg shadow-black/10' : ''
        }`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-1.5 px-3 flex-1 min-w-0">
          <button
            onClick={() => navigate(isFavoritesPage ? '/' : '/favorites')}
            className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title={isFavoritesPage ? t('nav.home') : t('nav.favorites')}
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              {isFavoritesPage ? (
                <Package className="w-3.5 h-3.5 text-white" />
              ) : (
                <Heart className="w-3.5 h-3.5 text-white" fill="white" />
              )}
            </div>
            <span className="text-sm font-semibold text-foreground/80">
              {isFavoritesPage ? t('app.name') : t('nav.favorites')}
            </span>
            {!isFavoritesPage && favoritesCount > 0 && (
              <span className="text-[10px] font-medium bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {favoritesCount}
              </span>
            )}
          </button>

          {downloadProgress && (
            <div className="flex items-center gap-2 ml-2 text-xs text-primary min-w-0 flex-1">
              <Download className="w-3 h-3 animate-pulse shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{downloadProgress.filename}</span>
                  <span className="text-muted-foreground shrink-0">{downloadProgress.percent}%</span>
                  <span className="text-muted-foreground shrink-0">{formatSpeed(downloadProgress.speed)}</span>
                  <button
                    onClick={() => window.electronAPI?.cancelDownload()}
                    className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                    title={t('download.cancel')}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <SquareX className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {updates > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 ml-2"
              title={t('updates.available', { count: updates })}
            >
              <div className="relative">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
              </div>
              <span className="text-[10px] font-medium bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                {updates}
              </span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {user && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              onClick={() => setSettingsOpen(true)}
              className="h-full flex items-center gap-1.5 px-2 text-muted-foreground hover:text-foreground transition-colors"
              title={user.login}
            >
              <img src={user.avatar_url} alt={user.login} className="w-5 h-5 rounded-full" />
              <span className="text-xs font-medium">{user.login}</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={t('settings.title')}
          >
            <Settings className="w-3.5 h-3.5" />
          </motion.button>

          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            onClick={handleMinimize}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Minus className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            onClick={handleMaximize}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </motion.button>

          <motion.button
            whileHover={{ backgroundColor: 'rgba(239,68,68,0.8)' }}
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); loadUser() }} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-12 left-0 right-0 z-50 flex justify-center pointer-events-none"
          >
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl border text-sm pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/15 border-red-500/30 text-red-400'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{toast.message}</span>
              {toast.path && <span className="text-xs text-muted-foreground ml-1 truncate max-w-[200px]">{toast.path}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
