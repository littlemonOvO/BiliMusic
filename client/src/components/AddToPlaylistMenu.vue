<script setup>
import { usePlaylistsStore } from '../stores/playlists'
import { useAddToPlaylist } from '../composables/useAddToPlaylist'

// "添加到歌单"下拉菜单：定位在触发按钮附近，列出所有歌单供选择。
// 取代 App.vue / QueuePanel.vue 中各自重复实现的两份内联菜单。
const props = defineProps({
  show: Boolean,
  song: { type: Object, default: null },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})

const emit = defineEmits(['close'])

const playlists = usePlaylistsStore()
const { addToPlaylist } = useAddToPlaylist()

function handleClick(playlist) {
  addToPlaylist(playlist, props.song)
  emit('close')
}
</script>

<template>
  <transition name="playlist-menu">
    <div
      v-if="show"
      class="playlist-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <div class="playlist-menu__header">添加到歌单</div>
      <div class="playlist-menu__list scrollable">
        <button
          v-for="pl in playlists.playlists"
          :key="pl.id"
          class="playlist-menu__item"
          :class="{ 'playlist-menu__item--added': song && playlists.isInPlaylist(pl.id, song.bvid) }"
          @click="handleClick(pl)"
        >
          <span class="playlist-menu__icon">
            {{ song && playlists.isInPlaylist(pl.id, song.bvid) ? '✓' : '○' }}
          </span>
          <span class="playlist-menu__name text-ellipsis" :title="pl.name">{{ pl.name }}</span>
          <span class="playlist-menu__count mono">{{ pl.songs.length }}</span>
        </button>
        <div v-if="playlists.playlists.length === 0" class="playlist-menu__empty">
          还没有歌单
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.playlist-menu {
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
      .playlist-menu__icon {
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

.playlist-menu-enter-active,
.playlist-menu-leave-active {
  transition: opacity 0.2s $ease-out, transform 0.2s $ease-out;
}
.playlist-menu-enter-from,
.playlist-menu-leave-to {
  opacity: 0;
  transform: translateY(calc(-100% + 8px));
}
</style>
