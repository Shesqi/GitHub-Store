import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Github, Key, LogOut, User, ExternalLink, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/LanguageContext'

const isElectron = typeof window !== 'undefined' && window.electronAPI

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { t } = useLanguage()
  const [user, setUser] = useState<{ login: string; avatar_url: string; name: string | null } | null>(null)
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<'menu' | 'pat' | 'device'>('menu')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [deviceCode, setDeviceCode] = useState('')
  const [deviceVerificationUrl, setDeviceVerificationUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (open && isElectron) {
      loadUser()
      setMode('menu')
      setToken('')
      setStatus('')
      setDeviceCode('')
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [open])

  async function loadUser() {
    if (!isElectron) return
    const u = await window.electronAPI!.getUserInfo()
    setUser(u)
  }

  async function handlePATSubmit() {
    if (!isElectron || !token.trim()) return
    setLoading(true)
    setStatus('')
    await window.electronAPI!.saveAuthToken(token.trim())
    await loadUser()
    setLoading(false)
    if (await window.electronAPI!.getUserInfo()) {
      setStatus(t('auth.successPat'))
      setToken('')
    } else {
      setStatus(t('auth.errorToken'))
      await window.electronAPI!.clearAuth()
    }
  }

  async function handleDeviceFlow() {
    if (!isElectron) return
    const settings = await window.electronAPI!.getSettings()
    const clientId = settings.githubClientId
    if (!clientId) {
      setStatus(t('auth.missingClientId'))
      setMode('pat')
      return
    }
    setLoading(true)
    setStatus('')
    const res = await window.electronAPI!.startOAuthDevice(clientId)
    if (res.error) {
      setStatus(`❌ ${res.error}`)
      setLoading(false)
      return
    }
    setDeviceCode(res.user_code || '')
    setDeviceVerificationUrl(res.verification_uri || '')
    setMode('device')
    setLoading(false)
    setStatus('Откройте ссылку и введите код')

    const interval = (res.interval || 5) * 1000
    pollRef.current = setInterval(async () => {
      const poll = await window.electronAPI!.pollOAuthToken(clientId, res.device_code!)
      if (poll.access_token) {
        clearInterval(pollRef.current!)
        await window.electronAPI!.saveAuthToken(poll.access_token)
        setStatus(t('auth.successOAuth'))
        setTimeout(() => { loadUser(); onClose() }, 1500)
      } else if (poll.error) {
        clearInterval(pollRef.current!)
        setStatus(`❌ ${poll.error}`)
      }
    }, interval)
  }

  function handleLogout() {
    if (!isElectron) return
    window.electronAPI!.clearAuth().then(() => { setUser(null); setStatus('') })
  }

  function handleOpenUrl(url: string) {
    if (isElectron) window.electronAPI!.openExternal(url)
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isElectron) return null

  return (
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
            className="w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Github className="w-5 h-5 text-primary" />
                  {t('auth.title')}
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                    <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-medium">{user.name || user.login}</p>
                      <p className="text-sm text-muted-foreground">@{user.login}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> {t('auth.logout')}
                  </Button>
                </div>
              ) : mode === 'menu' ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('auth.description')}
                  </p>
                  <Button variant="default" className="w-full justify-start gap-3" onClick={() => setMode('pat')}>
                    <Key className="w-4 h-4" /> {t('auth.pat')}
                  </Button>
                  <Button variant="secondary" className="w-full justify-start gap-3" onClick={handleDeviceFlow} disabled={loading}>
                    <Github className="w-4 h-4" /> {loading ? t('auth.loading') : t('auth.oauth')}
                  </Button>
                  {status && <p className="text-sm text-red-400 text-center">{status}</p>}
                </div>
              ) : mode === 'pat' ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Создайте токен в{' '}
                    <button className="text-primary hover:underline" onClick={() => handleOpenUrl('https://github.com/settings/tokens/new?scopes=repo,user&description=GitHub+Store')}>
                      настройках GitHub
                    </button>{' '}
                    и вставьте его ниже.
                  </p>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-input focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  />
                  {status && <p className={`text-sm ${status.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{status}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setMode('menu')}>{t('auth.back')}</Button>
                    <div className="flex-1" />
                    <Button onClick={handlePATSubmit} disabled={!token.trim() || loading}>
                      {loading ? t('auth.checking') : t('auth.login')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('auth.deviceCode')}</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-mono font-bold tracking-widest text-primary bg-primary/10 px-4 py-2 rounded-xl">
                      {deviceCode}
                    </span>
                    <button
                      onClick={() => handleCopyCode(deviceCode)}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title={t('auth.copyCode')}
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleOpenUrl(deviceVerificationUrl)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('auth.openPage')}
                  </Button>
                  {status && <p className="text-sm text-muted-foreground">{status}</p>}
                  <div className="flex gap-2 justify-center">
                    <Button variant="ghost" size="sm" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setMode('menu') }}>
                      {t('auth.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
