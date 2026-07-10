<script setup>
import { ref } from 'vue'

const emit = defineEmits(['search'])
const keyword = ref('')

function handleSearch() {
  if (keyword.value.trim()) {
    emit('search', keyword.value.trim())
  }
}
</script>

<template>
  <div class="search-bar">
    <input
      v-model="keyword"
      type="text"
      class="search-bar__input"
      placeholder="搜索 Bilibili 音乐..."
      @keyup.enter="handleSearch"
    />
    <button class="search-bar__btn" @click="handleSearch">
      搜索
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.search-bar {
  display: flex;
  gap: $sp-2;
  max-width: 600px;
  margin: 0 auto;
  position: relative;

  &__input {
    flex: 1;
    padding: $sp-3 $sp-4;
    background: $color-surface-1;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    color: $color-text;
    font-size: 14px;
    outline: none;
    transition: all $t-normal;

    &::placeholder {
      color: $color-text-mute;
    }

    &:focus {
      border-color: $color-cyan-bright;
      box-shadow: 0 0 0 2px $color-cyan-dim, $glow-cyan-soft;
    }
  }

  &__btn {
    padding: $sp-3 $sp-6;
    background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
    color: $color-void;
    border-radius: $radius-md;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.05em;
    transition: all $t-normal;
    box-shadow: $glow-cyan-soft;

    &:hover {
      box-shadow: $glow-cyan;
      transform: translateX(2px);
    }
  }
}
</style>
