<script setup>
import { ref } from 'vue'
import { useFavoritesStore } from '../stores/favorites'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'

const favorites = useFavoritesStore()
const player = usePlayerStore()
const { showToast } = useToast()

const showAddModal = ref(false)
const selectedSong = ref(null)

function handlePlay(song) {
  player.setQueue(favorites.items, favorites.items.findIndex((s) => s.bvid === song.bvid))
  showToast(`正在播放：${song.title}`, 'success')
}

function handleAddToPlaylist(song) {
  selectedSong.value = song
  showAddModal.value = true
}
</script>

<template>
  <div class="favorites-view">
    <h2 class="page-title">收藏列表</h2>

    <div v-if="favorites.items.length > 0" class="favorites-view__count">
      共 {{ favorites.items.length }} 首歌曲
    </div>

    <MusicList
      :songs="favorites.items"
      empty-text="还没有收藏任何歌曲，去搜索添加吧"
      @play="handlePlay"
      @add-to-playlist="handleAddToPlaylist"
    />

    <AddToPlaylistModal
      :show="showAddModal"
      :song="selectedSong"
      @close="showAddModal = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.favorites-view {
  max-width: 800px;
  margin: 0 auto;

  &__count {
    color: $color-text-secondary;
    font-size: 13px;
    margin-bottom: $spacing-md;
  }
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: $spacing-lg;
  color: $color-text-primary;
}
</style>
