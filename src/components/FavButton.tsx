import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n/LanguageContext'

const isElectron = typeof window !== 'undefined' && window.electronAPI

interface FavButtonProps {
  repoFullName: string
  size?: 'sm' | 'md'
  className?: string
}

export function FavButton({ repoFullName, size = 'md', className }: FavButtonProps) {
  const { t } = useLanguage()
  const [isFav, setIsFav] = useState(false)

  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.isFavorite(repoFullName).then(setIsFav)
    }
  }, [repoFullName])

  async function toggle() {
    if (!isElectron) return
    if (isFav) {
      await window.electronAPI!.removeFavorite(repoFullName)
      setIsFav(false)
    } else {
      await window.electronAPI!.addFavorite(repoFullName)
      setIsFav(true)
    }
    window.dispatchEvent(new CustomEvent('favorites-changed'))
  }

  if (!isElectron) return null

  return (
    <motion.button
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => { e.stopPropagation(); toggle() }}
      className={cn(
        'transition-colors',
        size === 'sm' ? 'p-1' : 'p-1.5',
        isFav ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground hover:text-red-400',
        className
      )}
      title={isFav ? t('favButton.remove') : t('favButton.add')}
    >
      <Heart className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} fill={isFav ? 'currentColor' : 'none'} />
    </motion.button>
  )
}
