import { motion } from 'framer-motion'
import { getCategoryIcon } from '@/lib/utils'
import { useLanguage } from '@/i18n/LanguageContext'

const categories = [
  'all', 'media', 'privacy', 'network', 'developer', 'system',
  'security', 'productivity', 'games', 'graphics', 'audio',
  'utility', 'communication', 'education', 'finance', 'health',
]

interface TagFilterProps {
  selected: string
  onSelect: (category: string) => void
}

export function TagFilter({ selected, onSelect }: TagFilterProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <motion.button
          key={cat}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(cat)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            selected === cat
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent hover:border-primary/30'
          }`}
        >
          {cat !== 'all' && <span>{getCategoryIcon(cat)}</span>}
          {cat === 'all' ? t('filter.all') : t('filter.' + cat)}
        </motion.button>
      ))}
    </div>
  )
}
