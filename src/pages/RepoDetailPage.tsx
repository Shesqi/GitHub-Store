import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  ArrowLeft, Download, Globe, Clock,
  User, Shield, BookOpen, ChevronDown, ChevronUp,
  FileText, Calendar, Package, Github, ZoomIn, ZoomOut, X,
  RotateCcw, Bell, BellOff, FileArchive, Share2, Check, Copy,
  History, Tag, File, AppWindow, Binary, Box, HardDrive,
  Terminal, FileCode, FileImage, FileVideo, FileAudio, RefreshCw, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FavButton } from '@/components/FavButton'
import { StatsBadge } from '@/components/StatsBadge'
import { SearchInPage } from '@/components/SearchInPage'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  getRepo, getReleases, getContributors, getRepoREADME, translateText,
} from '@/lib/api'
import { formatNumber, formatDate, getRepoCategory } from '@/lib/utils'
import type { GitHubRepo, GitHubRelease, GitHubAsset, GitHubContributor } from '@/lib/api'
import { useLanguage } from '@/i18n/LanguageContext'

type ReleaseFilter = 'all' | 'stable' | 'prerelease'

export function RepoDetailPage() {
  const { t } = useLanguage()
  const { owner, repo: repoName } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<GitHubRepo | null>(null)
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [contributors, setContributors] = useState<GitHubContributor[]>([])
  const [readme, setReadme] = useState('')
  const [translatedReadme, setTranslatedReadme] = useState('')
  const [loading, setLoading] = useState(true)
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>('all')
  const [selectedRelease, setSelectedRelease] = useState<string>('')
  const [selectedAsset, setSelectedAsset] = useState<string>('')
  const [showFullReadme, setShowFullReadme] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [showingTranslation, setShowingTranslation] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [showFloatTranslate, setShowFloatTranslate] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryEntry[]>([])
  const translateBtnRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imgBase, setImgBase] = useState({ w: 0, h: 0 })
  const dragData = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // scale is applied via width/height, not CSS transform, for proper container sizing

  function handleDragStart(e: React.MouseEvent) {
    if (scale <= 1) return
    setIsDragging(true)
    dragData.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    }
  }

  function handleDragMove(e: React.MouseEvent) {
    if (!isDragging) return
    const dx = e.clientX - dragData.current.startX
    const dy = e.clientY - dragData.current.startY
    setPosition({
      x: dragData.current.startPosX + dx,
      y: dragData.current.startPosY + dy,
    })
  }

  function handleDragEnd() {
    setIsDragging(false)
  }

  function applyZoom(delta: number) {
    setScale(s => Math.max(0.5, Math.min(5, s + delta)))
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const maxW = window.innerWidth * 0.9
    const maxH = window.innerHeight * 0.9
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w > maxW) { h = h * maxW / w; w = maxW }
    if (h > maxH) { w = w * maxH / h; h = maxH }
    setImgBase({ w, h })
  }

  // Non-passive wheel listener to prevent background scroll
  useEffect(() => {
    const el = imgContainerRef.current
    if (!el || !lightbox) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      applyZoom(e.deltaY > 0 ? -0.2 : 0.2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lightbox])

  // Reset zoom/position when lightbox opens
  useEffect(() => {
    if (lightbox) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setImgBase({ w: 0, h: 0 })
    }
  }, [lightbox])

  useEffect(() => {
    function onScroll() {
      const el = translateBtnRef.current
      if (!el) { setShowFloatTranslate(false); return }
      const rect = el.getBoundingClientRect()
      setShowFloatTranslate(rect.bottom < 48)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [readme, translatedReadme])

  const defaultBranch = repo?.default_branch || 'main'

  function resolveUrl(url: string): string {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:')) return url
    const base = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/`
    const clean = url.startsWith('/') ? url.slice(1) : url.startsWith('./') ? url.slice(2) : url
    try {
      return new URL(clean, base).href
    } catch {
      return url
    }
  }

  useEffect(() => {
    if (!owner || !repoName) return
    loadData()
  }, [owner, repoName])

  async function loadData() {
    if (!owner || !repoName) return
    const o = owner
    const r = repoName
    setLoading(true)
    try {
      const [repoData, releasesData, contributorsData] = await Promise.all([
        getRepo(o, r),
        getReleases(o, r),
        getContributors(o, r),
      ])
        const enrichedReleases = releasesData.map(rel => ({
          ...rel,
          assets: rel.assets.length > 0 ? rel.assets : [
            {
              id: -(rel.id + 1),
              name: `${repoData.name}-${rel.tag_name}.zip`,
              label: 'Source code (zip)',
              size: 0,
              download_count: 0,
              browser_download_url: `https://github.com/${o}/${repoName}/archive/refs/tags/${rel.tag_name}.zip`,
              content_type: 'application/zip',
              created_at: rel.created_at,
              updated_at: rel.published_at,
            },
            {
              id: -(rel.id + 2),
              name: `${repoData.name}-${rel.tag_name}.tar.gz`,
              label: 'Source code (tar.gz)',
              size: 0,
              download_count: 0,
              browser_download_url: `https://github.com/${o}/${repoName}/archive/refs/tags/${rel.tag_name}.tar.gz`,
              content_type: 'application/gzip',
              created_at: rel.created_at,
              updated_at: rel.published_at,
            },
          ],
        }))
        setRepo(repoData)
        setReleases(enrichedReleases)
        window.electronAPI?.dismissUpdate(repoData.full_name)
        setContributors(contributorsData)
        if (enrichedReleases.length > 0) {
          setSelectedRelease(enrichedReleases[0].tag_name)
        }

        const readmeText = await getRepoREADME(o, r)
        setReadme(readmeText)

        if (window.electronAPI) {
          const prefs = await window.electronAPI.getNotificationPrefs()
          setNotifPrefs(prefs)
          const history = await window.electronAPI.getDownloadHistory(repoData.full_name)
          setDownloadHistory(history)
        }
      } catch (err) {
        console.error('Failed to load repo details:', err)
      } finally {
        setLoading(false)
      }
  }

  useEffect(() => {
    function onDownloadComplete(e: CustomEvent<{ fullName: string }>) {
      if (e.detail.fullName === repo?.full_name && window.electronAPI) {
        window.electronAPI.getDownloadHistory(e.detail.fullName).then(setDownloadHistory)
      }
    }
    window.addEventListener('download-complete', onDownloadComplete as EventListener)
    return () => window.removeEventListener('download-complete', onDownloadComplete as EventListener)
  }, [repo?.full_name])

  const filteredReleases = releases.filter(r => {
    if (releaseFilter === 'stable') return !r.prerelease
    if (releaseFilter === 'prerelease') return r.prerelease
    return true
  })

  const currentRelease = releases.find(r => r.tag_name === selectedRelease)
  const currentAsset = currentRelease?.assets.find(a => a.name === selectedAsset)
  const hasNoReleases = releases.length === 0

  let allAssets: GitHubAsset[] = []
  if (releaseFilter === 'all') {
    allAssets = releases.flatMap(r => r.assets)
  } else {
    allAssets = filteredReleases.flatMap(r => r.assets)
  }

  async function handleTranslate() {
    if (!readme) return
    if (showingTranslation) {
      setShowingTranslation(false)
      return
    }
    if (!translatedReadme) {
      setTranslating(true)
      const translated = await translateText(readme)
      setTranslatedReadme(translated)
      setTranslating(false)
    }
    setShowingTranslation(true)
  }

  function formatSize(bytes: number): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(filename: string, className = 'w-4 h-4') {
    const ext = filename.toLowerCase().split('.').pop()
    if (!ext) return <File className={className} />
    const icons: Record<string, JSX.Element> = {
      exe: <AppWindow className={className} />,
      msi: <Box className={className} />,
      msu: <Box className={className} />,
      zip: <FileArchive className={className} />,
      gz: <FileArchive className={className} />,
      tgz: <FileArchive className={className} />,
      rar: <FileArchive className={className} />,
      '7z': <FileArchive className={className} />,
      bz2: <FileArchive className={className} />,
      dmg: <HardDrive className={className} />,
      deb: <Box className={className} />,
      rpm: <Box className={className} />,
      pkg: <Box className={className} />,
      appimage: <Binary className={className} />,
      jar: <Binary className={className} />,
      sh: <Terminal className={className} />,
      bat: <Terminal className={className} />,
      cmd: <Terminal className={className} />,
      ps1: <Terminal className={className} />,
      md: <FileText className={className} />,
      txt: <FileText className={className} />,
      pdf: <FileText className={className} />,
      json: <FileCode className={className} />,
      yaml: <FileCode className={className} />,
      yml: <FileCode className={className} />,
      xml: <FileCode className={className} />,
      toml: <FileCode className={className} />,
      js: <FileCode className={className} />,
      ts: <FileCode className={className} />,
      jsx: <FileCode className={className} />,
      tsx: <FileCode className={className} />,
      css: <FileCode className={className} />,
      scss: <FileCode className={className} />,
      html: <FileCode className={className} />,
      png: <FileImage className={className} />,
      jpg: <FileImage className={className} />,
      jpeg: <FileImage className={className} />,
      gif: <FileImage className={className} />,
      svg: <FileImage className={className} />,
      ico: <FileImage className={className} />,
      webp: <FileImage className={className} />,
      bmp: <FileImage className={className} />,
      mp4: <FileVideo className={className} />,
      avi: <FileVideo className={className} />,
      mov: <FileVideo className={className} />,
      mkv: <FileVideo className={className} />,
      webm: <FileVideo className={className} />,
      mp3: <FileAudio className={className} />,
      wav: <FileAudio className={className} />,
      flac: <FileAudio className={className} />,
      ogg: <FileAudio className={className} />,
      aac: <FileAudio className={className} />,
    }
    return icons[ext] || <File className={className} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground">{t('repoDetail.loading')}</p>
        </div>
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-xl text-muted-foreground">{t('repoDetail.notFound')}</p>
        <Button variant="outline" onClick={() => navigate('/')}>{t('nav.home')}</Button>
      </div>
    )
  }

  const category = getRepoCategory(repo.name, repo.topics)
  const totalDownloads = releases.reduce((sum, r) =>
    sum + r.assets.reduce((s, a) => s + a.download_count, 0), 0
  )

  return (
    <div className="min-h-screen" ref={contentRef}>
      <SearchInPage containerRef={contentRef} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" onClick={() => {
              const prev = sessionStorage.getItem('detail-from')
              sessionStorage.removeItem('detail-from')
              window.location.hash = prev || '/'
            }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('nav.back')}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => loadData()} disabled={loading} title={t('nav.refresh')}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass rounded-2xl p-6 sm:p-8 mb-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-3xl flex-shrink-0 shadow-xl shadow-blue-500/20 overflow-hidden">
                    <img
                      src={repo.owner.avatar_url}
                      alt={repo.owner.login}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
                      style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/40 to-violet-500/40" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-bold">{repo.name}</h1>
                      <Badge variant="secondary" className="text-xs">
                        {repo.language || 'N/A'}
                      </Badge>
                      <FavButton repoFullName={repo.full_name} />
                      {notifPrefs[repo.full_name] !== false ? (
                        <button
                          onClick={() => {
                            const newVal = false
                            setNotifPrefs(p => ({ ...p, [repo.full_name]: newVal }))
                            window.electronAPI?.setNotificationPref(repo.full_name, newVal)
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 transition-colors"
                          title={t('repoDetail.disableNotifications')}
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const newVal = true
                            setNotifPrefs(p => ({ ...p, [repo.full_name]: newVal }))
                            window.electronAPI?.setNotificationPref(repo.full_name, newVal)
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          title={t('repoDetail.enableNotifications')}
                        >
                          <BellOff className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setShareOpen(true)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                        title={t('repoDetail.share')}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {repo.owner.login}/{repo.name}
                    </p>
                    <p className="text-lg mt-2 text-foreground/80">
                      {repo.description || t('repoDetail.noDescription')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                  <StatsBadge icon="stars" value={repo.stargazers_count} />
                  <StatsBadge icon="forks" value={repo.forks_count} />
                  <StatsBadge icon="downloads" value={totalDownloads} />
                  <StatsBadge icon="watchers" value={repo.watchers_count} />
                  <StatsBadge icon="issues" value={repo.open_issues_count} />
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {t('repoDetail.created', { date: formatDate(repo.created_at, t) })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {t('repoDetail.updated', { date: formatDate(repo.updated_at, t) })}
                  </span>
                  {repo.license && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      {repo.license.name}
                    </span>
                  )}
                </div>

                {repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {repo.topics.map(topic => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 lg:w-80">
                {hasNoReleases ? (
                  <Button
                    variant="gradient"
                    size="xl"
                    className="w-full gap-2 text-base"
                    onClick={() => {
                      const zipUrl = `https://github.com/${repo.full_name}/archive/refs/heads/${repo.default_branch}.zip`
                      const filename = `${repo.name}-${repo.default_branch}.zip`
                      if (window.electronAPI) {
                        window.dispatchEvent(new CustomEvent('start-download', {
                          detail: {
                            url: zipUrl,
                            filename,
                            repoFullName: repo.full_name,
                            fileSize: 0,
                          },
                        }))
                      } else {
                        window.open(zipUrl, '_blank')
                      }
                    }}
                  >
                    <FileArchive className="w-5 h-5" />
                    {t('repoDetail.downloadZip')}
                  </Button>
                ) : (
                  <Button
                    variant="gradient"
                    size="xl"
                    className="w-full gap-2 text-base"
                    disabled={!currentAsset}
                    onClick={() => {
                      if (currentAsset) {
                        if (window.electronAPI) {
                          window.dispatchEvent(new CustomEvent('start-download', {
                            detail: {
                              url: currentAsset.browser_download_url,
                              filename: currentAsset.name,
                              repoFullName: repo?.full_name,
                              releaseTag: selectedRelease,
                              fileSize: currentAsset.size,
                            },
                          }))
                        } else {
                          window.open(currentAsset.browser_download_url, '_blank')
                        }
                      }
                    }}
                  >
                    <Download className="w-5 h-5" />
                    {currentAsset ? t('repoDetail.download') : t('repoDetail.selectFile')}
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 gap-2"
                    onClick={() => window.electronAPI?.openGithubUrl(repo.html_url)}
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                  </Button>
                  {repo.homepage && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={() => window.open(repo.homepage, '_blank')}
                    >
                      <Globe className="w-4 h-4" />
                      {t('repoDetail.website')}
                    </Button>
                  )}
                </div>

                {currentAsset && (
                  <div className="text-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{currentAsset.label || currentAsset.name}</p>
                    <p>
                      {formatSize(currentAsset.size)}
                      {currentAsset.download_count > 0 && ` • ${t('repoDetail.downloads', { count: formatNumber(currentAsset.download_count) })}`}
                    </p>
                  </div>
                )}

                {downloadHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <History className="w-4 h-4" />
                    {t('repoDetail.downloadHistory')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {!hasNoReleases && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass rounded-2xl p-6 sm:p-8 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {t('repoDetail.versionPicker')}
              </h2>

              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1.5 block">{t('repoDetail.releaseType')}</label>
                  <div className="flex gap-2">
                    {(['all', 'stable', 'prerelease'] as ReleaseFilter[]).map(filter => (
                      <Button
                        key={filter}
                        variant={releaseFilter === filter ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => setReleaseFilter(filter)}
                      >
                        {filter === 'all' ? t('repoDetail.all') : filter === 'stable' ? t('repoDetail.stable') : t('repoDetail.prerelease')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1.5 block">{t('repoDetail.version')}</label>
                  <Select value={selectedRelease} onValueChange={setSelectedRelease}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('repoDetail.selectVersion')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReleases.map(r => (
                        <SelectItem key={r.id} value={r.tag_name}>
                          {r.tag_name} {r.prerelease ? '(pre)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {currentRelease && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-1.5 block">{t('repoDetail.file')}</label>
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('repoDetail.selectFilePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {currentRelease.assets.map(asset => (
                          <SelectItem key={asset.id} value={asset.name}>
                            <span className="flex items-center gap-2 whitespace-nowrap">
                              {getFileIcon(asset.name)}
                              <span className="truncate">
                                {asset.label ? `${asset.label} — ` : ''}{asset.name}
                              </span>
                              <span className="text-muted-foreground shrink-0">({formatSize(asset.size)})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {filteredReleases.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  {t('repoDetail.noReleases')}
                </p>
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="readme" className="glass rounded-2xl p-6 sm:p-8">
            <TabsList className="mb-6">
              <TabsTrigger value="readme" className="gap-2">
                <BookOpen className="w-4 h-4" />
                {t('repoDetail.description')}
              </TabsTrigger>
              <TabsTrigger value="changelog" className="gap-2">
                <FileText className="w-4 h-4" />
                Changelog
              </TabsTrigger>
              <TabsTrigger value="contributors" className="gap-2">
                <User className="w-4 h-4" />
                {t('repoDetail.contributors')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="readme">
              <div ref={translateBtnRef} className="flex justify-end mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={translating || !readme}
                  className="gap-2"
                >
                  {translating ? t('repoDetail.translating') : showingTranslation ? t('repoDetail.showOriginal') : t('repoDetail.translate')}
                </Button>
              </div>

              {readme ? (
                <div>
                  <div className={`relative overflow-hidden ${!showFullReadme ? 'max-h-96' : ''}`}>
                    <div className="markdown-body text-sm leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 text-foreground">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h4>,
                          p: ({ children }) => <p className="mb-4 text-foreground/80 leading-relaxed">{children}</p>,
                          a: ({ href, children }) => {
                            if (!href) return <>{children}</>
                            const url = resolveUrl(href)
                            const isVideo = /\.(mp4|webm|mov)$/i.test(url)
                            const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(url)
                            const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(url)
                            if (isVideo) {
                              return (
                                <video controls className="max-w-full rounded-xl my-4" preload="metadata">
                                  <source src={url} />
                                </video>
                              )
                            }
                            if (isAudio) {
                              return (
                                <audio controls className="my-4 w-full" preload="metadata">
                                  <source src={url} />
                                </audio>
                              )
                            }
                            if (isImage) {
                              return (
                                <img
                                  src={url}
                                  alt={typeof children === 'string' ? children : ''}
                                  className="max-w-full h-auto max-h-[500px] w-auto rounded-xl my-4 cursor-pointer hover:opacity-90 transition-opacity object-contain"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onClick={() => setLightbox(url)}
                                />
                              )
                            }
                            const githubRepoMatch = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+)/)
                            if (githubRepoMatch) {
                              return (
                                <a
                                  href={url}
                                  onClick={e => { e.preventDefault(); navigate(`/repo/${githubRepoMatch[1]}/${githubRepoMatch[2]}`) }}
                                  className="text-primary hover:underline cursor-pointer"
                                >
                                  {children}
                                </a>
                              )
                            }
                            return (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {children}
                            </a>
                            )
                          },
                          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-foreground/80 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-primary/30 pl-4 my-4 py-2 text-foreground/70 italic bg-secondary/30 rounded-r-lg">
                              {children}
                            </blockquote>
                          ),
                          code: ({ className, children, ...props }) => {
                            const isInline = !className
                            if (isInline) {
                              return (
                                <code className="bg-secondary/80 px-1.5 py-0.5 rounded-md text-sm font-mono text-foreground/90" {...props}>
                                  {children}
                                </code>
                              )
                            }
                            return (
                              <div className="relative my-4">
                                <div className="absolute top-0 right-0 px-3 py-1 text-xs text-muted-foreground bg-secondary/50 rounded-bl-lg rounded-tr-lg font-mono">
                                  {(className || '').replace('language-', '')}
                                </div>
                                <pre className="bg-secondary/50 rounded-xl p-4 overflow-x-auto">
                                  <code className={`text-sm font-mono text-foreground/90 leading-relaxed ${className || ''}`} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              </div>
                            )
                          },
                          pre: ({ children }) => <>{children}</>,
                          hr: () => <hr className="my-6 border-border" />,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-4 rounded-xl border border-border/50">
                              <table className="w-full text-sm text-foreground/80">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-secondary/50">{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className="border-b border-border/50 last:border-0">{children}</tr>,
                          th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-foreground">{children}</th>,
                          td: ({ children }) => <td className="px-4 py-2 text-foreground/80">{children}</td>,
                          img: ({ src, alt }) => {
                            if (!src) return null
                            const url = resolveUrl(src)
                            return (
                              <img
                                src={url}
                                alt={alt || ''}
                                className="max-w-full h-auto max-h-[500px] w-auto rounded-xl my-4 cursor-pointer hover:opacity-90 transition-opacity object-contain"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onClick={() => setLightbox(url)}
                              />
                            )
                          },
                          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                        }}
                      >
                        {showingTranslation ? translatedReadme : readme}
                      </ReactMarkdown>
                    </div>
                    {!showFullReadme && (
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
                    )}
                  </div>
                  {readme.length > 500 && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowFullReadme(!showFullReadme)}
                      className="mt-2 gap-2"
                    >
                      {showFullReadme ? (
                        <>{t('repoDetail.collapse')} <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>{t('repoDetail.expand')} <ChevronDown className="w-4 h-4" /></>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {t('repoDetail.noReadme')}
                </p>
              )}
            </TabsContent>

            <TabsContent value="changelog">
              <div className="space-y-4">
                {releases.length > 0 ? (
                  releases.map(release => (
                    <div
                      key={release.id}
                      className="border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{release.tag_name}</h3>
                          {release.prerelease && (
                            <Badge variant="warning" className="text-xs">Pre-release</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(release.published_at, t)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-3">
                        {release.name || release.tag_name}
                      </p>
                      {release.body && (
                        <details className="mt-2">
                          <summary className="text-sm text-primary cursor-pointer hover:underline">
                            {t('repoDetail.details')}
                          </summary>
                          <div className="mt-3 text-sm text-foreground/70 markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {release.body}
                            </ReactMarkdown>
                          </div>
                        </details>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {release.assets.map(asset => (
                          <a
                            key={asset.id}
                            href={asset.browser_download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                          >
                            {getFileIcon(asset.name, 'w-3.5 h-3.5')}
                            {asset.name} ({formatSize(asset.size)})
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    {t('repoDetail.noChangelogs')}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contributors">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {contributors.length > 0 ? (
                  contributors.map(contributor => (
                    <button
                      key={contributor.id}
                      onClick={() => window.electronAPI?.openGithubUrl(`https://github.com/${contributor.login}`)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors w-full text-left"
                    >
                      <img
                        src={contributor.avatar_url}
                        alt={contributor.login}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-sm">{contributor.login}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('repoDetail.contributorCount', { count: contributor.contributions })}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-muted-foreground col-span-full text-center py-8">
                    {t('repoDetail.contributorsUnavailable')}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Download History Modal */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
            <motion.div
              className="relative glass rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  {t('repoDetail.historyTitle')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6 pt-4 space-y-3">
                {[...downloadHistory].reverse().map((entry, i) => {
                  const realIndex = downloadHistory.length - 1 - i
                  const release = releases.find(r => r.tag_name === entry.releaseTag)
                  return (
                    <div key={entry.downloadedAt + entry.filename} className="glass rounded-xl p-4 flex items-start gap-3 hover:bg-white/5 transition-colors group">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"
                        title={release?.prerelease ? t('repoDetail.prereleaseLabel') : t('repoDetail.stableLabel')}
                      >
                        {release?.prerelease ? (
                          <Shield className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Shield className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{entry.releaseTag}</span>
                          {release?.prerelease && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                              prerelease
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(entry.downloadedAt).toLocaleString('ru-RU', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          <span className="flex items-center gap-1 min-w-0 flex-1 pr-2">
                            <File className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={entry.filename}>{entry.filename}</span>
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {entry.size > 0 ? formatSize(entry.size) : '—'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.electronAPI) {
                            await window.electronAPI.deleteDownloadHistoryEntry(repo?.full_name ?? '', realIndex)
                            const history = await window.electronAPI.getDownloadHistory(repo?.full_name ?? '')
                            setDownloadHistory(history)
                          }
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                        title={t('repoDetail.deleteEntry')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        {showFloatTranslate && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={handleTranslate}
            disabled={translating || !readme}
            className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-xl shadow-primary/25 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {translating ? t('repoDetail.translating') : showingTranslation ? t('repoDetail.showOriginal') : t('repoDetail.translate')}
          </motion.button>
        )}

        {shareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { setShareOpen(false); setCopied(false) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="glass rounded-2xl p-6 w-80 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold mb-1">{t('repoDetail.share')}</h3>
              <p className="text-xs text-muted-foreground mb-4">{repo?.full_name}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={repo?.html_url || ''}
                  className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground border border-border/50 outline-none select-all"
                  onFocus={e => e.target.select()}
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(repo?.html_url || '')
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    } catch {}
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-primary mt-2 text-center"
                >
                  {t('repoDetail.copied')}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <button
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.5)) }}
                title={t('repoDetail.zoomOut')}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/60 w-10 text-center tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(5, s + 0.5)) }}
                title={t('repoDetail.zoomIn')}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1" />
              <button
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                onClick={(e) => { e.stopPropagation(); setScale(1); setPosition({ x: 0, y: 0 }) }}
                title={t('repoDetail.reset')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1" />
              <button
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500/60 transition-colors text-white/80 hover:text-white"
                onClick={() => setLightbox(null)}
                title={t('repoDetail.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={imgContainerRef}
                className="cursor-grab active:cursor-grabbing overflow-hidden rounded-2xl flex items-center justify-center"
                style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              >
                <img
                  src={lightbox}
                  alt=""
                  draggable={false}
                  className="select-none"
                  onLoad={onImgLoad}
                  style={{
                    width: imgBase.w ? imgBase.w * scale : 'auto',
                    height: imgBase.h ? imgBase.h * scale : 'auto',
                    transform: position.x || position.y ? `translate(${position.x}px, ${position.y}px)` : undefined,
                    transition: isDragging ? 'none' : 'width 0.2s, height 0.2s, transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
