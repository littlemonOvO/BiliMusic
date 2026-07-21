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
      <div class="player-view__stage">
        <div class="player-view__cover-wrap">
          <div class="player-view__disc" :class="{ 'is-spinning': player.isPlaying }">
            <img
              :src="getImageUrl(player.currentSong.cover)"
              class="player-view__cover"
              alt="封面"
            />
            <div class="player-view__cd-grooves"></div>
          </div>
          <div class="player-view__cd-hole"></div>
          <div v-if="player.isPlaying" class="player-view__cover-glow"></div>
        </div>
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
}

.page-title {
  font-family: $font-mono;
  font-size: 11px;
  font-weight: 400;
  color: $color-text-faint;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  margin-bottom: $sp-8;
  padding-left: $sp-1;
}

.player-view__current {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-8;
  margin-bottom: $sp-12;
  animation: riseIn 0.5s $ease-out;
}

.player-view__stage {
  position: relative;
  padding: $sp-6 0;

  // 舞台聚光氛围：CD 后方的径向光晕，营造"舞台聚光灯"纵深感
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(34, 211, 238, 0.08) 0%,
      rgba(34, 211, 238, 0.03) 40%,
      transparent 70%
    );
    pointer-events: none;
    z-index: 0;
  }
}

.player-view__cover-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  z-index: 1;
}

.player-view__disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  animation: cdSpin 24s linear infinite;
  animation-play-state: paused;
  will-change: transform;

  &.is-spinning {
    animation-play-state: running;
  }
}

.player-view__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// CD 同心圆纹路叠加
.player-view__cd-grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background: repeating-radial-gradient(
    circle at center,
    transparent 0,
    transparent 4px,
    rgba(0, 0, 0, 0.18) 4px,
    rgba(0, 0, 0, 0.18) 5px
  );
  mix-blend-mode: overlay;
}

// CD 中心主轴孔
.player-view__cd-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: $color-void;
  border: 1px solid $color-cyan-deep;
  box-shadow: $glow-cyan-soft, inset 0 0 8px rgba(0, 0, 0, 0.9);
  z-index: 2;
  pointer-events: none;

  // 主轴孔中心的小亮点
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan-bright;
    box-shadow: $glow-cyan;
  }
}

.player-view__cover-glow {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid $color-cyan-bright;
  box-shadow: $glow-cyan;
  // 仅动画 opacity，避免无限 transform 动画在长时间播放后触发合成器层漂移
  animation: glowPulse 2s ease-in-out infinite;
  pointer-events: none;
}

.player-view__info {
  flex: 1;
  min-width: 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-2;
}

.player-view__title {
  font-family: $font-display;
  font-size: 26px;
  font-weight: 600;
  color: $color-text;
  line-height: 1.3;
  max-width: 560px;
  word-break: break-word;
}

.player-view__author {
  color: $color-text-mute;
  font-size: 15px;
}

.player-view__status {
  display: flex;
  align-items: center;
  gap: $sp-2;
  color: $color-text-mute;
  font-size: 11px;
  letter-spacing: 0.2em;
  margin-top: $sp-2;
}

.player-view__playing {
  display: flex;
  align-items: center;
  gap: $sp-2;
  color: $color-cyan-bright;
  @include text-glow;
}

.player-view__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-cyan-bright;
  box-shadow: $glow-cyan;
  animation: pulse 1.5s ease-in-out infinite;
}

.player-view__error {
  color: $color-error;
}

.player-view__error-banner {
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

.player-view__retry {
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

.player-view__queue {
  margin-top: $sp-4;
  padding-top: $sp-8;
  border-top: 1px solid $color-border;
}

.player-view__queue-title {
  font-family: $font-display;
  font-size: 16px;
  color: $color-text;
  margin-bottom: $sp-4;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

// 封面发光脉冲：仅 opacity，不使用 transform，避免长时间播放后合成器漂移
@keyframes glowPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

// CD 缓速旋转
@keyframes cdSpin {
  to { transform: rotate(360deg); }
}
</style>
