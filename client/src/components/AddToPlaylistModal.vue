<script setup>
import { usePlaylistsStore } from '../stores/playlists'
import { useAddToPlaylist } from '../composables/useAddToPlaylist'

const props = defineProps({
  show: Boolean,
  song: Object,
})

const emit = defineEmits(['close'])

const playlists = usePlaylistsStore()
const { addToPlaylist } = useAddToPlaylist()

function handleAdd(playlist) {
  if (props.song && addToPlaylist(playlist, props.song)) {
    emit('close')
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3 class="modal__title">添加到歌单</h3>
      <div v-if="playlists.playlists.length === 0" class="modal__empty">
        还没有歌单，先创建一个吧
      </div>
      <div v-else class="modal__list scrollable">
        <div
          v-for="p in playlists.playlists"
          :key="p.id"
          class="modal__playlist-item"
          :class="{ 'modal__playlist-item--added': song && playlists.isInPlaylist(p.id, song.bvid) }"
          @click="handleAdd(p)"
        >
          <span class="modal__playlist-icon">
            {{ song && playlists.isInPlaylist(p.id, song.bvid) ? '✓' : '☰' }}
          </span>
          <span class="modal__playlist-name">{{ p.name }}</span>
          <span class="modal__playlist-count mono">{{ p.songs.length }}</span>
        </div>
      </div>
      <div class="modal__actions">
        <button class="modal__btn modal__btn--cancel" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.modal-overlay {
  @include flex-center;
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal {
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-lg;
  padding: $sp-6;
  width: 360px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: $shadow-lg, $glow-cyan-soft;
  animation: riseIn 0.3s $ease-out;

  &__title {
    font-family: $font-display;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: $sp-4;
    color: $color-text;
  }

  &__empty {
    color: $color-text-mute;
    text-align: center;
    padding: $sp-8 0;
    font-size: 13px;
  }

  &__list {
    max-height: 300px;
    overflow-y: auto;
  }

  &__playlist-item {
    display: flex;
    align-items: center;
    gap: $sp-3;
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all $t-fast;

    &:hover {
      background: $color-cyan-dim;
    }

    &--added {
      .modal__playlist-icon {
        color: $color-cyan-bright;
      }
      .modal__playlist-name {
        color: $color-cyan-bright;
      }
    }
  }

  &__playlist-icon {
    color: $color-text-faint;
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  &__playlist-name {
    flex: 1;
    color: $color-text;
    font-size: 14px;
    font-family: $font-display;
  }

  &__playlist-count {
    color: $color-text-faint;
    font-size: 11px;
  }

  &__actions {
    display: flex;
    gap: $sp-2;
    justify-content: flex-end;
    margin-top: $sp-4;
  }

  &__btn {
    padding: $sp-2 $sp-4;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 13px;
    transition: all $t-fast;

    &--cancel {
      color: $color-text-mute;
      &:hover {
        color: $color-text;
      }
    }
  }
}
</style>
