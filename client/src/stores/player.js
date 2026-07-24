import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getAudioUrl, getAudioStreamUrl } from '../api'

export const usePlayerStore = defineStore('player', () => {
  const currentSong = ref(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.4)
  const playQueue = ref([])
  const currentIndex = ref(-1)
  const isLoading = ref(false)
  const error = ref(null)
  const playMode = ref('list') // 'list' | 'single' | 'shuffle'
  const prevVolume = ref(0.4)
  let playReqId = 0

  const progress = computed(() => {
    if (!duration.value) return 0
    return (currentTime.value / duration.value) * 100
  })

  // 播放一首歌
  async function play(song) {
    const reqId = ++playReqId
    currentSong.value = song
    currentTime.value = 0
    duration.value = 0
    isLoading.value = true
    error.value = null
    isPlaying.value = false

    try {
      const res = await getAudioUrl(song.bvid)
      // 竞态保护：若期间又发起了新的 play()，丢弃本次结果
      if (reqId !== playReqId) return

      if (res.data.success) {
        const { audioUrl, title, cover } = res.data.data
        currentSong.value = {
          ...song,
          title: song.title || title,
          cover: cover || song.cover,
          audioStreamUrl: getAudioStreamUrl(audioUrl, song.title, song.bvid),
        }
        isPlaying.value = true
      } else {
        error.value = res.data.message || '获取音频失败'
      }
    } catch (err) {
      if (reqId !== playReqId) return
      error.value = err.response?.data?.message || '播放失败，请重试'
    } finally {
      if (reqId === playReqId) {
        isLoading.value = false
      }
    }
  }

  function togglePlay() {
    if (!currentSong.value) return
    isPlaying.value = !isPlaying.value
  }

  function seek(time) {
    currentTime.value = time
  }

  function setVolume(vol) {
    volume.value = vol
  }

  // 切换播放模式
  function togglePlayMode() {
    const modes = ['list', 'single', 'shuffle']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  // 播放列表（深拷贝，避免与源数组共享引用；去重，保留首次出现）
  function setQueue(songs, index = 0) {
    const seen = new Set()
    const unique = []
    for (const s of songs) {
      if (!seen.has(s.bvid)) {
        seen.add(s.bvid)
        unique.push(s)
      }
    }
    // 根据原 index 对应的 bvid 重新定位（去重后位置可能变化）
    const targetBvid = songs[index]?.bvid
    const newIndex = targetBvid
      ? Math.max(0, unique.findIndex((s) => s.bvid === targetBvid))
      : 0
    playQueue.value = unique.map((s) => ({ ...s }))
    currentIndex.value = newIndex
    if (unique[newIndex]) {
      play(unique[newIndex])
    }
  }

  // 播放整个歌单：替换当前播放队列并从第一首开始播放
  function playPlaylist(songs) {
    if (!songs || songs.length === 0) return
    setQueue(songs, 0)
  }

  // 加入播放列表：将歌曲追加到现有队列末尾（不影响当前播放；去重）
  // 返回实际添加的歌曲数量
  function addToQueue(songs) {
    if (!songs || songs.length === 0) return 0
    const existingBvids = new Set(playQueue.value.map((s) => s.bvid))
    const appended = []
    for (const s of songs) {
      if (!existingBvids.has(s.bvid)) {
        existingBvids.add(s.bvid)
        appended.push({ ...s })
      }
    }
    if (appended.length === 0) return 0
    if (playQueue.value.length === 0) {
      // 队列为空时直接作为新队列并播放第一首
      playQueue.value = appended
      currentIndex.value = 0
      play(appended[0])
    } else {
      playQueue.value.push(...appended)
    }
    return appended.length
  }

  // 从队列中播放指定索引
  function playIndex(index) {
    if (index >= 0 && index < playQueue.value.length) {
      currentIndex.value = index
      play(playQueue.value[index])
    }
  }

  // 只播放一首歌（替换整个队列）
  function playSingle(song) {
    playQueue.value = [{ ...song }]
    currentIndex.value = 0
    play(song)
  }

  // 插入到当前播放的下一首位置（去重；返回 true=已添加，false=已存在）
  function insertNext(song) {
    if (playQueue.value.some((s) => s.bvid === song.bvid)) {
      return false
    }
    const newSong = { ...song }
    if (playQueue.value.length === 0) {
      // 队列为空，直接作为新队列并播放
      playQueue.value = [newSong]
      currentIndex.value = 0
      play(newSong)
    } else {
      // 插入到当前播放的下一首位置
      const insertIndex = Math.max(0, currentIndex.value + 1)
      playQueue.value.splice(insertIndex, 0, newSong)
    }
    return true
  }

  // 切换静音
  function toggleMute() {
    if (volume.value > 0) {
      prevVolume.value = volume.value
      volume.value = 0
    } else {
      volume.value = prevVolume.value || 0.4
    }
  }

  // 随机播放下一首
  function playNext() {
    if (playQueue.value.length === 0) return

    if (playMode.value === 'single') {
      play(playQueue.value[currentIndex.value])
      return
    }

    if (playMode.value === 'shuffle' && playQueue.value.length > 1) {
      let randomIndex
      do {
        randomIndex = Math.floor(Math.random() * playQueue.value.length)
      } while (randomIndex === currentIndex.value)
      currentIndex.value = randomIndex
      play(playQueue.value[randomIndex])
    } else {
      if (currentIndex.value < playQueue.value.length - 1) {
        currentIndex.value++
        play(playQueue.value[currentIndex.value])
      } else {
        // 列表循环：回到第一首
        currentIndex.value = 0
        play(playQueue.value[0])
      }
    }
  }

  function playPrev() {
    if (playQueue.value.length === 0) return

    if (playMode.value === 'single') {
      play(playQueue.value[currentIndex.value])
      return
    }

    if (playMode.value === 'shuffle' && playQueue.value.length > 1) {
      let randomIndex
      do {
        randomIndex = Math.floor(Math.random() * playQueue.value.length)
      } while (randomIndex === currentIndex.value)
      currentIndex.value = randomIndex
      play(playQueue.value[randomIndex])
    } else {
      if (currentIndex.value > 0) {
        currentIndex.value--
        play(playQueue.value[currentIndex.value])
      } else {
        currentIndex.value = playQueue.value.length - 1
        play(playQueue.value[currentIndex.value])
      }
    }
  }

  // 一键清空播放队列（保留 currentSong，等面板关闭后再清理）
  function clearQueue() {
    playQueue.value = []
    currentIndex.value = -1
    isPlaying.value = false
    // 不清除 currentSong，让播放栏暂时保留
  }

  // 队列面板关闭时调用，若队列已空则真正清除当前歌曲
  function flushEmpty() {
    if (playQueue.value.length === 0) {
      currentSong.value = null
      currentTime.value = 0
      duration.value = 0
    }
  }

  // 从队列中移除歌曲
  function removeFromQueue(bvid) {
    const removeIndex = playQueue.value.findIndex((s) => s.bvid === bvid)
    if (removeIndex === -1) return

    const isCurrent = removeIndex === currentIndex.value
    const wasBefore = removeIndex < currentIndex.value

    playQueue.value.splice(removeIndex, 1)

    // 调整 currentIndex
    if (wasBefore) {
      currentIndex.value--
    } else if (isCurrent) {
      // 删除的是当前播放歌曲
      if (playQueue.value.length === 0) {
        // 队列空了，停止播放但保留 currentSong（等面板关闭时再清除）
        isPlaying.value = false
        currentIndex.value = -1
      } else {
        // 播放下一首（取同一位置，已自动后移）
        const nextIndex = Math.min(removeIndex, playQueue.value.length - 1)
        currentIndex.value = nextIndex
        play(playQueue.value[nextIndex])
      }
    }
  }

  // 重命名队列中歌曲的标题
  function renameQueueSong(bvid, newTitle) {
    const song = playQueue.value.find((s) => s.bvid === bvid)
    if (song) {
      song.title = newTitle
    }
    if (currentSong.value?.bvid === bvid) {
      currentSong.value = { ...currentSong.value, title: newTitle }
    }
  }

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playQueue,
    currentIndex,
    isLoading,
    error,
    playMode,
    progress,
    play,
    togglePlay,
    seek,
    setVolume,
    setQueue,
    playPlaylist,
    addToQueue,
    playNext,
    playPrev,
    playIndex,
    playSingle,
    insertNext,
    removeFromQueue,
    renameQueueSong,
    clearQueue,
    flushEmpty,
    toggleMute,
    togglePlayMode,
  }
})
