import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'

interface SearchInPageProps {
  containerRef: React.RefObject<HTMLElement | null>
}

export function SearchInPage({ containerRef }: SearchInPageProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<number[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLElement[]>([])

  const clearHighlights = useCallback(() => {
    marksRef.current.forEach(m => {
      const parent = m.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m)
        parent.normalize()
      }
    })
    marksRef.current = []
  }, [])

  const doSearch = useCallback((q: string) => {
    clearHighlights()
    if (!q || !containerRef.current) {
      setMatches([])
      setActiveIdx(0)
      return
    }

    const container = containerRef.current
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const positions: number[] = []
    const textNodes: Text[] = []

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        return node.parentElement?.closest('.search-in-page-ignore')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      },
    })

    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.match(regex)) {
        textNodes.push(node)
      }
    }

    marksRef.current = []

    for (const textNode of textNodes) {
      const text = textNode.textContent || ''
      const parent = textNode.parentNode
      if (!parent) continue

      const fragment = document.createDocumentFragment()
      let lastIdx = 0

      const parts = text.matchAll(regex)
      for (const part of parts) {
        const idx = part.index!
        if (idx > lastIdx) {
          fragment.appendChild(document.createTextNode(text.slice(lastIdx, idx)))
        }
        const mark = document.createElement('mark')
        mark.className = 'search-in-page-highlight rounded-sm px-0.5'
        mark.textContent = part[0]
        fragment.appendChild(mark)
        marksRef.current.push(mark)
        positions.push(positions.length)
        lastIdx = idx + part[0].length
      }

      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIdx)))
      }

      parent.replaceChild(fragment, textNode)
    }

    setMatches(positions)
    setActiveIdx(0)
    scrollToMatch(0)
  }, [containerRef, clearHighlights])

  const scrollToMatch = useCallback((idx: number) => {
    const mark = marksRef.current[idx]
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      marksRef.current.forEach((m, i) => {
        m.style.background = i === idx ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary) / 0.25)'
        m.style.color = i === idx ? '#fff' : 'inherit'
        m.style.borderRadius = '4px'
      })
    }
  }, [])

  useEffect(() => {
    doSearch(query)
  }, [query, doSearch])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
        return
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
        setQuery('')
        clearHighlights()
        return
      }
      if (open && e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          setActiveIdx(prev => {
            const next = prev <= 0 ? matches.length - 1 : prev - 1
            scrollToMatch(next)
            return next
          })
        } else {
          setActiveIdx(prev => {
            const next = prev >= matches.length - 1 ? 0 : prev + 1
            scrollToMatch(next)
            return next
          })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, matches.length, clearHighlights, scrollToMatch])

  useEffect(() => {
    if (!open && query) {
      setQuery('')
      clearHighlights()
    }
  }, [open, query, clearHighlights])

  if (!open) return null

  return (
    <div className="fixed top-12 right-4 z-50 flex items-center gap-2 glass rounded-xl p-2 shadow-2xl border-border/50 search-in-page-ignore">
      <Search className="w-4 h-4 text-muted-foreground ml-1" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        className="bg-transparent border-none outline-none text-sm text-foreground w-48 placeholder:text-muted-foreground/50"
        autoFocus
      />
      {query && (
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {matches.length > 0 ? `${activeIdx + 1}/${matches.length}` : '0/0'}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => {
            setActiveIdx(prev => {
              const next = prev <= 0 ? matches.length - 1 : prev - 1
              scrollToMatch(next)
              return next
            })
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          disabled={matches.length === 0}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setActiveIdx(prev => {
              const next = prev >= matches.length - 1 ? 0 : prev + 1
              scrollToMatch(next)
              return next
            })
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          disabled={matches.length === 0}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={() => {
          setOpen(false)
          setQuery('')
          clearHighlights()
        }}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
