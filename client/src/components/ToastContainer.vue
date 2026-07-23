<script setup>
import { useToast } from '../composables/useToast'

// Toast 通知容器：右上角浮层，点击关闭。
const { toasts, removeToast } = useToast()
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
        @click="removeToast(toast.id)"
      >
        {{ toast.message }}
      </div>
    </transition-group>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.toast-container {
  position: fixed;
  top: 80px;
  right: $sp-6;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s $ease-spring;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
