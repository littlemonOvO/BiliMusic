<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  show: Boolean,
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'select'])
const menuRef = ref(null)
const adjustedPos = ref({ x: 0, y: 0 })

watch(
  () => [props.show, props.x, props.y],
  async () => {
    if (!props.show) return
    await nextTick()
    // 调整位置防止溢出屏幕
    const menu = menuRef.value
    if (!menu) {
      adjustedPos.value = { x: props.x, y: props.y }
      return
    }
    const rect = menu.getBoundingClientRect()
    let x = props.x
    let y = props.y
    if (x + rect.width > window.innerWidth - 8) {
      x = window.innerWidth - rect.width - 8
    }
    if (y + rect.height > window.innerHeight - 8) {
      y = props.y - rect.height
    }
    adjustedPos.value = { x, y }
  },
  { immediate: true }
)

function handleSelect(action) {
  emit('select', action)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx-fade">
      <div v-if="show" class="ctx-overlay" @click.self="emit('close')" @contextmenu.prevent="emit('close')">
        <Transition name="ctx-pop" appear>
          <div
            v-if="show"
            ref="menuRef"
            class="ctx-menu"
            :style="{ left: adjustedPos.x + 'px', top: adjustedPos.y + 'px' }"
            @click.stop
          >
            <template v-for="(item, i) in items" :key="i">
              <div v-if="item.divider" class="ctx-menu__divider"></div>
              <button
                v-else
                class="ctx-menu__item"
                :class="{
                  'ctx-menu__item--active': item.active,
                  'ctx-menu__item--danger': item.danger,
                  'ctx-menu__item--disabled': item.disabled,
                }"
                :disabled="item.disabled"
                @click="!item.disabled && handleSelect(item.action)"
              >
                <span class="ctx-menu__icon">{{ item.icon }}</span>
                <span class="ctx-menu__label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="ctx-menu__shortcut mono">{{ item.shortcut }}</span>
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.ctx-menu {
  position: fixed;
  z-index: 1201;
  min-width: 180px;
  @include glass;
  border: 1px solid $color-border-glow;
  border-radius: $radius-md;
  box-shadow: $shadow-lg, $glow-cyan-soft;
  padding: $sp-1;
  animation: ctx-rise 0.2s $ease-out;

  &__divider {
    height: 1px;
    background: $color-border;
    margin: $sp-1 $sp-2;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-3;
    width: 100%;
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 13px;
    color: $color-text-soft;
    transition: all $t-fast $ease-out;
    text-align: left;

    &:hover:not(:disabled) {
      background: $color-cyan-dim;
      color: $color-cyan-bright;
    }

    &--active {
      color: $color-cyan-bright;
      @include text-glow;
    }

    &--danger {
      color: $color-error;

      &:hover:not(:disabled) {
        background: rgba($color-error, 0.1);
        color: $color-error;
      }
    }

    &--disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &__icon {
    @include flex-center;
    width: 18px;
    height: 18px;
    font-size: 14px;
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
  }

  &__shortcut {
    font-size: 10px;
    color: $color-text-faint;
    letter-spacing: 0.05em;
  }
}

@keyframes ctx-rise {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

// 过渡
.ctx-fade-enter-active,
.ctx-fade-leave-active {
  transition: opacity 0.15s $ease-out;
}
.ctx-fade-enter-from,
.ctx-fade-leave-to {
  opacity: 0;
}

.ctx-pop-enter-active {
  transition: all 0.2s $ease-out;
}
.ctx-pop-leave-active {
  transition: all 0.1s $ease-out;
}
.ctx-pop-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
.ctx-pop-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
