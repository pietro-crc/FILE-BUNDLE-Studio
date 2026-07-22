import { useEffect, useState } from 'react'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: MonitorIcon },
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
] as const

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemePreference>('system')

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = theme
    }

    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  return (
    <div className="theme-switcher" aria-label="Interface theme" role="group">
      {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          aria-label={`Use ${label.toLowerCase()} theme`}
          aria-pressed={theme === id}
          className="theme-switcher__button"
          key={id}
          onClick={() => setTheme(id)}
          title={`${label} theme`}
          type="button"
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
