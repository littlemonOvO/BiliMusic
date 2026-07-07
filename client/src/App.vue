<script setup>
import { ref, watch, nextTick } from 'vue'
import { usePlayerStore } from './stores/player'
import { useToast } from './composables/useToast'

const player = usePlayerStore()
const { toasts, removeToast } = useToast()
const audioRef = ref(null)

// 监听播放状态，控制 audio 元素
watch(
  () => player.isPlaying,
  async (playing) => {
    await nextTick()
    const audio = audioRef.value
    if (!audio) return
    if (playing) {
      audio.play().catch(() => {
        player.isPlaying = false
      })
    } else {
      audio.pause()
    }
  }
)

// 监听当前歌曲变化，重置状态
watch(
  () => player.currentSong?.audioStreamUrl,
  () => {
    player.isPlaying = true
  }
)

// 监听音量变化
watch(
  () => player.volume,
  (vol) => {
    const audio = audioRef.value
    if (audio) audio.volume = vol
  }
)

// 处理拖动进度条
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
</script>

<template>
  <div class="app-layout">
    <!-- 顶部导航栏 -->
    <header class="topbar">
      <div class="topbar__logo" @click="$router.push('/')">
        <span class="topbar__logo-icon">◈</span>
        <span class="topbar__logo-text">BiliMusic</span>
      </div>
      <div class="topbar__search">
        <router-link to="/" class="topbar__search-link">搜索音乐</router-link>
      </div>
    </header>

    <div class="app-body">
      <!-- 侧边栏 -->
      <nav class="sidebar">
        <router-link to="/" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__icon">🔍</span>
          <span>搜索</span>
        </router-link>
        <router-link to="/player" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__icon">♪</span>
          <span>播放器</span>
        </router-link>
        <router-link to="/favorites" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__icon">♥</span>
          <span>收藏</span>
        </router-link>
        <router-link to="/playlists" class="sidebar__item" active-class="sidebar__item--active">
          <span class="sidebar__icon">☰</span>
          <span>歌单</span>
        </router-link>
      </nav>

      <!-- 主内容区 -->
      <main class="main-content scrollable">
        <router-view />
      </main>
    </div>

    <!-- 底部播放栏 -->
    <footer class="player-bar">
      <div class="player-bar__info">
        <template v-if="player.currentSong">
          <img
            :src="player.currentSong.cover"
            class="player-bar__cover"
            alt="封面"
          />
          <div class="player-bar__meta">
            <div class="player-bar__title text-ellipsis">{{ player.currentSong.title }}</div>
            <div class="player-bar__author text-ellipsis">{{ player.currentSong.author }}</div>
          </div>
        </template>
        <template v-else>
          <div class="player-bar__placeholder">未播放任何歌曲</div>
        </template>
      </div>

      <div class="player-bar__controls">
        <button class="player-bar__btn" @click="player.playPrev" :disabled="player.currentIndex <= 0">
          ⏮
        </button>
        <button class="player-bar__btn player-bar__btn--play" @click="player.togglePlay">
          {{ player.isPlaying ? '⏸' : '▶' }}
        </button>
        <button
          class="player-bar__btn"
          @click="player.playNext"
          :disabled="player.currentIndex >= player.playQueue.length - 1"
        >
          ⏭
        </button>
      </div>

      <div class="player-bar__progress">
        <span class="player-bar__time">{{ formatTime(player.currentTime) }}</span>
        <input
          type="range"
          class="player-bar__slider"
          min="0"
          :max="player.duration || 100"
          :value="player.currentTime"
          @input="handleSeek"
        />
        <span class="player-bar__time">{{ formatTime(player.duration) }}</span>
      </div>

      <div class="player-bar__volume">
        <span class="player-bar__volume-icon">🔊</span>
        <input
          type="range"
          class="player-bar__slider player-bar__slider--volume"
          min="0"
          max="1"
          step="0.01"
          :value="player.volume"
          @input="player.setVolume(Number($event.target.value))"
        />
      </div>
    </footer>

    <!-- 隐藏的 audio 元素 -->
    <audio
      v-if="player.currentSong?.audioStreamUrl"
      ref="audioRef"
      :src="player.currentSong.audioStreamUrl"
      @timeupdate="player.currentTime = $event.target.currentTime"
      @loadedmetadata="player.duration = $event.target.duration"
      @ended="player.playNext"
      @error="player.error = '音频加载失败'"
    ></audio>

    <!-- Toast 通知 -->
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
        @click="removeToast(toast.id)"
      >
        {{ toast.message }}
      </div>
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

// 顶部导航栏
.topbar {
  height: $topbar-height;
  display: flex;
  align-items: center;
  padding: 0 $spacing-lg;
  background: $color-bg-secondary;
  border-bottom: 1px solid $color-border;
  gap: $spacing-lg;

  &__logo {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    cursor: pointer;
    font-size: 18px;
    font-weight: 700;
    color: $color-accent;
  }

  &__logo-icon {
    font-size: 22px;
  }

  &__search-link {
    color: $color-text-secondary;
    font-size: 13px;
  }
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 侧边栏
.sidebar {
  width: $sidebar-width;
  background: $color-bg-secondary;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  padding: $spacing-md 0;

  &__item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
    color: $color-text-secondary;
    transition: all $transition-normal;
    border-left: 3px solid transparent;

    &:hover {
      color: $color-text-primary;
      background: $color-bg-tertiary;
    }

    &--active {
      color: $color-accent;
      border-left-color: $color-accent;
      background: $color-accent-dim;
    }
  }

  &__icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }
}

// 主内容区
.main-content {
  flex: 1;
  padding: $spacing-lg;
  background: $color-bg-primary;
}

// 底部播放栏
.player-bar {
  height: $player-height;
  background: $color-bg-secondary;
  border-top: 1px solid $color-border;
  display: flex;
  align-items: center;
  padding: 0 $spacing-lg;
  gap: $spacing-lg;

  &__info {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 240px;
    flex-shrink: 0;
  }

  &__cover {
    width: 48px;
    height: 48px;
    border-radius: $radius-sm;
    object-fit: cover;
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__title {
    color: $color-text-primary;
    font-size: 13px;
    font-weight: 500;
  }

  &__author {
    color: $color-text-secondary;
    font-size: 12px;
  }

  &__placeholder {
    color: $color-text-secondary;
    font-size: 13px;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__btn {
    @include flex-center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: $color-text-secondary;
    font-size: 14px;
    transition: all $transition-normal;

    &:hover:not(:disabled) {
      color: $color-accent;
      background: $color-accent-dim;
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    &--play {
      width: 40px;
      height: 40px;
      background: $color-accent;
      color: $color-bg-primary;
      font-size: 16px;

      &:hover:not(:disabled) {
        background: $color-accent-dark;
        color: $color-bg-primary;
      }
    }
  }

  &__progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__time {
    color: $color-text-secondary;
    font-size: 12px;
    min-width: 36px;
    text-align: center;
  }

  &__slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: $color-border;
    border-radius: 2px;
    outline: none;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: $color-accent;
      cursor: pointer;
    }

    &--volume {
      max-width: 80px;
    }
  }

  &__volume {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 120px;
  }

  &__volume-icon {
    font-size: 16px;
  }
}

// Toast 容器
.toast-container {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}
</style>
