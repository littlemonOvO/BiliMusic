<script setup>
import { useFavoritesStore } from '../stores/favorites'
import { usePlayerStore } from '../stores/player'
import { getImageUrl } from '../api'

const props = defineProps({
  song: {
    type: Object,
    required: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
  showRemove: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['play', 'add-to-playlist', 'add-to-next', 'remove', 'context-menu'])

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
    @contextmenu.prevent="emit('context-menu', { song, event: $event })"
  >
    <div class="music-item__cover-wrap" @click="emit('play', song)">
      <img :src="getImageUrl(song.cover)" class="music-item__cover" alt="cover" />
      <div class="music-item__play-overlay">
        <span>▶</span>
      </div>
      <div v-if="isCurrent() && player.isPlaying" class="music-item__equalizer">
        <span></span><span></span><span></span>
      </div>
    </div>
    <div class="music-item__info" @click="emit('play', song)">
      <div class="music-item__title text-ellipsis">{{ song.title }}</div>
      <div class="music-item__author text-ellipsis">{{ song.author }}</div>
    </div>
    <div class="music-item__duration mono">{{ song.duration }}</div>
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
        @click.stop="emit('add-to-next', song)"
        title="添加到下一首播放"
      >
        ⏭
      </button>
      <button
        class="music-item__btn"
        @click.stop="emit('add-to-playlist', song)"
        title="添加到歌单"
      >
        +
      </button>
      <button
        v-if="showRemove"
        class="music-item__btn music-item__btn--remove"
        @click.stop="emit('remove', song)"
        title="从歌单移除"
      >
        ✕
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
  gap: $sp-4;
  padding: $sp-2 $sp-4;
  border-radius: $radius-sm;
  transition: all $t-fast $ease-out;
  cursor: pointer;
  position: relative;
  animation: riseIn 0.4s $ease-out backwards;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 0;
    background: $color-cyan-bright;
    border-radius: $radius-pill;
    box-shadow: $glow-cyan;
    transition: height $t-normal $ease-out;
  }

  &:hover {
    background: $color-surface-2;

    .music-item__play-overlay {
      opacity: 1;
    }
    .music-item__cover {
      transform: scale(1.08);
    }
  }

  &--active {
    background: $color-cyan-dim;

    .music-item__title {
      color: $color-cyan-bright;
      @include text-glow;
    }

    &::before {
      height: 60%;
    }
  }

  &__cover-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: $radius-sm;
  }

  &__cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform $t-normal $ease-out;
  }

  &__play-overlay {
    @include flex-center;
    position: absolute;
    inset: 0;
    background: var(--overlay);
    color: $color-cyan-bright;
    font-size: 16px;
    opacity: 0;
    transition: opacity $t-normal;
    @include text-glow;

    span {
      filter: drop-shadow(0 0 6px $color-cyan-bright);
    }
  }

  &__equalizer {
    position: absolute;
    bottom: 4px;
    right: 4px;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
    padding: 2px;
    background: var(--overlay-strong);
    border-radius: $radius-xs;

    span {
      width: 2px;
      background: $color-cyan-bright;
      box-shadow: 0 0 4px $color-cyan-bright;
      animation: eq 0.9s ease-in-out infinite;
      &:nth-child(1) { animation-delay: 0s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-display;
    color: $color-text;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 3px;
    transition: color $t-fast;
  }

  &__author {
    color: $color-text-mute;
    font-size: 12px;
  }

  &__duration {
    color: $color-text-mute;
    font-size: 11px;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    gap: $sp-1;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity $t-fast;
  }

  &:hover &__actions {
    opacity: 1;
  }

  &__btn {
    @include flex-center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    color: $color-text-mute;
    font-size: 14px;
    transition: all $t-fast;
    border: 1px solid transparent;

    &:hover {
      color: $color-cyan-bright;
      background: $color-cyan-dim;
      border-color: $color-cyan-deep;
    }

    &--active {
      color: $color-magenta;
      @include text-glow($color-magenta);

      &:hover {
        background: $color-magenta-dim;
        border-color: $color-magenta;
      }
    }

    &--remove:hover {
      color: $color-error;
      background: rgba($color-error, 0.1);
      border-color: rgba($color-error, 0.4);
    }
  }
}

@keyframes eq {
  0%, 100% { height: 30%; }
  50% { height: 100%; }
}
</style>
