import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useFavoritesStore } from '../stores/favorites'
import { usePlaylistsStore } from '../stores/playlists'
import { useToast } from './useToast'

// 歌曲右键菜单的公共逻辑：菜单状态、菜单项构建、action 分发。
// play / remove 因视图而异，由调用方通过 onPlay / onRemove 传入；
// 其余 action（add-to-next / add-to-playlist / toggle-fav / rename）在此统一处理。
// rename 会跨 store 同步（收藏 + 所有歌单 + 播放队列）。
export function useSongContextMenu({ onPlay, onRemove, removeLabel, canRename = false } = {}) {
  const player = usePlayerStore()
  const favorites = useFavoritesStore()
  const playlists = usePlaylistsStore()
  const { showToast } = useToast()

  const ctxMenu = ref({ show: false, x: 0, y: 0, song: null })
  const ctxItems = ref([])

  // 添加到歌单弹窗
  const showAddModal = ref(false)
  const selectedSong = ref(null)

  // 重命名弹窗
  const showRenameDialog = ref(false)
  const renameTarget = ref(null)

  function addToNext(song) {
    if (player.insertNext(song)) {
      showToast(`已添加到下一首：${song.title}`, 'success')
    } else {
      showToast('该歌曲已在播放列表中', 'info')
    }
  }

  function addToPlaylist(song) {
    selectedSong.value = song
    showAddModal.value = true
  }

  function openContextMenu({ song, event }) {
    const isFav = favorites.isFavorite(song.bvid)
    const items = [
      { icon: '▶', label: '播放', action: 'play' },
      { divider: true },
      { icon: '⤵', label: '添加到下一首', action: 'add-to-next' },
      { icon: '♪', label: '添加到歌单', action: 'add-to-playlist' },
      { icon: '♥', label: isFav ? '取消收藏' : '收藏', action: 'toggle-fav', active: isFav, danger: isFav },
    ]
    if (canRename) {
      items.push({ divider: true })
      items.push({ icon: '✎', label: '重命名', action: 'rename' })
    }
    if (onRemove) {
      items.push({ icon: '✕', label: removeLabel, action: 'remove', danger: true })
    }
    ctxItems.value = items
    ctxMenu.value = { show: true, x: event.clientX, y: event.clientY, song }
  }

  function handleCtxAction(action) {
    const song = ctxMenu.value.song
    if (!song) return
    switch (action) {
      case 'play':
        onPlay?.(song)
        break
      case 'add-to-next':
        addToNext(song)
        break
      case 'add-to-playlist':
        addToPlaylist(song)
        break
      case 'toggle-fav':
        favorites.toggle(song)
        showToast(favorites.isFavorite(song.bvid) ? '已收藏' : '已取消收藏', 'success')
        break
      case 'rename':
        renameTarget.value = song
        showRenameDialog.value = true
        break
      case 'remove':
        onRemove?.(song)
        break
    }
  }

  // 跨 store 同步重命名：收藏 + 所有歌单 + 播放队列
  function handleRename(newTitle) {
    if (renameTarget.value) {
      const bvid = renameTarget.value.bvid
      favorites.rename(bvid, newTitle)
      playlists.renameSongInAllPlaylists(bvid, newTitle)
      player.renameQueueSong(bvid, newTitle)
      showToast('已重命名', 'success')
    }
    showRenameDialog.value = false
  }

  return {
    ctxMenu,
    ctxItems,
    openContextMenu,
    handleCtxAction,
    addToNext,
    addToPlaylist,
    showAddModal,
    selectedSong,
    showRenameDialog,
    renameTarget,
    handleRename,
  }
}
