<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useFavoritesStore } from '../stores/favorites'
import { getImageUrl } from '../api'
import AddToPlaylistMenu from './AddToPlaylistMenu.vue'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const player = usePlayerStore()
const favorites = useFavoritesStore()

const playlistMenuSong = ref(null)
const playlistMenuPos = ref({ x: 0, y: 0 })

function togglePlaylistMenu(song, event) {
  event.stopPropagation()
  if (playlistMenuSong.value?.bvid === song.bvid) {
    playlistMenuSong.value = null
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  playlistMenuPos.value = {
    x: rect.right - 220,
    y: rect.top - 8,
  }
  playlistMenuSong.value = song
}

function closePlaylistMenu() {
  playlistMenuSong.value = null
}
</script>

<template>
  <transition name="queue-panel">
    <div v-if="show" class="queue-overlay" @click.self="emit('close')">
      <div class="queue-panel">
        <div class="queue-panel__header">
          <div class="queue-panel__title-group">
            <h3 class="queue-panel__title">播放队列</h3>
            <span class="queue-panel__count mono">
              {{ String(player.playQueue.length).padStart(2, '0') }} TRACKS
            </span>
          </div>
          <div class="queue-panel__actions">
            <button
              class="queue-panel__mode"
              :class="{
                'queue-panel__mode--shuffle': player.playMode === 'shuffle',
                'queue-panel__mode--single': player.playMode === 'single',
              }"
              @click="player.togglePlayMode"
              :title="player.playMode === 'list' ? '列表循环' : player.playMode === 'single' ? '单曲循环' : '随机播放'"
            >
              <span v-if="player.playMode === 'list'">↻</span>
              <span v-else-if="player.playMode === 'single'">↻1</span>
              <span v-else>🔀</span>
              <span class="queue-panel__mode-label">
                {{ player.playMode === 'list' ? '列表循环' : player.playMode === 'single' ? '单曲循环' : '随机播放' }}
              </span>
            </button>
            <button
              v-if="player.playQueue.length > 0"
              class="queue-panel__clear"
              @click="player.clearQueue"
              title="清空队列"
            >
              清空
            </button>
            <button class="queue-panel__close" @click="emit('close')">✕</button>
          </div>
        </div>

        <div class="queue-panel__list scrollable" @click="closePlaylistMenu">
          <div
            v-for="(song, i) in player.playQueue"
            :key="song.bvid"
            class="queue-item"
            :class="{ 'queue-item--active': i === player.currentIndex }"
            @click="player.playIndex(i)"
          >
            <span class="queue-item__index mono">
              <template v-if="i === player.currentIndex && player.isPlaying">▶</template>
              <template v-else>{{ String(i + 1).padStart(2, '0') }}</template>
            </span>
            <img
              :src="getImageUrl(song.cover)"
              class="queue-item__cover"
              alt="cover"
            />
            <div class="queue-item__info">
              <div class="queue-item__title text-ellipsis" :title="song.title">{{ song.title }}</div>
              <div class="queue-item__author text-ellipsis" :title="song.author">{{ song.author }}</div>
            </div>
            <div class="queue-item__actions">
              <button
                class="queue-item__btn"
                :class="{ 'queue-item__btn--active': favorites.isFavorite(song.bvid) }"
                @click.stop="favorites.toggle(song)"
                title="收藏"
              >
                ♥
              </button>
              <button
                class="queue-item__btn"
                :class="{ 'queue-item__btn--active': playlistMenuSong?.bvid === song.bvid }"
                @click.stop="togglePlaylistMenu(song, $event)"
                title="添加到歌单"
              >
                ♪
              </button>
              <button
                class="queue-item__btn queue-item__btn--remove"
                @click.stop="player.removeFromQueue(song.bvid)"
                title="从队列移除"
              >
                ✕
              </button>
            </div>
          </div>

          <div v-if="player.playQueue.length === 0" class="queue-panel__empty">
            <span class="queue-panel__empty-icon">∅</span>
            <p>播放队列为空</p>
          </div>
        </div>
      </div>

      <AddToPlaylistMenu
        :show="!!playlistMenuSong"
        :song="playlistMenuSong"
        :x="playlistMenuPos.x"
        :y="playlistMenuPos.y"
        @close="closePlaylistMenu"
      />
    </div>
  </transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.queue-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--overlay-soft);
  backdrop-filter: blur(4px);
}

.queue-panel {
  position: absolute;
  bottom: $player-height;
  right: 0;
  width: 420px;
  max-height: 480px;
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-lg $radius-lg 0 0;
  border-bottom: none;
  border-right: none;
  box-shadow: $shadow-lg, $glow-cyan-soft;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, $color-cyan-bright, transparent);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $sp-5 $sp-6;
    border-bottom: 1px solid $color-border;
    flex-shrink: 0;
  }

  &__title-group {
    display: flex;
    align-items: baseline;
    gap: $sp-3;
  }

  &__title {
    font-family: $font-display;
    font-size: 16px;
    font-weight: 600;
    color: $color-text;
  }

  &__count {
    font-size: 11px;
    color: $color-text-mute;
    letter-spacing: 0.2em;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $sp-2;
  }

  &__mode {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 12px;
    color: $color-text-mute;
    border: 1px solid $color-border;
    transition: all $t-normal;

    &:hover {
      color: $color-text;
      border-color: $color-border-glow;
    }

    &--shuffle {
      color: $color-magenta;
      border-color: rgba($color-magenta, 0.4);
      @include text-glow($color-magenta);
    }

    &--single {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      @include text-glow;
    }
  }

  &__mode-label {
    letter-spacing: 0.05em;
  }

  &__clear {
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 12px;
    color: $color-text-mute;
    border: 1px solid $color-border;
    transition: all $t-normal;

    &:hover {
      color: $color-error;
      border-color: rgba($color-error, 0.4);
      background: rgba($color-error, 0.08);
    }
  }

  &__close {
    @include flex-center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    color: $color-text-mute;
    font-size: 14px;
    transition: all $t-normal;

    &:hover {
      color: $color-error;
      background: rgba($color-error, 0.1);
    }
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: $sp-2;
  }

  &__empty {
    @include flex-center;
    flex-direction: column;
    gap: $sp-3;
    padding: $sp-12 0;
    color: $color-text-faint;

    .queue-panel__empty-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    p {
      font-size: 13px;
    }
  }
}

// ---------- QUEUE ITEM ----------
.queue-item {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-2 $sp-3;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $t-fast $ease-out;
  position: relative;

  &:hover {
    background: $color-surface-2;

    .queue-item__actions {
      opacity: 1;
    }
  }

  &--active {
    background: $color-cyan-dim;

    .queue-item__title {
      color: $color-cyan-bright;
      @include text-glow;
    }

    .queue-item__index {
      color: $color-cyan-bright;
    }
  }

  &__index {
    @include flex-center;
    width: 24px;
    height: 24px;
    font-size: 11px;
    color: $color-text-faint;
    flex-shrink: 0;
  }

  &__cover {
    width: 40px;
    height: 40px;
    border-radius: $radius-xs;
    object-fit: cover;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 500;
    color: $color-text;
    margin-bottom: 2px;
  }

  &__author {
    font-size: 11px;
    color: $color-text-mute;
  }

  &__actions {
    display: flex;
    gap: $sp-1;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity $t-fast;
  }

  &__btn {
    @include flex-center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: $color-text-mute;
    font-size: 12px;
    transition: all $t-fast;

    &:hover {
      color: $color-cyan-bright;
      background: $color-cyan-dim;
    }

    &--active {
      color: $color-magenta;
      @include text-glow($color-magenta);
    }

    &--remove:hover {
      color: $color-error;
      background: rgba($color-error, 0.1);
    }
  }
}

// ---------- TRANSITIONS ----------
.queue-panel-enter-active,
.queue-panel-leave-active {
  transition: opacity 0.25s $ease-out;
  .queue-panel {
    transition: transform 0.3s $ease-out;
  }
}
.queue-panel-enter-from,
.queue-panel-leave-to {
  opacity: 0;
  .queue-panel {
    transform: translateY(20px);
  }
}
</style>
