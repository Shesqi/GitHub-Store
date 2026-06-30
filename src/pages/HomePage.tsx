import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw, Package, Loader2 } from 'lucide-react'
import { RepoCard } from '@/components/RepoCard'
import { SortBar } from '@/components/SortBar'
import { TagFilter } from '@/components/TagFilter'
import { Button } from '@/components/ui/button'
import { getTrendingRepos, getHotRepos, getPopularRepos, searchRepos } from '@/lib/api'
import { getRepoCategory } from '@/lib/utils'
import type { GitHubRepo } from '@/lib/api'
import { useLanguage } from '@/i18n/LanguageContext'

type SortOption = 'trending' | 'hot' | 'popular'

const STORAGE_KEY = 'gh-store-home-state'
const PER_PAGE = 30

interface SavedState {
  sort: SortOption
  category: string
  searchQuery: string
  repos: GitHubRepo[]
  page: number
}

let cachedState: SavedState | null = null

function saveState(state: SavedState) {
  cachedState = state
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function loadState(): SavedState | null {
  if (cachedState) return cachedState
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function HomePage() {
  const { t } = useLanguage()
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<SortOption>('trending')
  const [category, setCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const loadFnRef = useRef<(pageNum: number, append: boolean) => Promise<void>>()

  const doLoad = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      let data: GitHubRepo[]
      if (searchQuery) {
        data = await searchRepos(searchQuery, 'stars', pageNum)
      } else {
        switch (sort) {
          case 'trending':
            data = await getTrendingRepos(pageNum)
            break
          case 'hot':
            data = await getHotRepos(pageNum)
            break
          case 'popular':
            data = await getPopularRepos(pageNum)
            break
        }
      }
      if (append) {
        setRepos(prev => [...prev, ...(data || [])])
      } else {
        setRepos(data || [])
        saveState({ sort, category, searchQuery, repos: data || [], page: pageNum })
      }
      setHasMore(data && data.length >= PER_PAGE)
    } catch {
      if (!append) {
        setError(t('home.loadError'))
        setRepos([])
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [searchQuery, sort])

  loadFnRef.current = doLoad

  useEffect(() => {
    sessionStorage.removeItem('detail-from')
    const saved = loadState()
    if (saved) {
      setSort(saved.sort)
      setCategory(saved.category)
      setSearchQuery(saved.searchQuery)
      setRepos(saved.repos)
      setPage(saved.page)
      setHasMore(saved.repos.length >= PER_PAGE)
      setLoading(false)
      console.log('HomePage: restored from sessionStorage:', saved.searchQuery, saved.repos.length)
      return
    }
    console.log('HomePage: no saved state, loading fresh')
    setPage(1)
    doLoad(1, false)
  }, [])

  // Reload when sort changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setPage(1)
    loadFnRef.current?.(1, false)
  }, [sort])

  function loadMore() {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    doLoad(nextPage, true)
  }

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore])

  function handleLoadRepos() {
    setPage(1)
    doLoad(1, false)
  }

  // Save state whenever key values change
  useEffect(() => {
    if (!loading && !loadingMore) {
      saveState({ sort, category, searchQuery, repos, page })
    }
  }, [sort, category, searchQuery, repos, page, loading, loadingMore])

  const filteredRepos = category === 'all'
    ? repos
    : repos.filter(r => getRepoCategory(r.name, r.topics) === category)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    doLoad(1, false)
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-8"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={async () => {
                setSearchQuery('')
                setCategory('all')
                setSort('trending')
                setPage(1)
                setRepos([])
                saveState({ sort: 'trending', category: 'all', searchQuery: '', repos: [], page: 1 })
                const data = await getTrendingRepos(1)
                setRepos(data || [])
                setHasMore(data && data.length >= PER_PAGE)
                saveState({ sort: 'trending', category: 'all', searchQuery: '', repos: data || [], page: 1 })
              }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">GitHub Store</h1>
                  <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLoadRepos} disabled={loading}>
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('home.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-input focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
            </form>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <SortBar current={sort} onChange={setSort} />
          </div>

          <TagFilter selected={category} onSelect={setCategory} />

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={handleLoadRepos}>{t('home.retry')}</Button>
            </motion.div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[220px] rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRepos.length > 0 ? (
                filteredRepos.map((repo, i) => (
                  <RepoCard key={repo.id} repo={repo} />
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">{t('home.notFound')}</p>
                </div>
              )}
            </motion.div>
          )}

          {loadingMore && (
            <div className="flex justify-center items-center h-[60px]">
              <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
        </motion.div>
      </div>
    </div>
  )
}
