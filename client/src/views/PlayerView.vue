<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import { getImageUrl } from '../api'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'

const player = usePlayerStore()
const { showToast } = useToast()

const showAddModal = ref(false)
const selectedSong = ref(null)

const queue = computed(() => player.playQueue)

function handlePlay(song) {
  player.playIndex(queue.value.findIndex((s) => s.bvid === song.bvid))
  showToast(`正在播放：${song.title}`, 'success')
}

function handleAddToNext(song) {
  if (player.insertNext(song)) {
    showToast(`已添加到下一首：${song.title}`, 'success')
  } else {
    showToast('该歌曲已在播放列表中', 'info')
  }
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
      <div class="player-view__cover-wrap">
        <img
          :src="getImageUrl(player.currentSong.cover)"
          class="player-view__cover"
          alt="封面"
        />
        <div v-if="player.isPlaying" class="player-view__cover-glow"></div>
      </div>
      <div class="player-view__info">
        <h3 class="player-view__title">{{ player.currentSong.title }}</h3>
        <p class="player-view__author">{{ player.currentSong.author }}</p>
        <div class="player-view__status mono">
          <span v-if="player.isLoading">LOADING...</span>
          <span v-else-if="player.error" class="player-view__error">{{ player.error }}</span>
          <span v-else-if="player.isPlaying" class="player-view__playing">
            <span class="player-view__pulse"></span>
            STREAMING
          </span>
          <span v-else>STANDBY</span>
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
        @add-to-next="handleAddToNext"
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
  max-width: 860px;
  margin: 0 auto;

  &__current {
    display: flex;
    gap: $sp-6;
    margin-bottom: $sp-8;
    animation: riseIn 0.5s $ease-out;
  }

  &__cover-wrap {
    position: relative;
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }

  &__cover {
    width: 100%;
    height: 100%;
    border-radius: $radius-md;
    object-fit: cover;
    border: 1px solid $color-border;
  }

  &__cover-glow {
    position: absolute;
    inset: -2px;
    border-radius: $radius-md;
    border: 1px solid $color-cyan-bright;
    box-shadow: $glow-cyan;
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-display;
    font-size: 22px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: $sp-2;
  }

  &__author {
    color: $color-text-mute;
    font-size: 14px;
    margin-bottom: $sp-4;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: $sp-2;
    color: $color-text-mute;
    font-size: 11px;
    letter-spacing: 0.2em;
  }

  &__playing {
    display: flex;
    align-items: center;
    gap: $sp-2;
    color: $color-cyan-bright;
    @include text-glow;
  }

  &__pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $color-cyan-bright;
    box-shadow: $glow-cyan;
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__error {
    color: $color-error;
  }

  &__error-banner {
    @include flex-center;
    gap: $sp-4;
    padding: $sp-4;
    background: rgba($color-error, 0.1);
    border: 1px solid rgba($color-error, 0.4);
    border-radius: $radius-sm;
    color: $color-error;
    margin-bottom: $sp-6;
    font-size: 13px;
  }

  &__retry {
    padding: $sp-1 $sp-3;
    border: 1px solid $color-error;
    border-radius: $radius-sm;
    color: $color-error;
    font-size: 12px;
    transition: all $t-fast;

    &:hover {
      background: $color-error;
      color: $color-void;
    }
  }

  &__queue {
    margin-top: $sp-8;
  }

  &__queue-title {
    font-family: $font-display;
    font-size: 16px;
    color: $color-text;
    margin-bottom: $sp-4;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
</style>
