import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'bilimusic-favorites'

export const useFavoritesStore = defineStore('favorites', () => {
  const items = ref(loadFromStorage())

  function loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  }

  function isFavorite(bvid) {
    return items.value.some((item) => item.bvid === bvid)
  }

  function toggle(song) {
    const index = items.value.findIndex((item) => item.bvid === song.bvid)
    if (index >= 0) {
      items.value.splice(index, 1)
    } else {
      items.value.unshift({
        bvid: song.bvid,
        title: song.title,
        author: song.author,
        cover: song.cover,
        duration: song.duration,
      })
    }
    saveToStorage()
  }

  function remove(bvid) {
    items.value = items.value.filter((item) => item.bvid !== bvid)
    saveToStorage()
  }

  function rename(bvid, newTitle) {
    const item = items.value.find((item) => item.bvid === bvid)
    if (item) {
      item.title = newTitle
      saveToStorage()
    }
  }

  return {
    items,
    isFavorite,
    toggle,
    remove,
    rename,
  }
})
