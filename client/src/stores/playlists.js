import { ref } from 'vue'
import { defineStore } from 'pinia'
import { arrayPersist } from '../lib/persist.js'

export const usePlaylistsStore = defineStore(
  'playlists',
  () => {
    const playlists = ref([])

    function createPlaylist(name) {
      const playlist = {
        id: Date.now().toString(),
        name,
        songs: [],
        createdAt: Date.now(),
      }
      playlists.value.push(playlist)
      return playlist
    }

    function deletePlaylist(id) {
      playlists.value = playlists.value.filter((p) => p.id !== id)
    }

    function renamePlaylist(id, name) {
      const playlist = playlists.value.find((p) => p.id === id)
      if (playlist) {
        playlist.name = name
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
      }
    }

    function removeFromPlaylist(playlistId, bvid) {
      const playlist = playlists.value.find((p) => p.id === playlistId)
      if (playlist) {
        playlist.songs = playlist.songs.filter((s) => s.bvid !== bvid)
      }
    }

    function renamePlaylistSong(playlistId, bvid, newTitle) {
      const playlist = playlists.value.find((p) => p.id === playlistId)
      if (playlist) {
        const song = playlist.songs.find((s) => s.bvid === bvid)
        if (song) {
          song.title = newTitle
        }
      }
    }

    // 在所有歌单中同步重命名同一首歌
    function renameSongInAllPlaylists(bvid, newTitle) {
      for (const playlist of playlists.value) {
        const song = playlist.songs.find((s) => s.bvid === bvid)
        if (song) {
          song.title = newTitle
        }
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
      renamePlaylistSong,
      renameSongInAllPlaylists,
      getPlaylist,
      isInPlaylist,
    }
  },
  { persist: arrayPersist('bilimusic-playlists', 'playlists') }
)
