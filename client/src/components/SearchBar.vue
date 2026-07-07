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
  gap: $spacing-sm;
  max-width: 600px;
  margin: 0 auto;

  &__input {
    flex: 1;
    padding: 12px 16px;
    background: $color-bg-secondary;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    color: $color-text-primary;
    font-size: 14px;
    outline: none;
    transition: all $transition-normal;

    &::placeholder {
      color: $color-text-secondary;
    }

    &:focus {
      border-color: $color-accent;
      box-shadow: 0 0 0 2px $color-accent-dim;
    }
  }

  &__btn {
    padding: 12px 24px;
    background: $color-accent;
    color: $color-bg-primary;
    border-radius: $radius-md;
    font-size: 14px;
    font-weight: 500;
    transition: all $transition-normal;

    &:hover {
      background: $color-accent-dark;
    }
  }
}
</style>
