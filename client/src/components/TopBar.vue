<script setup>
import { useThemeStore } from '../stores/theme'

// 顶部栏：品牌 / 标语 / 导航 / 主题切换。
const theme = useThemeStore()
</script>

<template>
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
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

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

  // 主题切换：轨道 + 滑块（青->白意象）
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

@media (max-width: 900px) {
  .topbar__tagline,
  .topbar__nav {
    display: none;
  }
}
</style>
