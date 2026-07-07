import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'bilimusic-playlists'

export const usePlaylistsStore = defineStore('playlists', () => {
  const playlists = ref(loadFromStorage())

  function loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists.value))
  }

  function createPlaylist(name) {
    const playlist = {
      id: Date.now().toString(),
      name,
      songs: [],
      createdAt: Date.now(),
    }
    playlists.value.push(playlist)
    saveToStorage()
    return playlist
  }

  function deletePlaylist(id) {
    playlists.value = playlists.value.filter((p) => p.id !== id)
    saveToStorage()
  }

  function renamePlaylist(id, name) {
    const playlist = playlists.value.find((p) => p.id === id)
    if (playlist) {
      playlist.name = name
      saveToStorage()
    }
  }

  function addToPlaylist(playlistId, song) {
    const playlist = playlists.value.find((p) => p.id === playlistId)
    if (playlist && !playlist.songs.some((s) => s.bvid === song.bvid)) {
      playlist.songs.push({
        bvid: song.bvid,
        title: song.title,
        author: song.author,
        cover: song.cover,
        duration: song.duration,
      })
      saveToStorage()
    }
  }

  function removeFromPlaylist(playlistId, bvid) {
    const playlist = playlists.value.find((p) => p.id === playlistId)
    if (playlist) {
      playlist.songs = playlist.songs.filter((s) => s.bvid !== bvid)
      saveToStorage()
    }
  }

  function getPlaylist(id) {
    return playlists.value.find((p) => p.id === id)
  }

  function isInPlaylist(playlistId, bvid) {
    const playlist = playlists.value.find((p) => p.id === playlistId)
    return playlist ? playlist.songs.some((s) => s.bvid === bvid) : false
  }

  return {
    playlists,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    getPlaylist,
    isInPlaylist,
  }
})
