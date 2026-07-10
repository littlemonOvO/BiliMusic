import { defineStore } from 'pinia'

const STORAGE_KEY = 'bilimusic-theme'

function detectInitial() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // 无记录时默认深色（与原设计一致）
  return 'dark'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: detectInitial(),
  }),
  actions: {
    init() {
      this.apply()
    },
    apply() {
      const el = document.documentElement
      if (this.mode === 'light') el.setAttribute('data-theme', 'light')
      else el.removeAttribute('data-theme')
    },
    toggle() {
      this.mode = this.mode === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, this.mode)
      this.apply()
    },
  },
})