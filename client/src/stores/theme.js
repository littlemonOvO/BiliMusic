import { defineStore } from 'pinia'

const STORAGE_KEY = 'bilimusic-theme'

// 以裸字符串（'dark'/'light'）存储，与旧版手写 localStorage 格式一致。
// 旧版未存或值非法时回退到默认深色。
const themePersist = {
  key: STORAGE_KEY,
  serializer: {
    serialize: (state) => state.mode ?? 'dark',
    deserialize: (raw) => (raw === 'light' || raw === 'dark' ? { mode: raw } : {}),
  },
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'dark',
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
      this.apply()
    },
  },
  persist: themePersist,
})
