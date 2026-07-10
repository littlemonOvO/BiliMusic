<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { usePlaylistsStore } from '../stores/playlists'
import { useToast } from '../composables/useToast'

const props = defineProps({
  show: Boolean,
  // 重命名模式时传入的歌单对象
  playlist: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const playlists = usePlaylistsStore()
const { showToast } = useToast()
const playlistName = ref('')
const inputRef = ref(null)

const isRename = computed(() => !!props.playlist)

watch(
  () => props.show,
  async (val) => {
    if (val) {
      playlistName.value = isRename.value ? props.playlist.name : ''
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

function handleSubmit() {
  const name = playlistName.value.trim()
  if (!name) {
    showToast('请输入歌单名称', 'error')
    return
  }

  if (isRename.value) {
    if (name === props.playlist.name) {
      emit('close')
      return
    }
    playlists.renamePlaylist(props.playlist.id, name)
    showToast('歌单已重命名', 'success')
  } else {
    playlists.createPlaylist(name)
    showToast('歌单创建成功', 'success')
  }
  emit('close')
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <!-- 标题区 -->
      <div class="modal__header">
        <span class="modal__mode mono">{{ isRename ? 'RENAME' : 'CREATE' }}</span>
        <h3 class="modal__title">{{ isRename ? '重命名歌单' : '创建歌单' }}</h3>
      </div>

      <!-- 输入区 -->
      <div class="modal__field">
        <label class="modal__label mono">PLAYLIST NAME</label>
        <input
          ref="inputRef"
          v-model="playlistName"
          type="text"
          class="modal__input"
          :placeholder="isRename ? '' : '输入歌单名称'"
          maxlength="40"
          @keyup.enter="handleSubmit"
        />
        <span class="modal__counter mono">{{ playlistName.length }}/40</span>
      </div>

      <!-- 操作区 -->
      <div class="modal__actions">
        <button class="modal__btn modal__btn--cancel" @click="emit('close')">取消</button>
        <button class="modal__btn modal__btn--confirm" @click="handleSubmit">
          {{ isRename ? '保存' : '创建' }}
        </button>
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
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal {
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-lg;
  padding: $sp-6;
  width: 400px;
  max-width: calc(100vw - #{$sp-8});
  box-shadow: $shadow-lg, $glow-cyan-soft;
  animation: modal-rise 0.35s $ease-spring;

  &__header {
    margin-bottom: $sp-5;
  }

  &__mode {
    display: inline-block;
    font-size: 10px;
    letter-spacing: 0.25em;
    color: $color-cyan-bright;
    margin-bottom: $sp-1;
    @include text-glow;
  }

  &__title {
    font-family: $font-display;
    font-size: 18px;
    font-weight: 600;
    color: $color-text;
  }

  &__field {
    position: relative;
    margin-bottom: $sp-6;
  }

  &__label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: $color-text-faint;
    margin-bottom: $sp-2;
  }

  &__input {
    width: 100%;
    padding: $sp-3 $sp-4;
    padding-right: $sp-8;
    background: $color-surface-1;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text;
    font-family: $font-body;
    font-size: 14px;
    outline: none;
    transition: all $t-normal $ease-out;

    &::placeholder {
      color: $color-text-faint;
    }

    &:focus {
      border-color: $color-cyan-bright;
      box-shadow: $glow-cyan-soft;
      background: $color-surface-2;
    }
  }

  &__counter {
    position: absolute;
    right: $sp-3;
    bottom: 11px;
    font-size: 10px;
    color: $color-text-faint;
    pointer-events: none;
  }

  &__actions {
    display: flex;
    gap: $sp-2;
    justify-content: flex-end;
  }

  &__btn {
    padding: $sp-2 $sp-5;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 500;
    transition: all $t-fast $ease-out;
    cursor: pointer;

    &--cancel {
      color: $color-text-mute;
      background: transparent;
      border: 1px solid $color-border;

      &:hover {
        color: $color-text;
        border-color: $color-text-mute;
        background: $color-surface-1;
      }
    }

    &--confirm {
      background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
      color: $color-void;
      font-weight: 600;
      border: none;
      box-shadow: $glow-cyan-soft;

      &:hover {
        box-shadow: $glow-cyan;
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.97);
      }
    }
  }
}

@keyframes modal-rise {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@media (max-width: 480px) {
  .modal {
    padding: $sp-5;
    width: calc(100vw - #{$sp-8});
  }
}
</style>
