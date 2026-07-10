import { defineStore } from 'pinia'

export const useSearchStore = defineStore('search', {
  state: () => ({
    keyword: '',
    results: [],
    page: 1,
    totalPages: 1,
    total: 0,
    order: '',
    searched: false,
  }),
  actions: {
    setState(payload) {
      this.keyword = payload.keyword
      this.results = payload.results
      this.page = payload.page
      this.totalPages = payload.totalPages
      this.total = payload.total
      this.order = payload.order
      this.searched = true
    },
    reset() {
      this.keyword = ''
      this.results = []
      this.page = 1
      this.totalPages = 1
      this.total = 0
      this.order = ''
      this.searched = false
    },
  },
})
