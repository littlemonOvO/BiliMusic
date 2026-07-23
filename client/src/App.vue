<script setup>
import { onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from './stores/player'
import { useThemeStore } from './stores/theme'
import { useToast } from './composables/useToast'
import PlayerBar from './components/PlayerBar.vue'

const player = usePlayerStore()
const theme = useThemeStore()
const { toasts, removeToast, showToast } = useToast()

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

</script>

<template>
  <div class="app-layout">
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

    <PlayerBar />

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
