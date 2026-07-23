<script setup>
import { onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from './stores/player'
import { useThemeStore } from './stores/theme'
import { useToast } from './composables/useToast'
import TopBar from './components/TopBar.vue'
import SideBar from './components/SideBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import ToastContainer from './components/ToastContainer.vue'

const player = usePlayerStore()
const theme = useThemeStore()
const { showToast } = useToast()

onMounted(() => {
  theme.init()

  // 快捷键：空格暂停/播放，M 静音/解除
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  // 输入框聚焦时不触发
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault()
    if (player.currentSong) {
      player.togglePlay()
    }
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    player.toggleMute()
    showToast(player.volume === 0 ? '已静音' : '已解除静音', 'info')
  }
}
</script>

<template>
  <div class="app-layout">
    <TopBar />

    <div class="app-body">
      <SideBar />

      <main class="main-content scrollable">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <PlayerBar />

    <ToastContainer />
  </div>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;
@use './styles/mixins' as *;

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// ---------- MAIN ----------
.main-content {
  flex: 1;
  padding: $sp-8 $sp-10;
  background: transparent;
}

// ---------- PAGE TRANSITION ----------
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s $ease-out, transform 0.25s $ease-out;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
