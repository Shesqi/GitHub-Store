import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock, User, ArrowUpCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsBadge } from './StatsBadge'
import { FavButton } from './FavButton'
import { formatDate, getCategoryIcon, getRepoCategory } from '@/lib/utils'
import type { GitHubRepo } from '@/lib/api'
import { useLanguage } from '@/i18n/LanguageContext'

interface RepoCardProps {
  repo: GitHubRepo
  updateInfo?: UpdateInfo
}

export function RepoCard({ repo, updateInfo }: RepoCardProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const category = getRepoCategory(repo.name, repo.topics)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
    >
      <Card
        className={`cursor-pointer group h-full overflow-hidden bg-gradient-to-b from-card to-card/50 ${
          updateInfo
            ? 'border-amber-400/50 hover:border-amber-400/70'
            : 'border-transparent hover:border-primary/30'
        }`}
        onClick={() => navigate(`/repo/${repo.full_name}`)}
      >
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start gap-3 mb-3">
            <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex-shrink-0 shadow-lg shadow-blue-500/20 overflow-hidden">
              <img
                src={repo.owner.avatar_url}
                alt={repo.owner.login}
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
                onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-violet-500/20" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                {repo.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {repo.owner.login}/{repo.name}
              </p>
            </div>
            {updateInfo && (
              <motion.a
                href={updateInfo.latestUrl}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={e => e.stopPropagation()}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[10px] font-medium hover:bg-amber-400/25 transition-colors"
                title={`Доступно обновление: ${updateInfo.latestTag}`}
              >
                <ArrowUpCircle className="w-3 h-3" />
                {updateInfo.latestTag}
              </motion.a>
            )}
            <FavButton repoFullName={repo.full_name} size="sm" />
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
            {repo.description || 'Нет описания'}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {repo.language && (
              <Badge variant="secondary" className="text-xs">
                {repo.language}
              </Badge>
            )}
            {repo.license && (
              <Badge variant="outline" className="text-xs">
                {repo.license.name}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatsBadge icon="stars" value={repo.stargazers_count} size="sm" />
            <StatsBadge icon="forks" value={repo.forks_count} size="sm" />
            <StatsBadge icon="issues" value={repo.open_issues_count} size="sm" />
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(repo.updated_at, t)}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {repo.owner.login}
            </span>
            <span className="ml-auto text-[20px] text-muted-foreground/40 leading-none">
              {getCategoryIcon(category)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
