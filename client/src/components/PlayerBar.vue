<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useFavoritesStore } from '../stores/favorites'
import { useAudio } from '../composables/useAudio'
import { getImageUrl } from '../api'
import QueuePanel from './QueuePanel.vue'
import AddToPlaylistMenu from './AddToPlaylistMenu.vue'

// 播放栏：当前播放卡片 / 控制中枢 / 进度+音量+辅助操作。
// 持有 <audio> 元素（useAudio）、播放队列面板、"添加到歌单"下拉菜单。
const player = usePlayerStore()
const favorites = useFavoritesStore()
const {
  audioRef,
  handleAudioError,
  handleSeek,
  onAudioPlay,
  onAudioPause,
  onAudioPlaying,
  onAudioEnded,
  onAudioWaiting,
  onAudioTimeUpdate,
  onAudioLoadedMetadata,
} = useAudio()

const showQueuePanel = ref(false)
const showPlaylistMenu = ref(false)
const playlistMenuPos = ref({ x: 0, y: 0 })

function closeQueuePanel() {
  showQueuePanel.value = false
  showPlaylistMenu.value = false
  player.flushEmpty()
}

function togglePlaylistMenu(event) {
  if (showPlaylistMenu.value) {
    showPlaylistMenu.value = false
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  playlistMenuPos.value = {
    x: rect.left,
    y: rect.top - 8,
  }
  showPlaylistMenu.value = true
}

function closePlaylistMenu() {
  showPlaylistMenu.value = false
}

// 点击页面任意处关闭"添加到歌单"菜单（触发按钮容器与菜单自身用 @click.stop 阻止冒泡，
// 与原 .app-layout @click 等价）。
onMounted(() => document.addEventListener('click', closePlaylistMenu))
onUnmounted(() => document.removeEventListener('click', closePlaylistMenu))

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// 滑块填充百分比 -- 用于 CSS 变量渲染已播放段
const progressPct = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100))
})
const volumePct = computed(() => Math.min(100, Math.max(0, player.volume * 100)))

const bars = Array.from({ length: 32 }, (_, i) => i)
</script>

<template>
  <footer class="player-bar" :class="{ 'player-bar--hidden': !player.currentSong }">
    <!-- 顶部进度光带：贯穿播放栏上沿，作为信号流动指示 -->
    <div class="player-bar__topline">
      <div
        class="player-bar__topline-fill"
        :style="{ width: (player.duration ? (player.currentTime / player.duration * 100) : 0) + '%' }"
      ></div>
    </div>

    <div class="player-bar__inner">
      <!-- 区域 A · 当前播放卡片 -->
      <div class="player-bar__zone player-bar__zone--now">
        <div class="player-bar__cover-wrap">
          <div class="player-bar__disc" :class="{ 'is-spinning': player.isPlaying }">
            <img
              v-if="player.currentSong"
              :src="getImageUrl(player.currentSong.cover)"
              class="player-bar__cover"
              alt="cover"
            />
            <span v-else class="player-bar__cover player-bar__cover--idle">◌</span>
          </div>
          <div class="player-bar__cd-hole"></div>
          <div v-if="player.isPlaying" class="player-bar__cover-glow"></div>
        </div>
        <div class="player-bar__meta">
          <div class="player-bar__title text-ellipsis" :title="player.currentSong ? player.currentSong.title : ''">{{ player.currentSong ? player.currentSong.title : 'NO SIGNAL' }}</div>
          <div class="player-bar__author text-ellipsis" :title="player.currentSong ? player.currentSong.author : ''">
            {{ player.currentSong ? player.currentSong.author : '- -' }}
          </div>
        </div>
      </div>

      <!-- 区域 B · 控制中枢 -->
      <div class="player-bar__zone player-bar__zone--ctrl">
        <div class="player-bar__wave" :class="{ active: player.isPlaying }">
          <span
            v-for="(b, i) in bars"
            :key="i"
            class="player-bar__wave-bar"
            :style="{ animationDelay: `${i * 0.04}s` }"
          ></span>
        </div>
        <div class="player-bar__controls">
          <button
            class="player-bar__btn"
            @click="player.playPrev"
            :disabled="player.playQueue.length <= 1"
            title="上一首"
          >
            ⏮
          </button>
          <button class="player-bar__btn player-bar__btn--play" @click="player.togglePlay">
            {{ player.isPlaying ? '❚❚' : '▶' }}
          </button>
          <button
            class="player-bar__btn"
            @click="player.playNext"
            :disabled="player.playQueue.length <= 1"
            title="下一首"
          >
            ⏭
          </button>
        </div>
      </div>

      <!-- 区域 C · 辅助操作 -->
      <div class="player-bar__zone player-bar__zone--aside">
        <div class="player-bar__progress">
          <span class="player-bar__time mono">{{ formatTime(player.currentTime) }}</span>
          <input
            type="range"
            class="player-bar__slider"
            min="0"
            :max="player.duration || 100"
            :value="player.currentTime"
            :style="{ '--p': progressPct + '%' }"
            @input="handleSeek"
          />
          <span class="player-bar__time mono">{{ formatTime(player.duration) }}</span>
        </div>

        <div class="player-bar__actions">
          <button
            v-if="player.currentSong"
            class="player-bar__chip"
            :class="{ 'player-bar__chip--fav-active': favorites.isFavorite(player.currentSong.bvid) }"
            @click="favorites.toggle(player.currentSong)"
            :title="favorites.isFavorite(player.currentSong.bvid) ? '取消收藏' : '收藏'"
          >
            ♥
          </button>

          <div v-if="player.currentSong" class="player-bar__playlist-wrap" @click.stop>
            <button
              class="player-bar__chip"
              :class="{ 'player-bar__chip--active': showPlaylistMenu }"
              @click="togglePlaylistMenu($event)"
              title="添加到歌单"
            >
              ♪
            </button>
          </div>

          <div class="player-bar__volume">
            <button
              class="player-bar__volume-icon"
              @click="player.toggleMute"
              :title="player.volume === 0 ? '取消静音' : '静音'"
            >
              <svg v-if="player.volume > 0" class="player-bar__volume-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <svg v-else class="player-bar__volume-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            </button>
            <input
              type="range"
              class="player-bar__slider player-bar__slider--volume"
              min="0"
              max="1"
              step="0.01"
              :value="player.volume"
              :style="{ '--p': volumePct + '%' }"
              @input="player.setVolume(Number($event.target.value))"
            />
          </div>

          <button
            class="player-bar__chip player-bar__chip--queue"
            :class="{ 'player-bar__chip--active': showQueuePanel }"
            @click="showQueuePanel = !showQueuePanel"
            title="播放队列"
          >
            ☰
            <span class="player-bar__queue-badge mono">{{ player.playQueue.length }}</span>
          </button>
        </div>
      </div>
    </div>
  </footer>

  <QueuePanel v-if="showQueuePanel" :show="true" @close="closeQueuePanel" />

  <AddToPlaylistMenu
    :show="showPlaylistMenu && !!player.currentSong"
    :song="player.currentSong"
    :x="playlistMenuPos.x"
    :y="playlistMenuPos.y"
    @close="closePlaylistMenu"
  />

  <audio
    v-if="player.currentSong?.audioStreamUrl"
    ref="audioRef"
    :src="player.currentSong.audioStreamUrl"
    @timeupdate="onAudioTimeUpdate"
    @loadedmetadata="onAudioLoadedMetadata"
    @play="onAudioPlay"
    @pause="onAudioPause"
    @playing="onAudioPlaying"
    @ended="onAudioEnded"
    @error="handleAudioError"
    @waiting="onAudioWaiting"
  ></audio>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

// ---------- PLAYER BAR ----------
.player-bar {
  position: relative;
  height: $player-height;
  flex-shrink: 0;
  @include glass;
  border-top: 1px solid $color-border;
  overflow: hidden;
  transition: height 0.4s $ease-out, opacity 0.3s $ease-out, padding 0.4s $ease-out, border-color 0.3s;

  &--hidden {
    height: 0;
    opacity: 0;
    padding: 0;
    border-color: transparent;
    pointer-events: none;
  }

  // 顶部进度光带 -- 贯穿上沿，信号流指示
  &__topline {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba($color-cyan-bright, 0.06);
    z-index: 3;
    pointer-events: none;
  }

  &__topline-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-magenta, $color-cyan-bright);
    box-shadow: 0 0 10px rgba(var(--cyan-glow-rgb), 0.6);
    transition: width 0.2s linear;
  }

  &__inner {
    display: flex;
    align-items: stretch;
    height: 100%;
    width: 100%;
    padding: 0 $sp-6;
    gap: 0;
  }

  // 三个分区用统一的竖向分隔线
  &__zone {
    display: flex;
    align-items: center;
    height: 100%;

    &--now {
      width: 248px;
      flex-shrink: 0;
      gap: $sp-3;
      padding-right: $sp-5;
    }

    &--ctrl {
      flex-direction: column;
      justify-content: center;
      gap: $sp-1;
      padding: 0 $sp-6;
      border-left: 1px solid $color-border;
      border-right: 1px solid $color-border;
      flex-shrink: 0;
    }

    &--aside {
      flex: 1;
      min-width: 0;
      flex-direction: column;
      justify-content: center;
      gap: $sp-1;
      padding-left: $sp-5;
    }
  }

  // 当前播放卡片
  &__cover-wrap {
    position: relative;
    width: 54px;
    height: 54px;
    flex-shrink: 0;
  }

  &__disc {
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

  &__cover {
    width: 100%;
    height: 100%;
    object-fit: cover;

    &--idle {
      @include flex-center;
      color: $color-text-faint;
      font-family: $font-mono;
      font-size: 20px;
      background: $color-surface-2;
    }
  }

  // CD 中心主轴孔
  &__cd-hole {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: $color-void;
    border: 1px solid $color-cyan-deep;
    box-shadow: $glow-cyan-soft, inset 0 0 4px rgba(0, 0, 0, 0.9);
    z-index: 2;
    pointer-events: none;
  }

  &__cover-glow {
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 1px solid $color-cyan-bright;
    box-shadow: $glow-cyan;
    // 仅动画 opacity，避免无限 transform 动画在长时间播放后触发合成器层漂移
    animation: glowPulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    color: $color-text;
    margin-bottom: 2px;
    letter-spacing: 0.02em;
  }

  &__author {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.05em;
    color: $color-text-mute;
  }

  // 均衡器波形
  &__wave {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    height: 18px;
    width: 150px;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity $t-normal;

    &.active {
      opacity: 1;

      .player-bar__wave-bar {
        animation-play-state: running;
        opacity: 1;
      }
    }
  }

  &__wave-bar {
    flex: 1;
    min-width: 2px;
    max-width: 4px;
    background: linear-gradient(180deg, $color-cyan-bright, $color-cyan-deep);
    border-radius: $radius-pill;
    height: 30%;
    opacity: 0.4;
    animation: waveDance 1.2s ease-in-out infinite;
    animation-play-state: paused;
  }

  // 控制按钮
  &__controls {
    display: flex;
    align-items: center;
    gap: $sp-3;
  }

  &__btn {
    @include flex-center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: $color-text-soft;
    font-size: 12px;
    transition: all $t-normal $ease-out;
    border: 1px solid transparent;

    &:hover:not(:disabled) {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      box-shadow: $glow-cyan-soft;
    }

    &:active:not(:disabled) {
      transform: scale(0.94);
    }

    &:disabled {
      opacity: 0.2;
      cursor: not-allowed;
    }

    &--play {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
      color: $color-void;
      font-size: 14px;
      font-weight: 700;
      box-shadow: $glow-cyan;
      border: none;

      &:hover:not(:disabled) {
        transform: scale(1.06);
        box-shadow: $glow-cyan, 0 0 32px rgba(var(--cyan-glow-rgb), 0.45);
        border: none;
      }

      &:active:not(:disabled) {
        transform: scale(0.98);
      }
    }
  }

  // 进度区
  &__progress {
    display: flex;
    align-items: center;
    gap: $sp-3;
    width: 100%;
  }

  &__time {
    color: $color-text-mute;
    font-size: 10px;
    min-width: 36px;
    letter-spacing: 0.05em;

    &:first-child { text-align: right; }
    &:last-child { text-align: left; }
  }

  &__slider {
    flex: 1;
    appearance: none;
    -webkit-appearance: none;
    height: 16px;
    background: transparent;
    cursor: pointer;

    // 轨道（Webkit）
    &::-webkit-slider-runnable-track {
      height: 2px;
      border-radius: $radius-pill;
      background:
        linear-gradient(to right,
          $color-cyan-bright 0%,
          $color-cyan-bright var(--p, 0%),
          $color-surface-2 var(--p, 0%),
          $color-surface-2 100%);
      box-shadow: 0 0 0 1px $color-border;
    }

    // 拖把（Webkit）
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -5px;
      border-radius: 50%;
      background: $color-cyan-bright;
      border: 2px solid $color-void;
      box-shadow: $glow-cyan;
      transition: transform $t-normal $ease-spring, box-shadow $t-normal;
    }

    &:hover::-webkit-slider-thumb {
      transform: scale(1.25);
      box-shadow: $glow-cyan, 0 0 16px rgba(var(--cyan-glow-rgb), 0.6);
    }

    &:active::-webkit-slider-thumb {
      transform: scale(1.4);
    }

    // 轨道（Firefox）
    &::-moz-range-track {
      height: 2px;
      border-radius: $radius-pill;
      background: $color-surface-2;
      box-shadow: 0 0 0 1px $color-border;
    }

    &::-moz-range-progress {
      height: 2px;
      border-radius: $radius-pill;
      background: $color-cyan-bright;
    }

    &::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: $color-cyan-bright;
      border: 2px solid $color-void;
      box-shadow: $glow-cyan;
      cursor: pointer;
      transition: transform $t-normal $ease-spring, box-shadow $t-normal;
    }

    &:hover::-moz-range-thumb {
      transform: scale(1.25);
      box-shadow: $glow-cyan, 0 0 16px rgba(var(--cyan-glow-rgb), 0.6);
    }

    &:active::-moz-range-thumb {
      transform: scale(1.4);
    }

    &:focus-visible {
      outline: none;

      &::-webkit-slider-thumb {
        box-shadow: $glow-cyan, 0 0 0 3px rgba(var(--cyan-glow-rgb), 0.2);
      }
      &::-moz-range-thumb {
        box-shadow: $glow-cyan, 0 0 0 3px rgba(var(--cyan-glow-rgb), 0.2);
      }
    }

    // 音量条：洋红 -> 青色渐变填充，更细
    &--volume {
      flex: 0;
      width: 70px;

      &::-webkit-slider-runnable-track {
        background:
          linear-gradient(to right,
            $color-magenta 0%,
            $color-cyan-bright var(--p, 0%),
            $color-surface-2 var(--p, 0%),
            $color-surface-2 100%);
      }

      &::-moz-range-progress {
        background: linear-gradient(to right, $color-magenta, $color-cyan-bright);
      }
    }
  }

  // 辅助按钮组（芯片风）
  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $sp-2;
    width: 100%;
  }

  &__chip {
    position: relative;
    @include flex-center;
    width: 30px;
    height: 26px;
    border-radius: $radius-xs;
    color: $color-text-mute;
    font-size: 14px;
    flex-shrink: 0;
    transition: all $t-normal $ease-out;
    border: 1px solid $color-border;
    background: transparent;

    &:hover {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
    }

    &--active {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
      @include text-glow;
    }

    &--fav-active {
      color: $color-magenta;
      border-color: rgba($color-magenta, 0.4);
      background: $color-magenta-dim;
      @include text-glow($color-magenta);
    }

    &--queue {
      width: 34px;
    }
  }

  &__playlist-wrap {
    position: relative;
    flex-shrink: 0;
  }

  &__volume {
    display: flex;
    align-items: center;
    gap: $sp-1;
    flex-shrink: 0;
    padding-left: $sp-1;
    border-left: 1px solid $color-border;
  }

  &__volume-icon {
    @include flex-center;
    width: 26px;
    height: 26px;
    color: $color-text-mute;
    flex-shrink: 0;
    transition: color $t-fast;

    &:hover {
      color: $color-cyan-bright;
    }
  }

  &__volume-svg {
    width: 14px;
    height: 14px;
  }

  &__queue-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 15px;
    height: 15px;
    @include flex-center;
    padding: 0 3px;
    background: $color-cyan-bright;
    color: $color-void;
    border-radius: $radius-pill;
    font-size: 8px;
    font-weight: 700;
    box-shadow: $glow-cyan-soft;
  }
}

@keyframes waveDance {
  0%, 100% { height: 25%; }
  50% { height: 95%; }
}

// CD 缓速旋转
@keyframes cdSpin {
  to { transform: rotate(360deg); }
}

// 封面发光脉冲：仅 opacity，不使用 transform，避免长时间播放后合成器漂移
@keyframes glowPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

// Responsive
@media (max-width: 900px) {
  .player-bar__zone--ctrl {
    padding: 0 $sp-3;
  }
  .player-bar__zone--now {
    width: 180px;
  }
  .player-bar__wave {
    width: 90px;
  }
}

@media (max-width: 640px) {
  .player-bar__zone--now {
    width: 140px;
  }
  .player-bar__wave {
    display: none;
  }
}
</style>
