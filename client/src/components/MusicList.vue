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
})

const emit = defineEmits(['play', 'add-to-playlist'])
</script>

<template>
  <div class="music-list">
    <div v-if="songs.length === 0" class="empty-state">
      <div class="icon">♪</div>
      <div>{{ emptyText }}</div>
    </div>
    <template v-else>
      <MusicItem
        v-for="song in songs"
        :key="song.bvid"
        :song="song"
        @play="emit('play', $event)"
        @add-to-playlist="emit('add-to-playlist', $event)"
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
