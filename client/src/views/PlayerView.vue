<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'

const player = usePlayerStore()
const { showToast } = useToast()

const showAddModal = ref(false)
const selectedSong = ref(null)

const queue = computed(() => player.playQueue)

function handlePlay(song) {
  player.play(song)
}

function handleAddToPlaylist(song) {
  selectedSong.value = song
  showAddModal.value = true
}
</script>

<template>
  <div class="player-view">
    <h2 class="page-title">播放器</h2>

    <div v-if="player.currentSong" class="player-view__current">
      <img :src="player.currentSong.cover" class="player-view__cover" alt="封面" />
      <div class="player-view__info">
        <h3 class="player-view__title">{{ player.currentSong.title }}</h3>
        <p class="player-view__author">{{ player.currentSong.author }}</p>
        <div class="player-view__status">
          <span v-if="player.isLoading">加载中...</span>
          <span v-else-if="player.error" class="player-view__error">{{ player.error }}</span>
          <span v-else-if="player.isPlaying" class="player-view__playing">
            <span class="player-view__pulse"></span>
            播放中
          </span>
          <span v-else>已暂停</span>
        </div>
      </div>
    </div>

    <div v-if="player.error" class="player-view__error-banner">
      {{ player.error }}
      <button @click="player.play(player.currentSong)" class="player-view__retry">重试</button>
    </div>

    <div class="player-view__queue">
      <h3 class="player-view__queue-title">播放队列 ({{ queue.length }} 首)</h3>
      <MusicList
        :songs="queue"
        empty-text="播放队列为空，去搜索添加歌曲吧"
        @play="handlePlay"
        @add-to-playlist="handleAddToPlaylist"
      />
    </div>

    <AddToPlaylistModal
      :show="showAddModal"
      :song="selectedSong"
      @close="showAddModal = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.player-view {
  max-width: 800px;
  margin: 0 auto;

  &__current {
    display: flex;
    gap: $spacing-lg;
    margin-bottom: $spacing-xl;
  }

  &__cover {
    width: 160px;
    height: 160px;
    border-radius: $radius-md;
    object-fit: cover;
    box-shadow: $shadow-md;
  }

  &__info {
    flex: 1;
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: $spacing-sm;
  }

  &__author {
    color: $color-text-secondary;
    font-size: 14px;
    margin-bottom: $spacing-md;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    color: $color-text-secondary;
    font-size: 13px;
  }

  &__playing {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    color: $color-accent;
  }

  &__pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $color-accent;
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__error {
    color: $color-error;
  }

  &__error-banner {
    @include flex-center;
    gap: $spacing-md;
    padding: $spacing-md;
    background: rgba($color-error, 0.1);
    border: 1px solid $color-error;
    border-radius: $radius-md;
    color: $color-error;
    margin-bottom: $spacing-lg;
  }

  &__retry {
    padding: 4px 12px;
    border: 1px solid $color-error;
    border-radius: $radius-sm;
    color: $color-error;
    font-size: 12px;

    &:hover {
      background: $color-error;
      color: $color-bg-primary;
    }
  }

  &__queue {
    margin-top: $spacing-lg;
  }

  &__queue-title {
    font-size: 16px;
    color: $color-text-primary;
    margin-bottom: $spacing-md;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}
</style>
