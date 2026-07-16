import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 搜索音乐
export function searchMusic(keyword, page = 1, order = '') {
  return api.get('/search', { params: { keyword, page, order } })
}

// 获取音频流地址
export function getAudioUrl(bvid) {
  return api.get('/audio/url', { params: { bvid } })
}

// 构建音频流代理地址
export function getAudioStreamUrl(originalUrl, title, bvid) {
  const params = new URLSearchParams({ url: originalUrl })
  if (title) params.set('title', title)
  if (bvid) params.set('bvid', bvid)
  return `/api/audio/stream?${params.toString()}`
}

// 构建封面图代理地址（避免 B站防盗链）
export function getImageUrl(coverUrl) {
  if (!coverUrl) return ''
  // 如果已经是代理地址或本地路径，直接返回
  if (coverUrl.startsWith('/api/') || coverUrl.startsWith('data:')) return coverUrl
  // B站封面图通过代理转发，附加 Referer 头
  return `/api/image?url=${encodeURIComponent(coverUrl)}`
}
