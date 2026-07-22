// SSRF 防护：仅允许 B站相关域名
const ALLOWED_HOSTS = [
  'bilivideo.com',
  'bilivideo.cn',
  'hdslb.com',
  'biliapi.net',
  'bilibili.com',
]

// 校验 URL 是否指向允许的域名（支持子域名）
export function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed))
  } catch {
    return false
  }
}
