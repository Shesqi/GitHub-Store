import { motion } from 'framer-motion'
import { TrendingUp, Flame, Award } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'

type SortOption = 'trending' | 'hot' | 'popular'

interface SortBarProps {
  current: SortOption
  onChange: (sort: SortOption) => void
}

export function SortBar({ current, onChange }: SortBarProps) {
  const { t } = useLanguage()
  const options: { value: SortOption; label: string; icon: typeof TrendingUp }[] = [
    { value: 'trending', label: t('sort.trending'), icon: TrendingUp },
    { value: 'hot', label: t('sort.hot'), icon: Flame },
    { value: 'popular', label: t('sort.popular'), icon: Award },
  ]
  return (
    <div className="inline-flex gap-2 p-1 bg-secondary/50 rounded-xl">
      {options.map(({ value, label, icon: Icon }) => (
        <motion.button
          key={value}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(value)}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            current === value
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </motion.button>
      ))}
    </div>
  )
}
