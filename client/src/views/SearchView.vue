<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/useToast'
import { searchMusic } from '../api'
import SearchBar from '../components/SearchBar.vue'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'

const player = usePlayerStore()
const { showToast } = useToast()

const results = ref([])
const loading = ref(false)
const searched = ref(false)
const currentKeyword = ref('')

// 添加到歌单弹窗
const showAddModal = ref(false)
const selectedSong = ref(null)

async function handleSearch(keyword) {
  currentKeyword.value = keyword
  loading.value = true
  searched.value = true

  try {
    const res = await searchMusic(keyword)
    if (res.data.success) {
      results.value = res.data.data.results
      if (results.value.length === 0) {
        showToast('没有找到相关音乐', 'info')
      }
    } else {
      showToast(res.data.message || '搜索失败', 'error')
      results.value = []
    }
  } catch (err) {
    showToast('搜索失败，请检查网络', 'error')
    results.value = []
  } finally {
    loading.value = false
  }
}

function handlePlay(song) {
  player.play(song)
  showToast(`正在播放：${song.title}`, 'success')
}

function handleAddToPlaylist(song) {
  selectedSong.value = song
  showAddModal.value = true
}
</script>

<template>
  <div class="search-view">
    <h2 class="page-title">搜索音乐</h2>
    <SearchBar @search="handleSearch" />

    <div v-if="loading" class="search-view__loading">
      <div class="spinner"></div>
      <span>搜索中...</span>
    </div>

    <div v-else-if="searched" class="search-view__results">
      <div class="search-view__count" v-if="results.length > 0">
        共找到 {{ results.length }} 条结果
      </div>
      <MusicList
        :songs="results"
        empty-text="没有找到相关音乐，试试其他关键词"
        @play="handlePlay"
        @add-to-playlist="handleAddToPlaylist"
      />
    </div>

    <div v-else class="search-view__welcome">
      <div class="search-view__welcome-icon">♪</div>
      <p>搜索 Bilibili 上的音乐内容</p>
      <p class="search-view__hint">输入歌曲名、UP主名或关键词开始搜索</p>
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

.search-view {
  max-width: 800px;
  margin: 0 auto;

  &__loading {
    @include flex-center;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-xl * 2;
    color: $color-text-secondary;
  }

  &__results {
    margin-top: $spacing-lg;
  }

  &__count {
    color: $color-text-secondary;
    font-size: 13px;
    margin-bottom: $spacing-md;
  }

  &__welcome {
    @include flex-center;
    flex-direction: column;
    gap: $spacing-sm;
    padding: $spacing-xl * 3;
    color: $color-text-secondary;

    .search-view__welcome-icon {
      font-size: 64px;
      color: $color-accent;
      opacity: 0.5;
    }

    p {
      font-size: 14px;
    }

    .search-view__hint {
      font-size: 12px;
      opacity: 0.7;
    }
  }
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: $spacing-lg;
  color: $color-text-primary;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid $color-border;
  border-top-color: $color-accent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
