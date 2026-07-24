import { ref, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useToast } from './useToast'

// 音频元素的公共控制：播放/暂停/切歌驱动、音量同步、
// 加载失败重试（MAX_AUDIO_RETRY 次）、缓冲 waiting 超时（WAITING_TIMEOUT）。
// 返回 audioRef（模板绑到 <audio ref>）+ 各事件处理器 + handleSeek。
// 调用方负责把返回的处理器绑到 <audio> 的事件上。
export function useAudio() {
  const player = usePlayerStore()
  const { showToast } = useToast()

  const audioRef = ref(null)
  const audioRetryCount = ref(0)
  const MAX_AUDIO_RETRY = 2

  let waitingTimer = null
  const WAITING_TIMEOUT = 15000

  // 音频加载失败时自动重试（流失效等情况），带次数限制
  async function handleAudioError() {
    if (!player.currentSong) return
    if (audioRetryCount.value >= MAX_AUDIO_RETRY) {
      showToast('音频流失效，请切换其他歌曲', 'error')
      audioRetryCount.value = 0
      player.isPlaying = false
      return
    }
    audioRetryCount.value++
    showToast('音频加载失败，正在重试...', 'info')
    await player.play(player.currentSong)
  }

  watch(
    () => player.isPlaying,
    async (playing) => {
      await nextTick()
      const audio = audioRef.value
      if (!audio) return
      if (playing) {
        try {
          await audio.play()
        } catch (err) {
          if (err.name === 'AbortError') return
          if (player.currentSong) {
            await player.play(player.currentSong)
          } else {
            player.isPlaying = false
          }
        }
      } else {
        audio.pause()
      }
    }
  )

  watch(
    () => player.currentSong?.audioStreamUrl,
    async (url) => {
      if (waitingTimer) {
        clearTimeout(waitingTimer)
        waitingTimer = null
      }
      if (!url) return
      player.isPlaying = true
      await nextTick()
      const audio = audioRef.value
      if (audio) {
        audio.volume = player.volume
        try {
          await audio.play()
        } catch (err) {
          if (err.name === 'AbortError') return
          if (player.currentSong) {
            await player.play(player.currentSong)
          }
        }
      }
    }
  )

  watch(
    () => player.volume,
    (vol) => {
      const audio = audioRef.value
      if (audio) audio.volume = vol
    }
  )

  function handleSeek(event) {
    const audio = audioRef.value
    const time = Number(event.target.value)
    if (audio) {
      audio.currentTime = time
    }
    player.seek(time)
  }

  // ===== audio 事件处理 =====
  function onAudioPlay() {
    player.isPlaying = true
  }

  function onAudioPause() {
    if (waitingTimer) {
      clearTimeout(waitingTimer)
      waitingTimer = null
    }
    player.isPlaying = false
  }

  function onAudioPlaying() {
    if (waitingTimer) {
      clearTimeout(waitingTimer)
      waitingTimer = null
    }
    audioRetryCount.value = 0
  }

  function onAudioEnded() {
    player.playNext()
  }


  function onAudioWaiting() {
    if (waitingTimer) clearTimeout(waitingTimer)
    waitingTimer = setTimeout(async () => {
      const audio = audioRef.value
      if (!audio || audio.readyState >= 3) return
      if (!player.currentSong) return
      if (audioRetryCount.value >= MAX_AUDIO_RETRY) {
        showToast('音频缓冲超时，请切换其他歌曲', 'error')
        audioRetryCount.value = 0
        player.isPlaying = false
        return
      }
      audioRetryCount.value++
      showToast('音频缓冲超时，正在重试...', 'info')
      await player.play(player.currentSong)
    }, WAITING_TIMEOUT)
  }


  function onAudioTimeUpdate(event) {
    player.currentTime = event.target.currentTime
  }

  function onAudioLoadedMetadata(event) {
    player.duration = event.target.duration
  }

  return {
    audioRef,
    handleAudioError,
    handleSeek,
    onAudioPlay,
    onAudioPause,
    onAudioPlaying,
    onAudioEnded,
    onAudioWaiting,
    onAudioTimeUpdate,
    onAudioLoadedMetadata,
  }
}
