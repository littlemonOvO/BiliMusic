<script setup>
import { useFavoritesStore } from '../stores/favorites'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import { useSongContextMenu } from '../composables/useSongContextMenu'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'
import ContextMenu from '../components/ContextMenu.vue'
import RenameDialog from '../components/RenameDialog.vue'

const favorites = useFavoritesStore()
const player = usePlayerStore()
const { showToast } = useToast()

function handlePlay(song) {
  player.setQueue(favorites.items, favorites.items.findIndex((s) => s.bvid === song.bvid))
  showToast(`正在播放：${song.title}`, 'success')
}

function handlePlayAll() {
  if (favorites.items.length === 0) {
    showToast('收藏夹为空', 'info')
    return
  }
  player.playPlaylist(favorites.items)
  showToast('正在播放收藏列表', 'success')
}

function handleRemove(song) {
  favorites.remove(song.bvid)
  showToast('已从收藏移除', 'success')
}

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
  renameTarget,
  handleRename,
} = useSongContextMenu({
  onPlay: handlePlay,
  onRemove: handleRemove,
  removeLabel: '从收藏移除',
  canRename: true,
})
</script>

<template>
  <div class="favorites-view">
    <div class="favorites-view__header">
      <h2 class="page-title">收藏</h2>
      <div class="favorites-view__count mono">
        <span class="favorites-view__count-num">{{ favorites.items.length }}</span>
        <span class="favorites-view__count-label">SAVED</span>
      </div>
      <button
        v-if="favorites.items.length > 0"
        class="favorites-view__play-all"
        @click="handlePlayAll"
      >
        <span>▶</span> 播放全部
      </button>
    </div>

    <div v-if="favorites.items.length > 0" class="favorites-view__list">
      <MusicList
        :songs="favorites.items"
        empty-text="还没有收藏任何歌曲，去搜索添加吧"
        @play="handlePlay"
        @add-to-playlist="addToPlaylist"
        @add-to-next="addToNext"
        @context-menu="openContextMenu"
      />
    </div>

    <div v-else class="favorites-view__empty">
      <div class="favorites-view__empty-icon">♥</div>
      <h3 class="favorites-view__empty-title">收藏夹空空如也</h3>
      <p class="favorites-view__empty-text">在搜索结果中点击 ♥ 收藏喜欢的音乐</p>
      <router-link to="/" class="favorites-view__empty-cta">
        去搜索 <span>-></span>
      </router-link>
    </div>

    <AddToPlaylistModal
      :show="showAddModal"
      :song="selectedSong"
      @close="showAddModal = false"
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
      :initial-value="renameTarget?.title || ''"
      @confirm="handleRename"
      @cancel="showRenameDialog = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.favorites-view {
  max-width: 860px;
  margin: 0 auto;

  &__header {
    display: flex;
    align-items: center;
    gap: $sp-4;
    margin-bottom: $sp-6;
  }

  &__count {
    display: flex;
    align-items: baseline;
    gap: $sp-2;
    font-size: 12px;
    color: $color-text-mute;
    letter-spacing: 0.2em;
  }

  &__count-num {
    font-size: 20px;
    color: $color-magenta;
    font-weight: 500;
    @include text-glow($color-magenta);
  }

  &__play-all {
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
      font-size: 12px;
      line-height: 1;
    }
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
    color: $color-magenta;
    opacity: 0.4;
    filter: drop-shadow(0 0 24px rgba(var(--magenta-glow-rgb), 0.3));
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

  &__empty-cta {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-3 $sp-5;
    background: $color-surface-1;
    border: 1px solid $color-border;
    border-radius: $radius-pill;
    font-family: $font-display;
    font-size: 13px;
    color: $color-cyan-bright;
    transition: all $t-normal $ease-out;

    &:hover {
      border-color: $color-cyan-deep;
      box-shadow: $glow-cyan-soft;
      transform: translateX(2px);

      span {
        transform: translateX(3px);
      }
    }

    span {
      transition: transform $t-normal $ease-spring;
    }
  }
}
</style>
