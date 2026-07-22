import { ref } from 'vue'
import { defineStore } from 'pinia'
import { arrayPersist } from '../lib/persist.js'

export const useFavoritesStore = defineStore(
  'favorites',
  () => {
    const items = ref([])

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
    }

    function remove(bvid) {
      items.value = items.value.filter((item) => item.bvid !== bvid)
    }

    function rename(bvid, newTitle) {
      const item = items.value.find((item) => item.bvid === bvid)
      if (item) {
        item.title = newTitle
      }
    }

    return {
      items,
      isFavorite,
      toggle,
      remove,
      rename,
    }
  },
  { persist: arrayPersist('bilimusic-favorites', 'items') }
)
