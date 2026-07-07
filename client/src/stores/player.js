import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getAudioUrl, getAudioStreamUrl } from '../api'

export const usePlayerStore = defineStore('player', () => {
  const currentSong = ref(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.8)
  const playQueue = ref([])
  const currentIndex = ref(-1)
  const isLoading = ref(false)
  const error = ref(null)

  const progress = computed(() => {
    if (!duration.value) return 0
    return (currentTime.value / duration.value) * 100
  })

  // 播放一首歌
  async function play(song) {
    currentSong.value = song
    isLoading.value = true
    error.value = null
    isPlaying.value = false

    try {
      const res = await getAudioUrl(song.bvid)
      if (res.data.success) {
        const { audioUrl, title, cover } = res.data.data
        currentSong.value = {
          ...song,
          title: title || song.title,
          cover: cover || song.cover,
          audioStreamUrl: getAudioStreamUrl(audioUrl),
        }
        isPlaying.value = true
      } else {
        error.value = res.data.message || '获取音频失败'
      }
    } catch (err) {
      error.value = err.response?.data?.message || '播放失败，请重试'
    } finally {
      isLoading.value = false
    }
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function stop() {
    isPlaying.value = false
    currentTime.value = 0
  }

  function seek(time) {
    currentTime.value = time
  }

  function setVolume(vol) {
    volume.value = vol
  }

  // 播放列表
  function setQueue(songs, index = 0) {
    playQueue.value = songs
    currentIndex.value = index
    if (songs[index]) {
      play(songs[index])
    }
  }

  function playNext() {
    if (currentIndex.value < playQueue.value.length - 1) {
      currentIndex.value++
      play(playQueue.value[currentIndex.value])
    }
  }

  function playPrev() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      play(playQueue.value[currentIndex.value])
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
    progress,
    play,
    togglePlay,
    stop,
    seek,
    setVolume,
    setQueue,
    playNext,
    playPrev,
  }
})
