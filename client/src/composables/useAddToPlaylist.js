import { usePlaylistsStore } from '../stores/playlists'
import { useToast } from './useToast'

// "添加到歌单"的公共逻辑：去重判断 + 写入 + toast。
// 供 AddToPlaylistMenu（下拉）和 AddToPlaylistModal（弹窗）共用。
// 返回 addToPlaylist(playlist, song)：成功添加返回 true，已在歌单中返回 false。
export function useAddToPlaylist() {
  const playlists = usePlaylistsStore()
  const { showToast } = useToast()

  function addToPlaylist(playlist, song) {
    if (!song) return false
    if (playlists.isInPlaylist(playlist.id, song.bvid)) {
      showToast(`这首歌已在「${playlist.name}」中`, 'info')
      return false
    }
    playlists.addToPlaylist(playlist.id, song)
    showToast(`已添加到「${playlist.name}」`, 'success')
    return true
  }

  return { addToPlaylist }
}
