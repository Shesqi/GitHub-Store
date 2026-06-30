import { Star, GitFork, Download, Eye, AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface StatsBadgeProps {
  icon: 'stars' | 'forks' | 'downloads' | 'watchers' | 'issues'
  value: number
  size?: 'sm' | 'md'
}

const icons = {
  stars: Star,
  forks: GitFork,
  downloads: Download,
  watchers: Eye,
  issues: AlertCircle,
}

const colors = {
  stars: 'text-amber-400 bg-amber-500/10',
  forks: 'text-blue-400 bg-blue-500/10',
  downloads: 'text-emerald-400 bg-emerald-500/10',
  watchers: 'text-purple-400 bg-purple-500/10',
  issues: 'text-red-400 bg-red-500/10',
}

export function StatsBadge({ icon, value, size = 'md' }: StatsBadgeProps) {
  const Icon = icons[icon]
  const sizeClasses = size === 'sm' ? 'text-xs gap-1 px-2 py-0.5' : 'text-sm gap-1.5 px-3 py-1'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colors[icon]} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {formatNumber(value)}
    </span>
  )
}
