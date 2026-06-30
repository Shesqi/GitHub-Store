import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { ru, en, type Language, type Translations } from './translations'

const STORAGE_KEY = 'gh-store-lang'

const translations: Record<Language, Translations> = { ru, en }

type LangContext = {
  lang: Language
  t: (key: string, vars?: Record<string, string | number>) => string
  setLang: (l: Language) => void
}

const Ctx = createContext<LangContext>(null!)

function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
    return undefined
  }, obj)
}

function detectLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null
    if (saved && (saved === 'ru' || saved === 'en')) return saved
  } catch {}
  const locale = navigator.language
  return locale.startsWith('ru') ? 'ru' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLang)

  const setLang = useCallback((l: Language) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
  }, [])

  const t: LangContext['t'] = useCallback((path, vars) => {
    const dict = translations[lang]
    let val: string | undefined

    // If count var exists, try plural form first
    if (vars && 'count' in vars) {
      const count = Number(vars.count)
      const suffix = lang === 'ru' ? ruPlural(count) : enPlural(count)
      val = resolve(dict as unknown as Record<string, unknown>, path + '_' + suffix) as string | undefined
      if (!val) {
        val = resolve(translations.en as unknown as Record<string, unknown>, path + '_' + suffix) as string | undefined
      }
    }

    // Fall back to exact key
    if (!val) {
      val = resolve(dict as unknown as Record<string, unknown>, path) as string | undefined
      if (!val) {
        val = resolve(translations.en as unknown as Record<string, unknown>, path) as string | undefined
      }
    }

    if (!val) return path
    if (vars) {
      return val.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`))
    }
    return val
  }, [lang])

function ruPlural(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'one'
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'few'
  return 'many'
}

function enPlural(n: number): string {
  if (n === 1) return 'one'
  return 'many'
}

  return (
    <Ctx.Provider value={{ lang, t, setLang }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLanguage() {
  return useContext(Ctx)
}
