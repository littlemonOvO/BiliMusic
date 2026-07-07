<script setup>
import { usePlaylistsStore } from '../stores/playlists'
import { useToast } from '../composables/useToast'

const props = defineProps({
  show: Boolean,
  song: Object,
})

const emit = defineEmits(['close'])

const playlists = usePlaylistsStore()
const { showToast } = useToast()

function handleAdd(playlistId) {
  if (props.song) {
    playlists.addToPlaylist(playlistId, props.song)
    showToast('已添加到歌单', 'success')
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
          @click="handleAdd(p.id)"
        >
          <span class="modal__playlist-icon">☰</span>
          <span class="modal__playlist-name">{{ p.name }}</span>
          <span class="modal__playlist-count">{{ p.songs.length }} 首</span>
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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
}

.modal {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  width: 360px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: $shadow-md;

  &__title {
    font-size: 16px;
    margin-bottom: $spacing-md;
    color: $color-text-primary;
  }

  &__empty {
    color: $color-text-secondary;
    text-align: center;
    padding: $spacing-xl 0;
    font-size: 13px;
  }

  &__list {
    max-height: 300px;
    overflow-y: auto;
  }

  &__playlist-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: 10px $spacing-sm;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      background: $color-bg-tertiary;
    }
  }

  &__playlist-icon {
    color: $color-accent;
    font-size: 16px;
  }

  &__playlist-name {
    flex: 1;
    color: $color-text-primary;
    font-size: 14px;
  }

  &__playlist-count {
    color: $color-text-secondary;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: $spacing-sm;
    justify-content: flex-end;
    margin-top: $spacing-md;
  }

  &__btn {
    padding: 8px 16px;
    border-radius: $radius-sm;
    font-size: 13px;
    transition: all $transition-normal;

    &--cancel {
      color: $color-text-secondary;
      &:hover {
        color: $color-text-primary;
      }
    }
  }
}
</style>
