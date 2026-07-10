<script setup>
import MusicItem from './MusicItem.vue'

defineProps({
  songs: {
    type: Array,
    default: () => [],
  },
  emptyText: {
    type: String,
    default: '暂无音乐',
  },
  showRemove: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['play', 'add-to-playlist', 'add-to-next', 'remove', 'context-menu'])
</script>

<template>
  <div class="music-list">
    <div v-if="songs.length === 0" class="empty-state">
      <div class="icon">∅</div>
      <div>{{ emptyText }}</div>
    </div>
    <template v-else>
      <MusicItem
        v-for="(song, i) in songs"
        :key="song.bvid"
        :song="song"
        :show-remove="showRemove"
        :style="{ animationDelay: `${i * 0.04}s` }"
        @play="emit('play', $event)"
        @add-to-playlist="emit('add-to-playlist', $event)"
        @add-to-next="emit('add-to-next', $event)"
        @remove="emit('remove', $event)"
        @context-menu="emit('context-menu', $event)"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.music-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
