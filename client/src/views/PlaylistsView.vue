<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistsStore } from '../stores/playlists'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import { useSongContextMenu } from '../composables/useSongContextMenu'
import { getImageUrl } from '../api'
import MusicList from '../components/MusicList.vue'
import PlaylistModal from '../components/PlaylistModal.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ContextMenu from '../components/ContextMenu.vue'
import RenameDialog from '../components/RenameDialog.vue'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const player = usePlayerStore()
const { showToast } = useToast()

const showCreateModal = ref(false)

// 确认删除弹窗
const showDeleteDialog = ref(false)
// 歌单重命名弹窗
const showRenameModal = ref(false)
const renameTarget = ref(null)

const playlistId = computed(() => route.params.id)
const currentPlaylist = computed(() => {
  if (playlistId.value) {
    return playlists.getPlaylist(playlistId.value)
  }
  return null
})

function handlePlay(song) {
  if (currentPlaylist.value) {
    const songs = currentPlaylist.value.songs
    player.setQueue(songs, songs.findIndex((s) => s.bvid === song.bvid))
    showToast(`正在播放：${song.title}`, 'success')
  } else {
    player.play(song)
  }
}

function handlePlayPlaylist() {
  if (!currentPlaylist.value || currentPlaylist.value.songs.length === 0) {
    showToast('歌单为空', 'info')
    return
  }
  player.playPlaylist(currentPlaylist.value.songs)
  showToast(`正在播放歌单：${currentPlaylist.value.name}`, 'success')
}

function handleAddToQueue() {
  if (!currentPlaylist.value || currentPlaylist.value.songs.length === 0) {
    showToast('歌单为空', 'info')
    return
  }
  const added = player.addToQueue(currentPlaylist.value.songs)
  if (added === 0) {
    showToast('歌曲已全部在播放列表中', 'info')
  } else {
    showToast(`已将 ${added} 首歌曲加入播放列表`, 'success')
  }
}

function handleRemoveSong(song) {
  if (currentPlaylist.value) {
    playlists.removeFromPlaylist(currentPlaylist.value.id, song.bvid)
    showToast(`已从歌单移除：${song.title}`, 'success')
  }
}

// 打开删除确认弹窗
function handleDeleteClick() {
  showDeleteDialog.value = true
}

// 确认删除
function confirmDelete() {
  if (currentPlaylist.value) {
    const name = currentPlaylist.value.name
    playlists.deletePlaylist(currentPlaylist.value.id)
    showToast(`歌单「${name}」已删除`, 'success')
    showDeleteDialog.value = false
    router.push('/playlists')
  }
}

// 打开歌单重命名弹窗
function handleRenameClick() {
  renameTarget.value = currentPlaylist.value
  showRenameModal.value = true
}

// 右键菜单（含歌曲重命名 / 从歌单移除）
// 注：歌单级 renameTarget 与歌曲级 songRenameTarget（来自组合式）刻意区分命名
const {
  ctxMenu,
  ctxItems,
  openContextMenu,
  handleCtxAction,
  addToNext,
  addToPlaylist,
  showAddModal,
  selectedSong,
  showRenameDialog,
  renameTarget: songRenameTarget,
  handleRename,
} = useSongContextMenu({
  onPlay: handlePlay,
  onRemove: handleRemoveSong,
  removeLabel: '从歌单移除',
  canRename: true,
})
</script>

<template>
  <div class="playlists-view">
    <!-- DETAIL -->
    <template v-if="currentPlaylist">
      <div class="playlists-view__header">
        <button class="playlists-view__back" @click="router.push('/playlists')">
          ← 返回
        </button>
        <h2 class="page-title">{{ currentPlaylist.name }}</h2>
        <div class="playlists-view__header-actions">
          <button class="playlists-view__rename" @click="handleRenameClick">
            ✎ 重命名
          </button>
          <button class="playlists-view__delete" @click="handleDeleteClick">
            删除歌单
          </button>
        </div>
      </div>

      <div class="playlists-view__meta mono">
        <span class="playlists-view__meta-num">{{ currentPlaylist.songs.length }}</span>
        <span class="playlists-view__meta-label">TRACKS</span>
        <div class="playlists-view__meta-actions">
          <button
            class="playlists-view__action playlists-view__action--primary"
            :disabled="currentPlaylist.songs.length === 0"
            @click="handlePlayPlaylist"
          >
            <span>▶</span> 播放歌单
          </button>
          <button
            class="playlists-view__action"
            :disabled="currentPlaylist.songs.length === 0"
            @click="handleAddToQueue"
          >
            <span>＋</span> 加入播放列表
          </button>
        </div>
      </div>

      <MusicList
        :songs="currentPlaylist.songs"
        :show-remove="true"
        empty-text="歌单为空，去搜索添加歌曲吧"
        @play="handlePlay"
        @add-to-playlist="addToPlaylist"
        @add-to-next="addToNext"
        @remove="handleRemoveSong"
        @context-menu="openContextMenu"
      />
    </template>

    <!-- LIST -->
    <template v-else>
      <div class="playlists-view__header">
        <h2 class="page-title">歌单</h2>
        <button class="playlists-view__create" @click="showCreateModal = true">
          <span>+</span> 创建歌单
        </button>
      </div>

      <div v-if="playlists.playlists.length === 0" class="playlists-view__empty">
        <div class="playlists-view__empty-icon">☰</div>
        <h3 class="playlists-view__empty-title">还没有歌单</h3>
        <p class="playlists-view__empty-text">创建歌单来整理你喜欢的音乐</p>
        <button class="playlists-view__create-btn" @click="showCreateModal = true">
          创建第一个歌单 <span>-></span>
        </button>
      </div>

      <div v-else class="playlists-view__grid">
        <div
          v-for="(p, i) in playlists.playlists"
          :key="p.id"
          class="playlist-card"
          :style="{ animationDelay: `${i * 0.06}s` }"
          @click="router.push(`/playlists/${p.id}`)"
        >
          <div class="playlist-card__cover">
            <img
              v-if="p.songs.length > 0"
              :src="getImageUrl(p.songs[0].cover)"
              alt="cover"
            />
            <div v-else class="playlist-card__placeholder">
              <span>♪</span>
            </div>
            <div class="playlist-card__overlay">
              <span>-></span>
            </div>
          </div>
          <div class="playlist-card__info">
            <div class="playlist-card__name text-ellipsis">{{ p.name }}</div>
            <div class="playlist-card__count mono">
              {{ String(p.songs.length).padStart(2, '0') }} TRACKS
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 弹窗 -->
    <PlaylistModal :show="showCreateModal" @close="showCreateModal = false" />
    <PlaylistModal
      :show="showRenameModal"
      :playlist="renameTarget"
      @close="showRenameModal = false"
    />
    <AddToPlaylistModal
      :show="showAddModal"
      :song="selectedSong"
      @close="showAddModal = false"
    />
    <ConfirmDialog
      :show="showDeleteDialog"
      title="删除歌单"
      :message="`确定要删除歌单「${currentPlaylist?.name || ''}」吗？此操作不可撤销。`"
      confirm-text="删除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
    <ContextMenu
      :show="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @select="handleCtxAction"
      @close="ctxMenu.show = false"
    />
    <RenameDialog
      :show="showRenameDialog"
      title="重命名歌曲"
      :initial-value="songRenameTarget?.title || ''"
      @confirm="handleRename"
      @cancel="showRenameDialog = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.playlists-view {
  max-width: 920px;
  margin: 0 auto;

  &__header {
    display: flex;
    align-items: center;
    gap: $sp-4;
    margin-bottom: $sp-6;
  }

  &__header-actions {
    margin-left: auto;
    display: flex;
    gap: $sp-3;
  }

  &__back {
    font-family: $font-display;
    font-size: 13px;
    color: $color-text-mute;
    transition: all $t-normal;
    padding: $sp-2 $sp-3;
    border-radius: $radius-sm;

    &:hover {
      color: $color-cyan-bright;
      background: $color-surface-2;
    }
  }

  &__rename {
    padding: $sp-2 $sp-4;
    border: 1px solid $color-border;
    color: $color-text-mute;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 12px;
    transition: all $t-normal;

    &:hover {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $sp-2;
    font-size: 12px;
    color: $color-text-mute;
    letter-spacing: 0.2em;
    margin-bottom: $sp-6;
  }

  &__meta-num {
    font-size: 20px;
    color: $color-cyan-bright;
    font-weight: 500;
    @include text-glow;
  }

  &__meta-actions {
    margin-left: auto;
    display: flex;
    gap: $sp-3;
  }

  &__action {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-2 $sp-4;
    border: 1px solid $color-border;
    color: $color-text;
    border-radius: $radius-pill;
    font-family: $font-display;
    font-size: 12px;
    letter-spacing: 0.05em;
    background: $color-surface-1;
    transition: all $t-normal $ease-out;

    span {
      font-size: 13px;
      line-height: 1;
    }

    &:hover:not(:disabled) {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--primary {
      background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
      color: $color-void;
      border-color: transparent;
      font-weight: 600;
      box-shadow: $glow-cyan-soft;

      &:hover:not(:disabled) {
        color: $color-void;
        background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
        box-shadow: $glow-cyan;
        transform: translateX(2px);
      }
    }
  }

  &__create {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-2 $sp-5;
    background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
    color: $color-void;
    border-radius: $radius-pill;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.05em;
    box-shadow: $glow-cyan-soft;
    transition: all $t-normal $ease-out;

    &:hover {
      transform: translateX(2px);
      box-shadow: $glow-cyan;
    }

    span {
      font-size: 16px;
      line-height: 1;
    }
  }

  &__delete {
    padding: $sp-2 $sp-4;
    border: 1px solid rgba($color-error, 0.4);
    color: $color-error;
    border-radius: $radius-sm;
    font-family: $font-display;
    font-size: 12px;
    transition: all $t-normal;

    &:hover {
      background: rgba($color-error, 0.15);
      border-color: $color-error;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: $sp-5;
  }

  &__empty {
    @include flex-center;
    flex-direction: column;
    gap: $sp-3;
    padding: $sp-16 0;
    text-align: center;
    animation: riseIn 0.5s $ease-out;
  }

  &__empty-icon {
    font-size: 64px;
    color: $color-cyan-deep;
    opacity: 0.4;
  }

  &__empty-title {
    font-family: $font-display;
    font-size: 20px;
    color: $color-text;
    margin-top: $sp-2;
  }

  &__empty-text {
    color: $color-text-mute;
    font-size: 13px;
    margin-bottom: $sp-4;
  }

  &__create-btn {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-3 $sp-5;
    background: linear-gradient(135deg, $color-cyan-bright, $color-cyan-deep);
    color: $color-void;
    border-radius: $radius-pill;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    box-shadow: $glow-cyan-soft;
    transition: all $t-normal $ease-out;

    &:hover {
      transform: translateX(2px);
      box-shadow: $glow-cyan;

      span {
        transform: translateX(3px);
      }
    }

    span {
      transition: transform $t-normal $ease-spring;
    }
  }
}

// ---------- PLAYLIST CARD ----------
.playlist-card {
  cursor: pointer;
  animation: riseIn 0.5s $ease-out backwards;
  transition: transform $t-normal $ease-out;

  &:hover {
    transform: translateY(-4px);

    .playlist-card__cover img {
      transform: scale(1.08);
    }
    .playlist-card__overlay {
      opacity: 1;

      span {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .playlist-card__name {
      color: $color-cyan-bright;
    }
  }

  &__cover {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: $radius-md;
    overflow: hidden;
    margin-bottom: $sp-3;
    background: $color-surface-1;
    border: 1px solid $color-border;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform $t-slow $ease-out;
    }
  }

  &__placeholder {
    @include flex-center;
    height: 100%;
    font-size: 48px;
    color: $color-text-faint;
    background: linear-gradient(135deg, $color-surface-2, $color-surface-1);

    span {
      filter: drop-shadow(0 0 12px rgba($color-cyan-deep, 0.3));
    }
  }

  &__overlay {
    @include flex-center;
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 40%, var(--overlay-strong));
    opacity: 0;
    transition: opacity $t-normal;

    span {
      position: absolute;
      bottom: $sp-4;
      right: $sp-4;
      width: 40px;
      height: 40px;
      @include flex-center;
      background: $color-cyan-bright;
      color: $color-void;
      border-radius: 50%;
      font-size: 18px;
      font-weight: 700;
      box-shadow: $glow-cyan;
      transform: translateX(-12px);
      opacity: 0;
      transition: all $t-normal $ease-spring;
    }
  }

  &__info {
    padding: 0 $sp-1;
  }

  &__name {
    font-family: $font-display;
    color: $color-text;
    font-size: 15px;
    font-weight: 500;
    margin-bottom: $sp-1;
    transition: color $t-normal;
  }

  &__count {
    color: $color-text-mute;
    font-size: 11px;
    letter-spacing: 0.15em;
  }
}
</style>
