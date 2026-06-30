export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string
  html_url: string
  homepage: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  watchers_count: number
  language: string
  topics: string[]
  created_at: string
  updated_at: string
  pushed_at: string
  owner: {
    login: string
    avatar_url: string
    html_url: string
  }
  license?: {
    name: string
  }
  default_branch: string
  downloads_count?: number
}

export interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  prerelease: boolean
  created_at: string
  published_at: string
  assets: GitHubAsset[]
}

export interface GitHubAsset {
  id: number
  name: string
  label: string
  size: number
  download_count: number
  browser_download_url: string
  content_type: string
  created_at: string
  updated_at: string
}

export interface GitHubContributor {
  id: number
  login: string
  avatar_url: string
  contributions: number
}

const GITHUB_API = 'https://api.github.com'
const CACHE_TTL = 30 * 60 * 1000

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

const cache = new Map<string, { data: unknown; timestamp: number }>()

export function clearApiCache() {
  cache.clear()
}

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Store-App',
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  cache.set(url, { data, timestamp: Date.now() })
  return data as T
}

export async function searchRepos(query: string, sort: 'stars' | 'updated' | 'created' = 'stars', page = 1): Promise<GitHubRepo[]> {
  const data = await fetchWithCache<{ items: GitHubRepo[] }>(
    `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=30&page=${page}`
  )
  return data.items
}

export async function getTrendingRepos(page = 1): Promise<GitHubRepo[]> {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const dateStr = date.toISOString().split('T')[0]
  return searchRepos(`created:>${dateStr} stars:>100`, 'stars', page)
}

export async function getHotRepos(page = 1): Promise<GitHubRepo[]> {
  const date = new Date()
  date.setDate(date.getDate() - 3)
  const dateStr = date.toISOString().split('T')[0]
  return searchRepos(`pushed:>${dateStr} stars:>50`, 'updated', page)
}

export async function getPopularRepos(page = 1): Promise<GitHubRepo[]> {
  return searchRepos('stars:>1000', 'stars', page)
}

export async function getRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return fetchWithCache<GitHubRepo>(`${GITHUB_API}/repos/${owner}/${repo}`)
}

export async function getReleases(owner: string, repo: string, page = 1): Promise<GitHubRelease[]> {
  return fetchWithCache<GitHubRelease[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=30&page=${page}`
  )
}

export async function getReleaseByTag(owner: string, repo: string, tag: string): Promise<GitHubRelease> {
  return fetchWithCache<GitHubRelease>(`${GITHUB_API}/repos/${owner}/${repo}/releases/tags/${tag}`)
}

export async function getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
  return fetchWithCache<GitHubContributor[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=10`
  )
}

export async function getRepoREADME(owner: string, repo: string): Promise<string> {
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
          'User-Agent': 'GitHub-Store-App',
        },
      }
    )
    if (!response.ok) throw new Error('README not found')
    return response.text()
  } catch {
    return ''
  }
}

async function translateChunk(text: string, targetLang: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Translation failed')
  const data = await response.json()
  return data[0].map((part: unknown[]) => part[0]).filter(Boolean).join('')
}

async function translateSegment(text: string, targetLang: string): Promise<string> {
  const maxLen = 4000
  if (text.length <= maxLen) {
    return await translateChunk(text, targetLang)
  }
  const parts: string[] = []
  let pos = 0
  while (pos < text.length) {
    let end = Math.min(pos + maxLen, text.length)
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end)
      if (boundary > pos) end = boundary
    }
    parts.push(await translateChunk(text.slice(pos, end), targetLang))
    pos = end
  }
  return parts.join('\n')
}

export async function translateText(text: string, targetLang = 'ru'): Promise<string> {
  try {
    const segs: { type: 'code' | 'text'; content: string }[] = []
    let last = 0
    const re = /```[\s\S]*?```|`[^`]+`/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ type: 'text', content: text.slice(last, m.index) })
      segs.push({ type: 'code', content: m[0] })
      last = m.index + m[0].length
    }
    if (last < text.length) segs.push({ type: 'text', content: text.slice(last) })

    const translated = await Promise.all(
      segs.map(async s => {
        if (s.type === 'code') return s.content
        const mLeading = s.content.match(/^(\s*)/)
        const mTrailing = s.content.match(/(\s*)$/)
        const leading = mLeading?.[1] ?? ''
        const trailing = mTrailing?.[1] ?? ''
        const body = s.content.slice(leading.length, s.content.length - trailing.length)
        if (!body) return s.content
        const translated = await translateSegment(body, targetLang)
        return leading + translated + trailing
      })
    )

    return translated.join('')
  } catch {
    return text
  }
}


