<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSearchStore } from '../stores/search'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../composables/useToast'
import { searchMusic } from '../api'
import SearchBar from '../components/SearchBar.vue'
import MusicList from '../components/MusicList.vue'
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue'
import ContextMenu from '../components/ContextMenu.vue'

const player = usePlayerStore()
const searchStore = useSearchStore()
const favorites = useFavoritesStore()
const { showToast } = useToast()

// 仅用 store 持久化搜索状态（刷新时重置）
const loading = ref(false)

// 排序选项
const orderOptions = [
  { value: '', label: '综合', name: 'B站默认' },
  { value: 'click', label: '播放量', name: '播放量' },
  { value: 'pubdate', label: '新发布', name: '新发布' },
]

const showAddModal = ref(false)
const selectedSong = ref(null)

// 竞态控制：每次发起搜索递增 reqId，返回时若不匹配则丢弃
let searchReqId = 0
// 翻页防抖定时器
let pageDebounce = null

async function doSearch(keyword, page = 1) {
  const reqId = ++searchReqId
  searchStore.page = page
  loading.value = true
  searchStore.searched = true

  try {
    const res = await searchMusic(keyword, page, searchStore.order)
    // 竞态保护：若期间又发起了新请求，丢弃本次结果
    if (reqId !== searchReqId) return

    if (res.data.success) {
      searchStore.setState({
        keyword,
        results: res.data.data.results,
        page,
        totalPages: res.data.data.numPages || 1,
        total: res.data.data.total || 0,
        order: searchStore.order,
      })
      if (searchStore.results.length === 0 && page === 1) {
        showToast('没有找到相关音乐', 'info')
      }
    } else {
      showToast(res.data.message || '搜索失败', 'error')
      searchStore.reset()
      searchStore.searched = true
    }
  } catch (err) {
    if (reqId !== searchReqId) return
    showToast('搜索失败，请检查网络', 'error')
    searchStore.reset()
    searchStore.searched = true
  } finally {
    if (reqId === searchReqId) loading.value = false
  }
}

async function handleSearch(keyword) {
  searchStore.keyword = keyword
  if (pageDebounce) clearTimeout(pageDebounce)
  await doSearch(keyword, 1)
}

async function handlePageChange(page) {
  // 防抖：快速连续翻页时只执行最后一次
  if (pageDebounce) clearTimeout(pageDebounce)
  pageDebounce = setTimeout(() => {
    doSearch(searchStore.keyword, page)
  }, 350)
}

function handleOrderChange(order) {
  if (searchStore.order === order) return
  searchStore.order = order
  doSearch(searchStore.keyword, 1)
}

// 生成分页按钮（围绕当前页）
function pageList() {
  const cur = searchStore.page
  const max = searchStore.totalPages
  const pages = []
  const start = Math.max(1, Math.min(cur - 2, max - 4))
  const end = Math.min(max, start + 4)
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p)
  return pages
}

function handlePlay(song) {
  player.playSingle(song)
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

// 右键菜单（搜索结果不可重命名/删除）
const ctxMenu = ref({ show: false, x: 0, y: 0, song: null })
const ctxItems = ref([])

function handleContextMenu({ song, event }) {
  const isFav = favorites.isFavorite(song.bvid)
  ctxItems.value = [
    { icon: '▶', label: '播放', action: 'play' },
    { divider: true },
    { icon: '⤵', label: '添加到下一首', action: 'add-to-next' },
    { icon: '♪', label: '添加到歌单', action: 'add-to-playlist' },
    { icon: '♥', label: isFav ? '取消收藏' : '收藏', action: 'toggle-fav', active: isFav, danger: isFav },
  ]
  ctxMenu.value = { show: true, x: event.clientX, y: event.clientY, song }
}

function handleCtxAction(action) {
  const song = ctxMenu.value.song
  if (!song) return

  switch (action) {
    case 'play':
      handlePlay(song)
      break
    case 'add-to-next':
      handleAddToNext(song)
      break
    case 'add-to-playlist':
      handleAddToPlaylist(song)
      break
    case 'toggle-fav':
      favorites.toggle(song)
      showToast(favorites.isFavorite(song.bvid) ? '已收藏' : '已取消收藏', 'success')
      break
  }
}
</script>

<template>
  <div class="search-view">
    <!-- Hero -->
    <section v-if="!searchStore.searched && !loading" class="hero">
      <div class="hero__badge">
        <span class="hero__badge-dot"></span>
        NEON · SOUNDFLOW · v1.0
      </div>
      <h1 class="hero__title">
        Find Your <span class="hero__title-accent">Frequency</span>
      </h1>
      <p class="hero__subtitle">
        Music from Bilibili
      </p>
      <div class="hero__search">
        <SearchBar @search="handleSearch" />
      </div>
      <div class="hero__meta">
        <span class="hero__meta-item"><span class="hero__meta-num">∞</span> 音乐</span>
        <span class="hero__meta-divider">/</span>
        <span class="hero__meta-item"><span class="hero__meta-num">04</span> 模块</span>
        <span class="hero__meta-divider">/</span>
        <span class="hero__meta-item">实时<span class="hero__meta-num"> 流</span></span>
      </div>
    </section>

    <!-- Search bar (when results shown) -->
    <div v-if="searchStore.searched || loading" class="search-view__bar">
      <SearchBar @search="handleSearch" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="search-view__loading">
      <div class="loader">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="search-view__loading-text">正在扫描音频矩阵...</p>
    </div>

    <!-- Results -->
    <div v-else-if="searchStore.searched" class="search-view__results">
      <div class="search-view__header">
        <h2 class="page-title">搜索结果</h2>
        <div class="search-view__header-right">
          <div class="search-view__count mono">
            <span class="search-view__count-num">{{ searchStore.total }}</span>
            <span class="search-view__count-label">TRACKS</span>
            <span class="search-view__count-sep">·</span>
            <span class="search-view__count-query">"{{ searchStore.keyword }}"</span>
          </div>
          <div class="sort-switcher" role="tablist" aria-label="排序方式">
            <span class="sort-switcher__label mono">SORT</span>
            <button
              v-for="opt in orderOptions"
              :key="opt.value"
              class="sort-switcher__btn mono"
              :class="{ 'sort-switcher__btn--active': searchStore.order === opt.value }"
              role="tab"
              :aria-selected="searchStore.order === opt.value"
              @click="handleOrderChange(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
      </div>
      <MusicList
        :songs="searchStore.results"
        empty-text="没有找到相关音乐，试试其他关键词"
        @play="handlePlay"
        @add-to-playlist="handleAddToPlaylist"
        @add-to-next="handleAddToNext"
        @context-menu="handleContextMenu"
      />
      <nav v-if="searchStore.totalPages > 1" class="pagination" :aria-label="'分页 - 当前第 ' + searchStore.page + ' 页，共 ' + searchStore.totalPages + ' 页'">
        <button
          class="pagination__btn pagination__btn--first"
          :disabled="searchStore.page === 1"
          @click="handlePageChange(1)"
          title="回到第一页"
        >
          ⏮
        </button>

        <button
          class="pagination__btn"
          :disabled="searchStore.page === 1"
          @click="handlePageChange(searchStore.page - 1)"
          title="上一页"
        >
          ‹
        </button>

        <button
          v-if="pageList()[0] > 1"
          class="pagination__btn pagination__btn--ellipsis"
          disabled
        >
          …
        </button>

        <button
          v-for="p in pageList()"
          :key="p"
          class="pagination__btn"
          :class="{ 'pagination__btn--active': p === searchStore.page }"
          @click="handlePageChange(p)"
        >{{ p }}</button>

        <button
          v-if="pageList()[pageList().length - 1] < searchStore.totalPages"
          class="pagination__btn pagination__btn--ellipsis"
          disabled
        >
          …
        </button>

        <span class="pagination__info mono">
          <span class="pagination__info-current">{{ searchStore.page }}</span>
          <span class="pagination__info-sep">/</span>
          <span class="pagination__info-total">{{ searchStore.totalPages }}</span>
        </span>

        <button
          class="pagination__btn"
          :disabled="searchStore.page >= searchStore.totalPages"
          @click="handlePageChange(searchStore.page + 1)"
          title="下一页"
        >
          ›
        </button>
      </nav>
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
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
@use '../styles/mixins' as *;

.search-view {
  max-width: 860px;
  margin: 0 auto;
  min-height: 100%;

  &__bar {
    margin-bottom: $sp-8;
  }

  &__loading {
    @include flex-center;
    flex-direction: column;
    gap: $sp-6;
    padding: $sp-16 * 1.5;
    color: $color-text-mute;
  }

  &__loading-text {
    font-family: $font-mono;
    font-size: 12px;
    letter-spacing: 0.2em;
    color: $color-text-mute;
  }

  &__results {
    animation: riseIn 0.4s $ease-out;
  }

  &__header {
    margin-bottom: $sp-6;
  }

  &__header-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: $sp-4 $sp-6;
  }

  &__count {
    display: flex;
    align-items: baseline;
    gap: $sp-2;
    font-size: 12px;
    color: $color-text-mute;
    letter-spacing: 0.1em;

    &-num {
      font-size: 18px;
      color: $color-cyan-bright;
      font-weight: 500;
      @include text-glow;
    }

    &-label {
      letter-spacing: 0.25em;
    }

    &-sep {
      color: $color-text-faint;
    }

    &-query {
      color: $color-text-soft;
    }
  }
}

// ---------- SORT SWITCHER ----------
.sort-switcher {
  display: inline-flex;
  align-items: center;
  gap: $sp-1;
  padding: 3px;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  background: var(--surface-1);

  &__label {
    font-size: 10px;
    color: $color-text-faint;
    letter-spacing: 0.2em;
    padding: 0 $sp-2 0 $sp-3;
    user-select: none;
  }

  &__btn {
    padding: 4px $sp-3;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
    color: $color-text-mute;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all $t-fast $ease-out;

    &:hover {
      color: $color-cyan-bright;
      background: $color-cyan-dim;
    }

    &--active {
      color: $color-cyan-bright;
      background: $color-cyan-dim;
      box-shadow: $glow-cyan-soft;
    }
  }
}

// ---------- HERO ----------
.hero {
  @include flex-center;
  flex-direction: column;
  text-align: center;
  padding: $sp-16 0 $sp-12;
  animation: riseIn 0.6s $ease-out;

  &__badge {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-2 $sp-4;
    border: 1px solid $color-border;
    border-radius: $radius-pill;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: $color-text-mute;
    margin-bottom: $sp-6;
    background: $color-surface-1;
  }

  &__badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan-bright;
    box-shadow: $glow-cyan;
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__title {
    font-family: $font-display;
    font-size: 64px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: $color-text;
    margin-bottom: $sp-4;

    @media (max-width: 700px) {
      font-size: 44px;
    }
  }

  &__title-accent {
    background: linear-gradient(135deg, $color-cyan-bright, $color-magenta);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 24px rgba(var(--cyan-glow-rgb), 0.4));
  }

  &__subtitle {
    font-size: 15px;
    color: $color-text-soft;
    margin-bottom: $sp-10;
    max-width: 480px;
    letter-spacing: 0.02em;
  }

  &__search {
    width: 100%;
    margin-bottom: $sp-10;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $sp-3;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.15em;
    color: $color-text-mute;
  }

  &__meta-item {
    display: flex;
    align-items: baseline;
    gap: $sp-1;
  }

  &__meta-num {
    color: $color-cyan-bright;
    font-weight: 500;
  }

  &__meta-divider {
    color: $color-text-faint;
  }
}

// ---------- LOADER ----------
.loader {
  display: flex;
  align-items: center;
  gap: $sp-1;
  height: 40px;

  span {
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, $color-cyan-bright, $color-magenta);
    border-radius: $radius-pill;
    animation: loaderWave 1s ease-in-out infinite;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
    &:nth-child(4) { animation-delay: 0.45s; }
  }
}

@keyframes loaderWave {
  0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
  50% { transform: scaleY(1); opacity: 1; }
}

.page-title {
  margin-bottom: $sp-3;
}

// ---------- PAGINATION ----------
.pagination {
  @include flex-center;
  gap: $sp-2;
  flex-wrap: wrap;
  padding: $sp-8 0 $sp-4;
  user-select: none;

  &__btn {
    @include flex-center;
    min-width: 36px;
    height: 36px;
    padding: 0 $sp-2;
    border-radius: $radius-sm;
    color: $color-text-mute;
    font-family: $font-mono;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid $color-border;
    background: transparent;
    transition: all $t-normal $ease-out;

    &:not(:disabled):hover {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
      box-shadow: $glow-cyan-soft;
    }

    &:not(:disabled):active {
      transform: scale(0.95);
    }

    &:disabled {
      opacity: 0.25;
      cursor: default;
    }

    &--ellipsis {
      min-width: auto;
      border: none;
      font-size: 13px;
      letter-spacing: 0.2em;
      color: $color-text-faint;
    }

    &--active {
      color: $color-cyan-bright;
      border-color: $color-cyan-deep;
      background: $color-cyan-dim;
      box-shadow: $glow-cyan-soft;
      pointer-events: none;
    }

    &--first {
      font-size: 11px;
      opacity: 0.7;

      &:not(:disabled):hover {
        opacity: 1;
      }
    }
  }

  &__info {
    display: inline-flex;
    align-items: baseline;
    gap: $sp-1;
    margin-left: $sp-3;
    font-size: 12px;
    color: $color-text-faint;
    letter-spacing: 0.05em;

    &-current {
      color: $color-cyan-bright;
      font-weight: 500;
      @include text-glow;
    }

    &-sep {
      color: $color-text-faint;
      opacity: 0.6;
    }

    &-total {
      color: $color-text-mute;
    }
  }
}
</style>
