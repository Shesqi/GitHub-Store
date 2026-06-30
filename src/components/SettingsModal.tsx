import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Folder, Download, RotateCcw, Github, Key, Server, Zap, Plus, Trash2, Check, Gauge, LogOut, User, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthModal } from './AuthModal'
import { clearApiCache } from '@/lib/api'
import { useLanguage } from '@/i18n/LanguageContext'
import { languages, type Language } from '@/i18n/translations'
import type { Mirror } from '@/types/electron'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const DEFAULT_MIRRORS: Mirror[] = [
  { name: 'GitHub (прямое соединение)', url: '' },
  { name: 'ghfast.top', url: 'https://ghfast.top' },
  { name: 'gh-proxy.com', url: 'https://gh-proxy.com' },
  { name: 'fastly.jsdelivr.net', url: 'https://fastly.jsdelivr.net' },
]

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, lang, setLang } = useLanguage()
  const [downloadDir, setDownloadDir] = useState('')
  const [mirrors, setMirrors] = useState<Mirror[]>([])
  const [activeMirror, setActiveMirror] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState<{ login: string; avatar_url: string; name: string | null } | null>(null)

  useEffect(() => {
    if (open && isElectron) {
      window.electronAPI!.getSettings().then(s => {
        setDownloadDir(s.downloadDir)
        setMirrors(s.mirrors && s.mirrors.length > 0 ? s.mirrors : [...DEFAULT_MIRRORS])
        setActiveMirror(s.activeMirror ?? null)
      })
      loadUser()
    }
  }, [open])

  async function loadUser() {
    if (!isElectron) return
    const u = await window.electronAPI!.getUserInfo()
    setUser(u)
  }

  async function handleSelectFolder() {
    if (!isElectron) return
    const folder = await window.electronAPI!.selectFolder()
    if (folder) setDownloadDir(folder)
  }

  async function handleSave() {
    if (!isElectron) return
    setSaving(true)
    await window.electronAPI!.saveSettings({ downloadDir, mirrors, activeMirror })
    setSaving(false)
    onClose()
  }

  function handleReset() {
    if (isElectron) window.electronAPI!.getSettings().then(s => {
      setDownloadDir(s.downloadDir)
      setMirrors(s.mirrors && s.mirrors.length > 0 ? s.mirrors : [...DEFAULT_MIRRORS])
      setActiveMirror(s.activeMirror ?? null)
    })
  }

  async function handleTestLatency() {
    if (!isElectron) return
    setTesting(true)
    const activeMirrors = mirrors.filter(m => m.url)
    const results = await window.electronAPI!.getMirrorLatencies(activeMirrors)
    setMirrors(prev => prev.map(m => {
      const found = results.find(r => r.url === m.url)
      return found ? { ...m, latency: found.latency ?? undefined } : m
    }))
    setTesting(false)
  }

  function addMirror() {
    setMirrors(prev => [...prev, { name: '', url: '', latency: undefined }])
  }

  function updateMirror(index: number, field: 'name' | 'url', value: string) {
    setMirrors(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function removeMirror(index: number) {
    setMirrors(prev => {
      const removed = prev[index]
      const next = prev.filter((_, i) => i !== index)
      if (activeMirror === removed?.url) setActiveMirror(null)
      return next
    })
  }

  if (!isElectron) return null

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    {t('settings.title')}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{t('settings.downloadFolder')}</label>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border text-sm text-foreground/80 truncate">
                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{downloadDir || t('settings.notSelected')}</span>
                      </div>
                      <Button variant="secondary" size="sm" onClick={handleSelectFolder} className="flex-shrink-0">{t('settings.browse')}</Button>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      {t('settings.language')}
                    </h3>
                    <div className="flex gap-2">
                      {languages.map(l => (
                        <button
                          key={l}
                          onClick={() => setLang(l)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                            lang === l
                              ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                              : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span>{l === 'ru' ? 'Русский' : 'English'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" />
                      {t('settings.mirrors')}
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {mirrors.map((m, i) => (
                        <div key={i} className={`glass rounded-xl p-3 ${activeMirror === m.url ? 'ring-1 ring-primary/40' : ''}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => setActiveMirror(activeMirror === m.url ? null : m.url)}
                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${activeMirror === m.url ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}
                              title={activeMirror === m.url ? t('settings.active') : t('settings.select')}
                            >
                              {activeMirror === m.url && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </button>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={m.name}
                                onChange={e => updateMirror(i, 'name', e.target.value)}
                                placeholder={t('settings.mirrorName')}
                                className="h-7 px-2 rounded-lg bg-secondary/50 border border-input focus:border-primary/50 focus:outline-none text-xs w-full"
                              />
                              <input
                                type="text"
                                value={m.url}
                                onChange={e => updateMirror(i, 'url', e.target.value)}
                                placeholder="https://..."
                                className="h-7 px-2 rounded-lg bg-secondary/50 border border-input focus:border-primary/50 focus:outline-none text-xs w-full"
                              />
                            </div>
                            <button
                              onClick={() => removeMirror(i)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                              title={t('settings.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {m.latency !== undefined && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-6">
                              <Gauge className="w-3 h-3" />
                              <span className={m.latency !== null ? (m.latency < 500 ? 'text-emerald-400' : m.latency < 2000 ? 'text-amber-400' : 'text-red-400') : 'text-red-400'}>
                                {m.latency !== null ? t('settings.latencyMs', { ms: m.latency }) : t('settings.unavailable')}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="secondary" size="sm" onClick={addMirror} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> {t('settings.add')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleTestLatency} disabled={testing || mirrors.filter(m => m.url).length === 0} className="gap-1.5">
                        <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
                        {testing ? t('settings.testing') : t('settings.testSpeed')}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {activeMirror
                        ? t('settings.mirrorActiveHint')
                        : t('settings.mirrorSelectHint')}
                    </p>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Github className="w-4 h-4 text-primary" />
                      GitHub
                    </h3>
                    {user ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                          <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name || user.login}</p>
                            <p className="text-xs text-muted-foreground">@{user.login}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (isElectron) {
                                await window.electronAPI!.clearAuth()
                                setUser(null)
                              }
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                            title={t('settings.logout')}
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        </div>
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setAuthOpen(true)}>
                          <Key className="w-4 h-4" /> {t('settings.manageAccount')}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2 mb-3" onClick={() => setAuthOpen(true)}>
                        <Key className="w-4 h-4" /> {t('settings.login')}
                      </Button>
                    )}
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        clearApiCache()
                        sessionStorage.clear()
                        if (isElectron) window.electronAPI!.clearAppCache()
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> {t('settings.clearCache')}
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> {t('settings.reset')}
                    </Button>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" onClick={onClose}>{t('settings.cancel')}</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>

                  <div className="border-t border-border/50 pt-4 text-center">
                    <p className="text-[11px] text-muted-foreground/50 font-medium">
                      {t('app.name')} {t('app.version')} 1.0.0 &middot; {t('app.author')}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
