<script setup>
import { useFavoritesStore } from '../stores/favorites'
import { usePlayerStore } from '../stores/player'

const props = defineProps({
  song: {
    type: Object,
    required: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['play', 'add-to-playlist'])

const favorites = useFavoritesStore()
const player = usePlayerStore()

const isCurrent = () => {
  return player.currentSong?.bvid === props.song.bvid
}
</script>

<template>
  <div
    class="music-item"
    :class="{ 'music-item--active': isCurrent() }"
    @dblclick="emit('play', song)"
  >
    <div class="music-item__cover-wrap" @click="emit('play', song)">
      <img :src="song.cover" class="music-item__cover" alt="封面" />
      <div class="music-item__play-overlay">▶</div>
    </div>
    <div class="music-item__info" @click="emit('play', song)">
      <div class="music-item__title text-ellipsis">{{ song.title }}</div>
      <div class="music-item__author text-ellipsis">{{ song.author }}</div>
    </div>
    <div class="music-item__duration">{{ song.duration }}</div>
    <div v-if="showActions" class="music-item__actions">
      <button
        class="music-item__btn"
        :class="{ 'music-item__btn--active': favorites.isFavorite(song.bvid) }"
        @click.stop="favorites.toggle(song)"
        :title="favorites.isFavorite(song.bvid) ? '取消收藏' : '收藏'"
      >
        ♥
      </button>
      <button
        class="music-item__btn"
        @click.stop="emit('add-to-playlist', song)"
        title="添加到歌单"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.music-item {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  transition: all $transition-fast;
  cursor: pointer;

  &:hover {
    background: $color-bg-secondary;

    .music-item__play-overlay {
      opacity: 1;
    }
  }

  &--active {
    background: $color-accent-dim;

    .music-item__title {
      color: $color-accent;
    }
  }

  &__cover-wrap {
    position: relative;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  &__cover {
    width: 100%;
    height: 100%;
    border-radius: $radius-sm;
    object-fit: cover;
  }

  &__play-overlay {
    @include flex-center;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    border-radius: $radius-sm;
    color: $color-accent;
    font-size: 18px;
    opacity: 0;
    transition: opacity $transition-normal;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    color: $color-text-primary;
    font-size: 14px;
    margin-bottom: 2px;
  }

  &__author {
    color: $color-text-secondary;
    font-size: 12px;
  }

  &__duration {
    color: $color-text-secondary;
    font-size: 12px;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    gap: $spacing-xs;
    flex-shrink: 0;
  }

  &__btn {
    @include flex-center;
    width: 28px;
    height: 28px;
    border-radius: $radius-sm;
    color: $color-text-secondary;
    font-size: 14px;
    transition: all $transition-fast;

    &:hover {
      color: $color-accent;
      background: $color-accent-dim;
    }

    &--active {
      color: $color-accent;
    }
  }
}
</style>
