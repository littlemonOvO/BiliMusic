<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  show: Boolean,
  title: { type: String, default: '重命名' },
  label: { type: String, default: '' },
  initialValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入新名称' },
  confirmText: { type: String, default: '保存' },
})

const emit = defineEmits(['confirm', 'cancel'])

const inputValue = ref('')
const inputRef = ref(null)

watch(
  () => props.show,
  async (val) => {
    if (val) {
      inputValue.value = props.initialValue
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  }
)

function handleConfirm() {
  const val = inputValue.value.trim()
  if (!val) return
  emit('confirm', val)
}

function handleKeydown(e) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') handleConfirm()
}
</script>

<template>
  <div v-if="show" class="rename-overlay" @click.self="emit('cancel')" @keydown="handleKeydown" tabindex="-1">
    <div class="rename-dialog">
      <span class="rename-dialog__corner rename-dialog__corner--tl"></span>
      <span class="rename-dialog__corner rename-dialog__corner--br"></span>

      <div class="rename-dialog__header">
        <span class="rename-dialog__mode mono">RENAME</span>
        <h3 class="rename-dialog__title">{{ title }}</h3>
      </div>

      <div class="rename-dialog__field">
        <label v-if="label" class="rename-dialog__label mono">{{ label }}</label>
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          class="rename-dialog__input"
          :placeholder="placeholder"
          maxlength="80"
          @keyup.enter="handleConfirm"
        />
        <span class="rename-dialog__counter mono">{{ inputValue.length }}/80</span>
      </div>

      <div class="rename-dialog__actions">
        <button class="rename-dialog__btn rename-dialog__btn--cancel" @click="emit('cancel')">取消</button>
        <button
          class="rename-dialog__btn rename-dialog__btn--confirm"
          :disabled="!inputValue.trim()"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.rename-overlay {
  @include flex-center;
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1100;
  outline: none;
}

.rename-dialog {
  position: relative;
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-lg;
  padding: $sp-8 $sp-6 $sp-6;
  width: 400px;
  max-width: calc(100vw - #{$sp-8});
  box-shadow: $shadow-lg, $glow-cyan-soft;
  animation: rename-rise 0.35s $ease-spring;

  &__corner {
    position: absolute;
    width: 14px;
    height: 14px;
    border-style: solid;
    border-color: $color-cyan-deep;
    opacity: 0.5;

    &--tl {
      top: 10px;
      left: 10px;
      border-width: 1px 0 0 1px;
    }

    &--br {
      bottom: 10px;
      right: 10px;
      border-width: 0 1px 1px 0;
    }
  }

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
      color: #ffffff;
      font-weight: 600;
      border: none;
      box-shadow: $glow-cyan-soft;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

      &:hover:not(:disabled) {
        box-shadow: $glow-cyan;
        transform: translateY(-1px);
      }

      &:active:not(:disabled) {
        transform: scale(0.97);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
  }
}

@keyframes rename-rise {
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
  .rename-dialog {
    padding: $sp-5;
    width: calc(100vw - #{$sp-8});
  }
}
</style>
