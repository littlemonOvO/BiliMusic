<script setup>
import { ref, watch } from 'vue'
import { usePlaylistsStore } from '../stores/playlists'
import { useToast } from '../composables/useToast'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const playlists = usePlaylistsStore()
const { showToast } = useToast()
const playlistName = ref('')

watch(
  () => props.show,
  (val) => {
    if (val) playlistName.value = ''
  }
)

function handleCreate() {
  const name = playlistName.value.trim()
  if (!name) {
    showToast('请输入歌单名称', 'error')
    return
  }
  playlists.createPlaylist(name)
  showToast('歌单创建成功', 'success')
  emit('close')
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3 class="modal__title">创建歌单</h3>
      <input
        v-model="playlistName"
        type="text"
        class="modal__input"
        placeholder="输入歌单名称"
        @keyup.enter="handleCreate"
        autofocus
      />
      <div class="modal__actions">
        <button class="modal__btn modal__btn--cancel" @click="emit('close')">取消</button>
        <button class="modal__btn modal__btn--confirm" @click="handleCreate">创建</button>
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
  box-shadow: $shadow-md;

  &__title {
    font-size: 16px;
    margin-bottom: $spacing-md;
    color: $color-text-primary;
  }

  &__input {
    width: 100%;
    padding: 10px 12px;
    background: $color-bg-primary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;
    font-size: 14px;
    outline: none;
    margin-bottom: $spacing-md;

    &:focus {
      border-color: $color-accent;
    }
  }

  &__actions {
    display: flex;
    gap: $spacing-sm;
    justify-content: flex-end;
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

    &--confirm {
      background: $color-accent;
      color: $color-bg-primary;
      &:hover {
        background: $color-accent-dark;
      }
    }
  }
}
</style>
