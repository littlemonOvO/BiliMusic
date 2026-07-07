import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 搜索音乐
export function searchMusic(keyword, page = 1) {
  return api.get('/search', { params: { keyword, page } })
}

// 获取音频流地址
export function getAudioUrl(bvid) {
  return api.get('/audio/url', { params: { bvid } })
}

// 构建音频流代理地址
export function getAudioStreamUrl(originalUrl) {
  return `/api/audio/stream?url=${encodeURIComponent(originalUrl)}`
}
