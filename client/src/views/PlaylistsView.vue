<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistsStore } from '../stores/playlists'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import MusicList from '../components/MusicList.vue'
import PlaylistModal from '../components/PlaylistModal.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const player = usePlayerStore()
const { showToast } = useToast()

const showCreateModal = ref(false)
const showAddModal = ref(false)
const selectedSong = ref(null)

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

function handleAddToPlaylist(song) {
  selectedSong.value = song
  showAddModal.value = true
}

function handleDeletePlaylist(id) {
  if (confirm('确定删除这个歌单吗？')) {
    playlists.deletePlaylist(id)
    showToast('歌单已删除', 'success')
    router.push('/playlists')
  }
}

function handleRemoveFromPlaylist(bvid) {
  if (playlistId.value) {
    playlists.removeFromPlaylist(playlistId.value, bvid)
    showToast('已从歌单移除', 'success')
  }
}
</script>

<template>
  <div class="playlists-view">
    <!-- 歌单详情页 -->
    <template v-if="currentPlaylist">
      <div class="playlists-view__header">
        <div class="playlists-view__back" @click="router.push('/playlists')">← 返回</div>
        <h2 class="page-title">{{ currentPlaylist.name }}</h2>
        <button class="playlists-view__delete" @click="handleDeletePlaylist(currentPlaylist.id)">
          删除歌单
        </button>
      </div>

      <div class="playlists-view__count">
        共 {{ currentPlaylist.songs.length }} 首歌曲
      </div>

      <MusicList
        :songs="currentPlaylist.songs"
        empty-text="歌单为空，去搜索添加歌曲吧"
        @play="handlePlay"
        @add-to-playlist="handleAddToPlaylist"
      />
    </template>

    <!-- 歌单列表页 -->
    <template v-else>
      <div class="playlists-view__header">
        <h2 class="page-title">我的歌单</h2>
        <button class="playlists-view__create" @click="showCreateModal = true">
          + 创建歌单
        </button>
      </div>

      <div v-if="playlists.playlists.length === 0" class="empty-state">
        <div class="icon">☰</div>
        <div>还没有歌单</div>
        <button class="playlists-view__create" @click="showCreateModal = true">
          创建第一个歌单
        </button>
      </div>

      <div v-else class="playlists-view__grid">
        <div
          v-for="p in playlists.playlists"
          :key="p.id"
          class="playlist-card"
          @click="router.push(`/playlists/${p.id}`)"
        >
          <div class="playlist-card__cover">
            <img
              v-if="p.songs.length > 0"
              :src="p.songs[0].cover"
              alt="封面"
            />
            <div v-else class="playlist-card__placeholder">♪</div>
          </div>
          <div class="playlist-card__name text-ellipsis">{{ p.name }}</div>
          <div class="playlist-card__count">{{ p.songs.length }} 首歌曲</div>
        </div>
      </div>
    </template>

    <PlaylistModal :show="showCreateModal" @close="showCreateModal = false" />
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

.playlists-view {
  max-width: 800px;
  margin: 0 auto;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    margin-bottom: $spacing-lg;
  }

  &__back {
    color: $color-text-secondary;
    cursor: pointer;
    font-size: 13px;
    transition: color $transition-normal;

    &:hover {
      color: $color-accent;
    }
  }

  &__count {
    color: $color-text-secondary;
    font-size: 13px;
    margin-bottom: $spacing-md;
  }

  &__create {
    margin-left: auto;
    padding: 8px 16px;
    background: $color-accent;
    color: $color-bg-primary;
    border-radius: $radius-sm;
    font-size: 13px;
    transition: all $transition-normal;

    &:hover {
      background: $color-accent-dark;
    }
  }

  &__delete {
    margin-left: auto;
    padding: 6px 12px;
    border: 1px solid $color-error;
    color: $color-error;
    border-radius: $radius-sm;
    font-size: 12px;
    transition: all $transition-normal;

    &:hover {
      background: $color-error;
      color: $color-bg-primary;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: $spacing-md;
  }
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: $color-text-primary;
}

.playlist-card {
  @include card;
  padding: $spacing-sm;
  cursor: pointer;

  &:hover {
    border-color: $color-accent;
    .playlist-card__cover img {
      transform: scale(1.05);
    }
  }

  &__cover {
    width: 100%;
    aspect-ratio: 1;
    border-radius: $radius-sm;
    overflow: hidden;
    margin-bottom: $spacing-sm;
    background: $color-bg-tertiary;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform $transition-normal;
    }
  }

  &__placeholder {
    @include flex-center;
    height: 100%;
    font-size: 36px;
    color: $color-text-secondary;
  }

  &__name {
    color: $color-text-primary;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
  }

  &__count {
    color: $color-text-secondary;
    font-size: 12px;
  }
}
</style>
