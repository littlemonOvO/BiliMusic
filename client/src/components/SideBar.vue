<script setup>
import { usePlayerStore } from '../stores/player'

// 侧边导航：搜索/播放器/收藏/歌单，底部播放状态指示。
const player = usePlayerStore()
</script>

<template>
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
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

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

@media (max-width: 900px) {
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
</style>
