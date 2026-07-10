<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  show: Boolean,
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  variant: { type: String, default: 'danger' }, // 'danger' | 'primary'
})

const emit = defineEmits(['confirm', 'cancel'])

const dialogRef = ref(null)

watch(
  () => props.show,
  async (val) => {
    if (val) {
      await nextTick()
      dialogRef.value?.focus()
    }
  }
)

function handleKeydown(e) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}
</script>

<template>
  <Transition name="confirm-fade">
    <div v-if="show" class="confirm-overlay" @click.self="emit('cancel')" @keydown="handleKeydown" tabindex="-1">
      <Transition name="confirm-pop" appear>
        <div
          v-if="show"
          ref="dialogRef"
          class="confirm-dialog"
          :class="`confirm-dialog--${variant}`"
          tabindex="0"
          role="alertdialog"
          :aria-label="title"
        >
          <!-- 几何装饰角标 -->
          <span class="confirm-dialog__corner confirm-dialog__corner--tl"></span>
          <span class="confirm-dialog__corner confirm-dialog__corner--br"></span>

          <!-- 警告标识 -->
          <div class="confirm-dialog__icon">
            <svg v-if="variant === 'danger'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L1 21h22L12 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
              <path d="M12 9v5M12 17.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
              <path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <h3 class="confirm-dialog__title">{{ title }}</h3>
          <p class="confirm-dialog__message">{{ message }}</p>

          <div class="confirm-dialog__actions">
            <button class="confirm-dialog__btn confirm-dialog__btn--cancel" @click="emit('cancel')">
              {{ cancelText }}
            </button>
            <button class="confirm-dialog__btn confirm-dialog__btn--confirm" @click="emit('confirm')">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

// ---------- OVERLAY ----------
.confirm-overlay {
  @include flex-center;
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1100;
  outline: none;
}

// ---------- DIALOG ----------
.confirm-dialog {
  position: relative;
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-lg;
  padding: $sp-8 $sp-6 $sp-6;
  width: 380px;
  max-width: calc(100vw - #{$sp-8});
  text-align: center;
  box-shadow: $shadow-lg, $glow-cyan-soft;
  outline: none;

  // 危险变体：洋红边框微光
  &--danger {
    border-color: rgba($color-magenta, 0.3);
    box-shadow: $shadow-lg, 0 0 24px rgba($magenta-glow-rgb, 0.12);
  }

  // ---------- 角标装饰 ----------
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

  // ---------- 警告图标 ----------
  &__icon {
    @include flex-center;
    width: 56px;
    height: 56px;
    margin: 0 auto $sp-4;
    border-radius: 50%;
    border: 1px solid $color-border;
    background: $color-surface-1;
    color: $color-cyan-bright;
    animation: confirm-icon-pulse 2s $ease-out infinite;

    .confirm-dialog--danger & {
      color: $color-magenta;
      border-color: rgba($color-magenta, 0.3);
      background: rgba($color-magenta, 0.08);
      animation-name: confirm-icon-pulse-danger;
    }
  }

  // ---------- 标题 ----------
  &__title {
    font-family: $font-display;
    font-size: 18px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: $sp-2;
    letter-spacing: 0.02em;
  }

  // ---------- 描述 ----------
  &__message {
    font-family: $font-body;
    font-size: 13px;
    line-height: 1.6;
    color: $color-text-mute;
    margin-bottom: $sp-6;
  }

  // ---------- 按钮组 ----------
  &__actions {
    display: flex;
    gap: $sp-3;
  }

  &__btn {
    flex: 1;
    padding: $sp-3 $sp-4;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.03em;
    transition: all $t-normal $ease-out;
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
      border: none;
      font-weight: 600;
      color: #ffffff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

      // 默认（primary 变体）用青色渐变
      .confirm-dialog--primary & {
        background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
        box-shadow: $glow-cyan-soft;

        &:hover {
          box-shadow: $glow-cyan;
          transform: translateY(-1px);
        }
      }

      // 危险变体用洋红渐变
      .confirm-dialog--danger & {
        background: linear-gradient(135deg, $color-magenta, rgba($magenta-glow-rgb, 0.75));
        box-shadow: 0 0 16px rgba($magenta-glow-rgb, 0.3);

        &:hover {
          box-shadow: 0 0 24px rgba($magenta-glow-rgb, 0.5);
          transform: translateY(-1px);
        }
      }

      &:active {
        transform: scale(0.97);
      }
    }
  }
}

// ---------- 动画 ----------
@keyframes confirm-icon-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba($cyan-glow-rgb, 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba($cyan-glow-rgb, 0.08);
  }
}

@keyframes confirm-icon-pulse-danger {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba($magenta-glow-rgb, 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba($magenta-glow-rgb, 0.08);
  }
}

// 过渡：遮罩淡入
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity $t-normal $ease-out;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

// 过渡：弹窗弹出
.confirm-pop-enter-active {
  transition: all 0.35s $ease-spring;
}
.confirm-pop-leave-active {
  transition: all 0.2s $ease-out;
}
.confirm-pop-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}
.confirm-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

// ---------- 响应式 ----------
@media (max-width: 480px) {
  .confirm-dialog {
    padding: $sp-6 $sp-5 $sp-5;
    width: calc(100vw - #{$sp-8});
  }

  .confirm-dialog__btn {
    padding: $sp-2 $sp-3;
    font-size: 12px;
  }
}
</style>
