import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function formatDate(date: string, t?: (key: string, vars?: Record<string, string | number>) => string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return t ? t('date.today') : 'Today'
  if (days === 1) return t ? t('date.yesterday') : 'Yesterday'
  if (days < 7) return t ? t('date.daysAgo', { days }) : `${days} days ago`
  if (days < 30) return t ? t('date.weeksAgo', { weeks: Math.floor(days / 7) }) : `${Math.floor(days / 7)} wk ago`
  if (days < 365) return t ? t('date.monthsAgo', { months: Math.floor(days / 30) }) : `${Math.floor(days / 30)} mo ago`
  return t ? t('date.yearsAgo', { years: Math.floor(days / 365) }) : `${Math.floor(days / 365)} yr ago`
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    media: '🎬',
    privacy: '🔒',
    network: '🌐',
    developer: '💻',
    system: '⚙️',
    security: '🛡️',
    productivity: '📊',
    games: '🎮',
    graphics: '🎨',
    audio: '🎵',
    utility: '🔧',
    communication: '💬',
    education: '📚',
    finance: '💰',
    health: '❤️',
  }
  return icons[category] || '📦'
}

export function getRepoCategory(repoName: string, topics: string[]): string {
  const categoryMap: Record<string, string[]> = {
    media: ['media', 'video', 'player', 'stream', 'youtube', 'music', 'movie', 'ffmpeg'],
    privacy: ['privacy', 'private', 'secure', 'encrypt', 'vpn', 'proxy', 'tor'],
    network: ['network', 'http', 'server', 'proxy', 'api', 'web', 'tcp', 'udp'],
    developer: ['developer', 'cli', 'tool', 'sdk', 'api', 'framework', 'library', 'npm'],
    system: ['system', 'monitor', 'process', 'disk', 'memory', 'cpu', 'terminal', 'shell'],
    security: ['security', 'antivirus', 'firewall', 'scan', 'malware'],
    productivity: ['productivity', 'note', 'todo', 'task', 'calendar', 'organizer'],
    games: ['game', 'gaming', 'emulator', 'rpg', 'fps'],
    graphics: ['graphic', 'image', 'photo', 'design', 'edit', 'svg', 'png'],
    audio: ['audio', 'sound', 'music', 'spotify', 'podcast'],
    utility: ['utility', 'tools', 'cleaner', 'compressor', 'converter'],
    communication: ['chat', 'messenger', 'discord', 'telegram', 'slack', 'email'],
    education: ['education', 'learn', 'course', 'tutorial', 'wiki'],
    finance: ['finance', 'bank', 'crypto', 'wallet', 'money', 'trade'],
    health: ['health', 'fitness', 'medicine', 'wellness'],
  }

  const allTags = [repoName.toLowerCase(), ...topics.map(t => t.toLowerCase())]
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(kw => allTags.some(tag => tag.includes(kw)))) {
      return category
    }
  }
  return 'utility'
}
