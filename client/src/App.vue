<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from './stores/player'
import { useFavoritesStore } from './stores/favorites'
import { usePlaylistsStore } from './stores/playlists'
import { useThemeStore } from './stores/theme'
import { useToast } from './composables/useToast'
import { getImageUrl } from './api'
import QueuePanel from './components/QueuePanel.vue'

const player = usePlayerStore()
const favorites = useFavoritesStore()
const playlists = usePlaylistsStore()
const theme = useThemeStore()
const { toasts, removeToast, showToast } = useToast()
const audioRef = ref(null)
const showQueuePanel = ref(false)
const showPlaylistMenu = ref(false)
const playlistMenuPos = ref({ x: 0, y: 0 })
const audioRetryCount = ref(0)
const MAX_AUDIO_RETRY = 2

onMounted(() => {
  theme.init()

  // 快捷键：空格暂停/播放，M 静音/解除
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  // 输入框聚焦时不触发
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault()
    if (player.currentSong) {
      player.togglePlay()
    }
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    player.toggleMute()
    showToast(player.volume === 0 ? '已静音' : '已解除静音', 'info')
  }
}

function closeQueuePanel() {
  showQueuePanel.value = false
  showPlaylistMenu.value = false
  player.flushEmpty()
}

function togglePlaylistMenu(event) {
  if (showPlaylistMenu.value) {
    showPlaylistMenu.value = false
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  playlistMenuPos.value = {
    x: rect.left,
    y: rect.top - 8,
  }
  showPlaylistMenu.value = true
}

function closePlaylistMenu() {
  showPlaylistMenu.value = false
}

function handleAddToPlaylist(playlist) {
  if (!player.currentSong) return
  if (playlists.isInPlaylist(playlist.id, player.currentSong.bvid)) {
    showToast(`这首歌已在「${playlist.name}」中`, 'info')
    closePlaylistMenu()
    return
  }
  playlists.addToPlaylist(playlist.id, player.currentSong)
  showToast(`已添加到「${playlist.name}」`, 'success')
  closePlaylistMenu()
}

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

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// 滑块填充百分比 —— 用于 CSS 变量渲染已播放段
const progressPct = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100))
})
const volumePct = computed(() => Math.min(100, Math.max(0, player.volume * 100)))

const bars = Array.from({ length: 32 }, (_, i) => i)

// ===== audio 事件处理 =====
let waitingTimer = null
const WAITING_TIMEOUT = 15000

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

function onAudioStalled(e) {}

function onAudioWaiting(e) {
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

function onAudioSuspend(e) {}
function onAudioAbort() {}
function onAudioEmptied() {}
function onAudioCanPlay(e) {}
</script>

<template>
  <div class="app-layout" @click="showPlaylistMenu = false">
    <header class="topbar">
      <div class="topbar__brand" @click="$router.push('/')">
        <span class="topbar__brand-mark">◈</span>
        <span class="topbar__brand-text">BILI<span class="topbar__brand-accent">MUSIC</span></span>
      </div>
      <div class="topbar__tagline">NEON · SOUNDFLOW</div>
      <nav class="topbar__nav">
        <router-link to="/" class="topbar__link">SEARCH</router-link>
        <router-link to="/favorites" class="topbar__link">FAVORITES</router-link>
        <router-link to="/playlists" class="topbar__link">PLAYLISTS</router-link>
      </nav>
      <button
        class="topbar__theme-toggle"
        @click="theme.toggle()"
        :title="theme.mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        :aria-label="theme.mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
      >
        <span class="topbar__theme-track" :class="{ 'topbar__theme-track--light': theme.mode === 'light' }">
          <span class="topbar__theme-thumb"></span>
        </span>
      </button>
    </header>

    <div class="app-body">
      <nav class="sidebar">
        <router-link to="/" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__glyph">⌕</span>
          <span class="sidebar__label">搜索</span>
          <span class="sidebar__index">01</span>
        </router-link>
        <router-link to="/player" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__glyph">♪</span>
          <span class="sidebar__label">播放器</span>
          <span class="sidebar__index">02</span>
        </router-link>
        <router-link to="/favorites" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__glyph">♥</span>
          <span class="sidebar__label">收藏</span>
          <span class="sidebar__index">03</span>
        </router-link>
        <router-link to="/playlists" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__glyph">☰</span>
          <span class="sidebar__label">歌单</span>
          <span class="sidebar__index">04</span>
        </router-link>

        <div class="sidebar__footer">
          <div class="sidebar__status">
            <span class="sidebar__status-dot" :class="{ playing: player.isPlaying }"></span>
            <span class="sidebar__status-text">
              {{ player.isPlaying ? 'STREAMING' : 'STANDBY' }}
            </span>
          </div>
        </div>
      </nav>

      <main class="main-content scrollable">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <footer class="player-bar" :class="{ 'player-bar--hidden': !player.currentSong }">
      <!-- 顶部进度光带：贯穿播放栏上沿，作为信号流动指示 -->
      <div class="player-bar__topline">
        <div
          class="player-bar__topline-fill"
          :style="{ width: (player.duration ? (player.currentTime / player.duration * 100) : 0) + '%' }"
        ></div>
      </div>

      <div class="player-bar__inner">
        <!-- 区域 A · 当前播放卡片 -->
        <div class="player-bar__zone player-bar__zone--now">
          <div class="player-bar__cover-wrap">
            <img
              v-if="player.currentSong"
              :src="getImageUrl(player.currentSong.cover)"
              class="player-bar__cover"
              alt="cover"
            />
            <span v-else class="player-bar__cover player-bar__cover--idle">◌</span>
            <div v-if="player.isPlaying" class="player-bar__cover-glow"></div>
            <span class="player-bar__cover-corner player-bar__cover-corner--tl"></span>
            <span class="player-bar__cover-corner player-bar__cover-corner--br"></span>
          </div>
          <div class="player-bar__meta">
            <div class="player-bar__title text-ellipsis">{{ player.currentSong ? player.currentSong.title : 'NO SIGNAL' }}</div>
            <div class="player-bar__author text-ellipsis">
              {{ player.currentSong ? player.currentSong.author : '— —' }}
            </div>
          </div>
        </div>

        <!-- 区域 B · 控制中枢 -->
        <div class="player-bar__zone player-bar__zone--ctrl">
          <div class="player-bar__wave" :class="{ active: player.isPlaying }">
            <span
              v-for="(b, i) in bars"
              :key="i"
              class="player-bar__wave-bar"
              :style="{ animationDelay: `${i * 0.04}s` }"
            ></span>
          </div>
          <div class="player-bar__controls">
            <button
              class="player-bar__btn"
              @click="player.playPrev"
              :disabled="player.playQueue.length <= 1"
              title="上一首"
            >
              ⏮
            </button>
            <button class="player-bar__btn player-bar__btn--play" @click="player.togglePlay">
              {{ player.isPlaying ? '❚❚' : '▶' }}
            </button>
            <button
              class="player-bar__btn"
              @click="player.playNext"
              :disabled="player.playQueue.length <= 1"
              title="下一首"
            >
              ⏭
            </button>
          </div>
        </div>

        <!-- 区域 C · 辅助操作 -->
        <div class="player-bar__zone player-bar__zone--aside">
          <div class="player-bar__progress">
            <span class="player-bar__time mono">{{ formatTime(player.currentTime) }}</span>
            <input
              type="range"
              class="player-bar__slider"
              min="0"
              :max="player.duration || 100"
              :value="player.currentTime"
              :style="{ '--p': progressPct + '%' }"
              @input="handleSeek"
            />
            <span class="player-bar__time mono">{{ formatTime(player.duration) }}</span>
          </div>

          <div class="player-bar__actions">
            <button
              v-if="player.currentSong"
              class="player-bar__chip"
              :class="{ 'player-bar__chip--fav-active': favorites.isFavorite(player.currentSong.bvid) }"
              @click="favorites.toggle(player.currentSong)"
              :title="favorites.isFavorite(player.currentSong.bvid) ? '取消收藏' : '收藏'"
            >
              ♥
            </button>

            <div v-if="player.currentSong" class="player-bar__playlist-wrap" @click.stop>
              <button
                class="player-bar__chip"
                :class="{ 'player-bar__chip--active': showPlaylistMenu }"
                @click="togglePlaylistMenu($event)"
                title="添加到歌单"
              >
                ＋
              </button>
            </div>

            <div class="player-bar__volume">
              <button
                class="player-bar__volume-icon"
                @click="player.toggleMute"
                :title="player.volume === 0 ? '取消静音' : '静音'"
              >
                <svg v-if="player.volume > 0" class="player-bar__volume-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <svg v-else class="player-bar__volume-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              </button>
              <input
                type="range"
                class="player-bar__slider player-bar__slider--volume"
                min="0"
                max="1"
                step="0.01"
                :value="player.volume"
                :style="{ '--p': volumePct + '%' }"
                @input="player.setVolume(Number($event.target.value))"
              />
            </div>

            <button
              class="player-bar__chip player-bar__chip--queue"
              :class="{ 'player-bar__chip--active': showQueuePanel }"
              @click="showQueuePanel = !showQueuePanel"
              title="播放队列"
            >
              ☰
              <span class="player-bar__queue-badge mono">{{ player.playQueue.length }}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>

    <QueuePanel v-if="showQueuePanel" :show="true" @close="closeQueuePanel" />

    <transition name="player-playlist-menu">
      <div
        v-if="showPlaylistMenu && player.currentSong"
        class="player-playlist-menu"
        :style="{ left: playlistMenuPos.x + 'px', top: playlistMenuPos.y + 'px' }"
        @click.stop
      >
        <div class="player-playlist-menu__header">添加到歌单</div>
        <div class="player-playlist-menu__list scrollable">
          <button
            v-for="pl in playlists.playlists"
            :key="pl.id"
            class="player-playlist-menu__item"
            :class="{ 'player-playlist-menu__item--added': playlists.isInPlaylist(pl.id, player.currentSong.bvid) }"
            @click="handleAddToPlaylist(pl)"
          >
            <span class="player-playlist-menu__icon">
              {{ playlists.isInPlaylist(pl.id, player.currentSong.bvid) ? '✓' : '○' }}
            </span>
            <span class="player-playlist-menu__name text-ellipsis">{{ pl.name }}</span>
            <span class="player-playlist-menu__count mono">{{ pl.songs.length }}</span>
          </button>
          <div v-if="playlists.playlists.length === 0" class="player-playlist-menu__empty">
            还没有歌单
          </div>
        </div>
      </div>
    </transition>

    <audio
      v-if="player.currentSong?.audioStreamUrl"
      ref="audioRef"
      :src="player.currentSong.audioStreamUrl"
      @timeupdate="player.currentTime = $event.target.currentTime"
      @loadedmetadata="player.duration = $event.target.duration"
      @play="onAudioPlay"
      @pause="onAudioPause"
      @playing="onAudioPlaying"
      @ended="onAudioEnded"
      @error="handleAudioError"
      @stalled="onAudioStalled"
      @waiting="onAudioWaiting"
      @suspend="onAudioSuspend"
      @abort="onAudioAbort"
      @emptied="onAudioEmptied"
      @canplay="onAudioCanPlay"
    ></audio>

    <div class="toast-container">
      <transition-group name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="toast.type"
          @click="removeToast(toast.id)"
        >
          {{ toast.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;
@use './styles/mixins' as *;

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

// ---------- TOPBAR ----------
.topbar {
  height: $topbar-height;
  display: flex;
  align-items: center;
  padding: 0 $sp-8;
  @include glass;
  border-bottom: 1px solid $color-border;
  gap: $sp-6;

  &__brand {
    display: flex;
    align-items: center;
    gap: $sp-2;
    cursor: pointer;
    transition: transform $t-normal $ease-spring;

    &:hover {
      transform: scale(1.02);
    }
  }

  &__brand-mark {
    font-size: 22px;
    color: $color-cyan-bright;
    @include text-glow;
  }

  &__brand-text {
    font-family: $font-display;
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.12em;
    color: $color-text;
  }

  &__brand-accent {
    color: $color-magenta;
    @include text-glow($color-magenta);
  }

  &__tagline {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: $color-text-mute;
    padding: $sp-1 $sp-3;
    border: 1px solid $color-border;
    border-radius: $radius-pill;
  }

  &__nav {
    margin-left: auto;
    display: flex;
    gap: $sp-6;
  }

  &__link {
    font-family: $font-display;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.15em;
    color: $color-text-mute;
    transition: all $t-normal $ease-out;
    position: relative;
    padding: $sp-1 0;

    &:hover {
      color: $color-text;
    }

    &.router-link-active {
      color: $color-cyan-bright;
      @include text-glow;

      &::after {
        content: '';
        position: absolute;
        bottom: -4px;
        left: 0;
        width: 100%;
        height: 1px;
        background: $color-cyan-bright;
        box-shadow: $glow-cyan;
      }
    }
  }

  // 主题切换：轨道 + 滑块（青→白意象）
  &__theme-toggle {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
  }

  &__theme-track {
    position: relative;
    display: flex;
    align-items: center;
    width: 46px;
    height: 22px;
    border-radius: $radius-pill;
    background: $color-surface-2;
    border: 1px solid $color-border;
    transition: background $t-normal $ease-out, border-color $t-normal;

    &--light {
      background: linear-gradient(90deg, rgba($color-cyan-bright, 0.18), $color-surface-1);
      border-color: $color-border-glow;
    }
  }

  &__theme-thumb {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
    box-shadow: $glow-cyan;
    transition: left $t-normal $ease-spring, background $t-normal, box-shadow $t-normal;

    .topbar__theme-track--light & {
      left: calc(100% - 18px);
      background: $color-surface-1;
      box-shadow: 0 0 0 1px $color-border, $glow-cyan-soft;
    }
  }
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// ---------- SIDEBAR ----------
.sidebar {
  width: $sidebar-width;
  @include glass;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  padding: $sp-6 $sp-3;

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-3;
    padding: $sp-3 $sp-4;
    color: $color-text-mute;
    border-radius: $radius-sm;
    transition: all $t-normal $ease-out;
    position: relative;
    margin-bottom: $sp-1;

    &:hover {
      color: $color-text;
      background: $color-surface-2;
    }

    &--active {
      color: $color-cyan-bright;
      background: $color-cyan-dim;
      @include text-glow;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: $color-cyan-bright;
        border-radius: $radius-pill;
        box-shadow: $glow-cyan;
      }
    }
  }

  &__glyph {
    font-size: 16px;
    width: 18px;
    text-align: center;
  }

  &__label {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 500;
    flex: 1;
  }

  &__index {
    font-family: $font-mono;
    font-size: 10px;
    color: $color-text-faint;
  }

  &__footer {
    margin-top: auto;
    padding-top: $sp-6;
    border-top: 1px solid $color-border;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-2 $sp-4;
  }

  &__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $color-text-mute;
    transition: all $t-normal;

    &.playing {
      background: $color-cyan-bright;
      box-shadow: $glow-cyan;
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  &__status-text {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: $color-text-mute;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

// ---------- MAIN ----------
.main-content {
  flex: 1;
  padding: $sp-8 $sp-10;
  background: transparent;
}

// ---------- PLAYER BAR ----------
.player-bar {
  position: relative;
  height: $player-height;
  flex-shrink: 0;
  @include glass;
  border-top: 1px solid $color-border;
  overflow: hidden;
  transition: height 0.4s $ease-out, opacity 0.3s $ease-out, padding 0.4s $ease-out, border-color 0.3s;

  &--hidden {
    height: 0;
    opacity: 0;
    padding: 0;
    border-color: transparent;
    pointer-events: none;
  }

  // 顶部进度光带 —— 贯穿上沿，信号流指示
  &__topline {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba($color-cyan-bright, 0.06);
    z-index: 3;
    pointer-events: none;
  }

  &__topline-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-magenta, $color-cyan-bright);
    box-shadow: 0 0 10px rgba(var(--cyan-glow-rgb), 0.6);
    transition: width 0.2s linear;
  }

  &__inner {
    display: flex;
    align-items: stretch;
    height: 100%;
    width: 100%;
    padding: 0 $sp-6;
    gap: 0;
  }

  // 三个分区用统一的竖向分隔线
  &__zone {
    display: flex;
    align-items: center;
    height: 100%;

    &--now {
      width: 248px;
      flex-shrink: 0;
      gap: $sp-3;
      padding-right: $sp-5;
    }

    &--ctrl {
      flex-direction: column;
      justify-content: center;
      gap: $sp-1;
      padding: 0 $sp-6;
      border-left: 1px solid $color-border;
      border-right: 1px solid $color-border;
      flex-shrink: 0;
    }

    &--aside {
      flex: 1;
      min-width: 0;
      flex-direction: column;
      justify-content: center;
      gap: $sp-1;
      padding-left: $sp-5;
    }
  }

  // 当前播放卡片
  &__cover-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
  }

  &__cover {
    width: 100%;
    height: 100%;
    border-radius: $radius-sm;
    object-fit: cover;
    border: 1px solid $color-border;

    &--idle {
      @include flex-center;
      color: $color-text-faint;
      font-family: $font-mono;
      font-size: 20px;
      background: $color-surface-2;
      animation: spin 4s linear infinite;
    }
  }

  &__cover-glow {
    position: absolute;
    inset: -2px;
    border-radius: $radius-sm;
    border: 1px solid $color-cyan-bright;
    box-shadow: $glow-cyan;
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  // 卡片四角装饰刻度
  &__cover-corner {
    position: absolute;
    width: 6px;
    height: 6px;
    border-color: $color-cyan-bright;
    pointer-events: none;

    &--tl {
      top: -1px;
      left: -1px;
      border-top: 1px solid;
      border-left: 1px solid;
    }

    &--br {
      bottom: -1px;
      right: -1px;
      border-bottom: 1px solid;
      border-right: 1px solid;
    }
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: 2px;
    letter-spacing: 0.02em;
  }

  &__author {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.05em;
    color: $color-text-mute;
  }

  // 均衡器波形
  &__wave {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    height: 18px;
    width: 150px;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity $t-normal;

    &.active {
      opacity: 1;

      .player-bar__wave-bar {
        animation-play-state: running;
        opacity: 1;
      }
    }
  }

  &__wave-bar {
    flex: 1;
    min-width: 2px;
    max-width: 4px;
    background: linear-gradient(180deg, $color-cyan-bright, $color-cyan-deep);
    border-radius: $radius-pill;
    height: 30%;
    opacity: 0.4;
    animation: waveDance 1.2s ease-in-out infinite;
    animation-play-state: paused;
  }

  // 控制按钮
  &__controls {
    display: flex;
    align-items: center;
    gap: $sp-3;
  }

  &__btn {
    @include flex-center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: $color-text-soft;
    font-size: 12px;
    transition: all $t-normal $ease-out;
    border: 1px solid transparent;

    &:hover:not(:disabled) {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      box-shadow: $glow-cyan-soft;
    }

    &:active:not(:disabled) {
      transform: scale(0.94);
    }

    &:disabled {
      opacity: 0.2;
      cursor: not-allowed;
    }

    &--play {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
      color: $color-void;
      font-size: 14px;
      font-weight: 700;
      box-shadow: $glow-cyan;
      border: none;

      &:hover:not(:disabled) {
        transform: scale(1.06);
        box-shadow: $glow-cyan, 0 0 32px rgba(var(--cyan-glow-rgb), 0.45);
        border: none;
      }

      &:active:not(:disabled) {
        transform: scale(0.98);
      }
    }
  }

  // 进度区
  &__progress {
    display: flex;
    align-items: center;
    gap: $sp-3;
    width: 100%;
  }

  &__time {
    color: $color-text-mute;
    font-size: 10px;
    min-width: 36px;
    letter-spacing: 0.05em;

    &:first-child { text-align: right; }
    &:last-child { text-align: left; }
  }

  &__slider {
    flex: 1;
    appearance: none;
    -webkit-appearance: none;
    height: 16px;
    background: transparent;
    cursor: pointer;

    // 轨道（Webkit）
    &::-webkit-slider-runnable-track {
      height: 2px;
      border-radius: $radius-pill;
      background:
        linear-gradient(to right,
          $color-cyan-bright 0%,
          $color-cyan-bright var(--p, 0%),
          $color-surface-2 var(--p, 0%),
          $color-surface-2 100%);
      box-shadow: 0 0 0 1px $color-border;
    }

    // 拖把（Webkit）
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -5px;
      border-radius: 50%;
      background: $color-cyan-bright;
      border: 2px solid $color-void;
      box-shadow: $glow-cyan;
      transition: transform $t-normal $ease-spring, box-shadow $t-normal;
    }

    &:hover::-webkit-slider-thumb {
      transform: scale(1.25);
      box-shadow: $glow-cyan, 0 0 16px rgba(var(--cyan-glow-rgb), 0.6);
    }

    &:active::-webkit-slider-thumb {
      transform: scale(1.4);
    }

    // 轨道（Firefox）
    &::-moz-range-track {
      height: 2px;
      border-radius: $radius-pill;
      background: $color-surface-2;
      box-shadow: 0 0 0 1px $color-border;
    }

    &::-moz-range-progress {
      height: 2px;
      border-radius: $radius-pill;
      background: $color-cyan-bright;
    }

    &::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: $color-cyan-bright;
      border: 2px solid $color-void;
      box-shadow: $glow-cyan;
      cursor: pointer;
      transition: transform $t-normal $ease-spring, box-shadow $t-normal;
    }

    &:hover::-moz-range-thumb {
      transform: scale(1.25);
      box-shadow: $glow-cyan, 0 0 16px rgba(var(--cyan-glow-rgb), 0.6);
    }

    &:active::-moz-range-thumb {
      transform: scale(1.4);
    }

    &:focus-visible {
      outline: none;

      &::-webkit-slider-thumb {
        box-shadow: $glow-cyan, 0 0 0 3px rgba(var(--cyan-glow-rgb), 0.2);
      }
      &::-moz-range-thumb {
        box-shadow: $glow-cyan, 0 0 0 3px rgba(var(--cyan-glow-rgb), 0.2);
      }
    }

    // 音量条：洋红 → 青色渐变填充，更细
    &--volume {
      flex: 0;
      width: 70px;

      &::-webkit-slider-runnable-track {
        background:
          linear-gradient(to right,
            $color-magenta 0%,
            $color-cyan-bright var(--p, 0%),
            $color-surface-2 var(--p, 0%),
            $color-surface-2 100%);
      }

      &::-moz-range-progress {
        background: linear-gradient(to right, $color-magenta, $color-cyan-bright);
      }
    }
  }

  // 辅助按钮组（芯片风）
  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $sp-2;
    width: 100%;
  }

  &__chip {
    position: relative;
    @include flex-center;
    width: 30px;
    height: 26px;
    border-radius: $radius-xs;
    color: $color-text-mute;
    font-size: 14px;
    flex-shrink: 0;
    transition: all $t-normal $ease-out;
    border: 1px solid $color-border;
    background: transparent;

    &:hover {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
    }

    &--active {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
      @include text-glow;
    }

    &--fav-active {
      color: $color-magenta;
      border-color: rgba($color-magenta, 0.4);
      background: $color-magenta-dim;
      @include text-glow($color-magenta);
    }

    &--queue {
      width: 34px;
    }
  }

  &__playlist-wrap {
    position: relative;
    flex-shrink: 0;
  }

  &__volume {
    display: flex;
    align-items: center;
    gap: $sp-1;
    flex-shrink: 0;
    padding-left: $sp-1;
    border-left: 1px solid $color-border;
  }

  &__volume-icon {
    @include flex-center;
    width: 26px;
    height: 26px;
    color: $color-text-mute;
    flex-shrink: 0;
    transition: color $t-fast;

    &:hover {
      color: $color-cyan-bright;
    }
  }

  &__volume-svg {
    width: 14px;
    height: 14px;
  }

  &__queue-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 15px;
    height: 15px;
    @include flex-center;
    padding: 0 3px;
    background: $color-cyan-bright;
    color: $color-void;
    border-radius: $radius-pill;
    font-size: 8px;
    font-weight: 700;
    box-shadow: $glow-cyan-soft;
  }
}

@keyframes waveDance {
  0%, 100% { height: 25%; }
  50% { height: 95%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ---------- PLAYER PLAYLIST MENU ----------
.player-playlist-menu {
  position: fixed;
  z-index: 1100;
  width: 220px;
  max-height: 280px;
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-md;
  box-shadow: $shadow-lg, $glow-cyan-soft;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(-100%);

  &__header {
    padding: $sp-3 $sp-4;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: $color-text-mute;
    letter-spacing: 0.1em;
    border-bottom: 1px solid $color-border;
    flex-shrink: 0;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: $sp-1;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-3;
    width: 100%;
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;
    transition: all $t-fast;
    text-align: left;

    &:hover {
      background: $color-cyan-dim;
    }

    &--added {
      .player-playlist-menu__icon {
        color: $color-cyan-bright;
      }
    }
  }

  &__icon {
    @include flex-center;
    width: 16px;
    height: 16px;
    font-size: 12px;
    color: $color-text-faint;
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-family: $font-display;
    color: $color-text;
  }

  &__count {
    font-size: 11px;
    color: $color-text-faint;
    flex-shrink: 0;
  }

  &__empty {
    padding: $sp-6 $sp-4;
    text-align: center;
    color: $color-text-faint;
    font-size: 13px;
  }
}

.player-playlist-menu-enter-active,
.player-playlist-menu-leave-active {
  transition: opacity 0.2s $ease-out, transform 0.2s $ease-out;
}
.player-playlist-menu-enter-from,
.player-playlist-menu-leave-to {
  opacity: 0;
  transform: translateY(calc(-100% + 8px));
}

.toast-container {
  position: fixed;
  top: 80px;
  right: $sp-6;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

// ---------- PAGE TRANSITION ----------
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s $ease-out, transform 0.25s $ease-out;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s $ease-spring;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

// Responsive
@media (max-width: 900px) {
  .topbar__tagline,
  .topbar__nav {
    display: none;
  }
  .player-bar__zone--ctrl {
    padding: 0 $sp-3;
  }
  .player-bar__zone--now {
    width: 180px;
  }
  .player-bar__wave {
    width: 90px;
  }
  .sidebar {
    width: 56px;
    padding: $sp-6 $sp-2;
  }
  .sidebar__label,
  .sidebar__index {
    display: none;
  }
  .sidebar__item {
    justify-content: center;
    padding: $sp-3 $sp-1;
  }
  .sidebar__status-text {
    display: none;
  }
  .sidebar__status {
    justify-content: center;
    padding: $sp-2 $sp-1;
  }
}

@media (max-width: 640px) {
  .player-bar__zone--now {
    width: 140px;
  }
  .player-bar__wave {
    display: none;
  }
}
</style>
