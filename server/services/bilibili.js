import axios from 'axios'
import crypto from 'crypto'

// B站 API 请求间隔控制（防止限流）
let lastSearchTime = 0
const MIN_SEARCH_INTERVAL = 600 // ms，两次搜索请求之间的最小间隔

async function waitSearchSlot() {
  const now = Date.now()
  const elapsed = now - lastSearchTime
  if (elapsed < MIN_SEARCH_INTERVAL) {
    const wait = MIN_SEARCH_INTERVAL - elapsed
    await new Promise((r) => setTimeout(r, wait))
  }
  lastSearchTime = Date.now()
}

const BILIBILI_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const api = axios.create({
  baseURL: 'https://api.bilibili.com',
  timeout: 15000,
  headers: BILIBILI_HEADERS,
})

// 缓存（带 TTL，B站密钥和 Cookie 会定期失效）
let cookieStr = ''
let wbiKeys = null
let cookieTime = 0
let wbiKeysTime = 0
const COOKIE_TTL = 30 * 60 * 1000 // 30 分钟
const WBI_KEYS_TTL = 60 * 60 * 1000 // 1 小时

// WBI 签名所需的字符索引表（64 个元素）
const WBI_MIXIN_KEY_ENC_TABS = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 6, 20, 44, 36, 51, 22, 60, 57,
  11, 25, 0, 34, 21, 1, 17, 4, 30, 52, 56, 59, 26, 54, 2, 39,
]

// 获取 WBI 签名密钥
async function ensureWbiKeys() {
  if (wbiKeys && Date.now() - wbiKeysTime < WBI_KEYS_TTL) return

  await ensureCookie()

  const res = await api.get('/x/web-interface/nav', {
    headers: cookieStr ? { Cookie: cookieStr } : {},
  })

  const imgUrl = res.data?.data?.wbi_img?.img_url || ''
  const subUrl = res.data?.data?.wbi_img?.sub_url || ''

  const imgKey = imgUrl.split('/').pop().split('.')[0] || ''
  const subKey = subUrl.split('/').pop().split('.')[0] || ''

  wbiKeys = { imgKey, subKey }
  wbiKeysTime = Date.now()
  console.log('Got WBI keys:', imgKey.substring(0, 16) + '...', subKey.substring(0, 16) + '...')
}

// 生成 mixin key
function getMixinKey(imgKey, subKey) {
  const combined = imgKey + subKey
  let result = ''
  for (const idx of WBI_MIXIN_KEY_ENC_TABS) {
    if (idx < combined.length) {
      result += combined[idx]
    }
  }
  return result.slice(0, 32)
}

// 对参数进行 WBI 签名
function signWbi(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey, subKey)
  const wts = Math.floor(Date.now() / 1000)
  const signedParams = { ...params, wts }

  // 按 key 排序并拼接
  const query = Object.keys(signedParams)
    .sort()
    .map((k) => {
      const v = signedParams[k]
      // 过滤特殊字符
      const filtered = String(v).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(k)}=${encodeURIComponent(filtered)}`
    })
    .join('&')

  // 计算 w_rid
  const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex')
  signedParams.w_rid = wRid

  return signedParams
}

// 获取 Cookie
async function ensureCookie() {
  if (cookieStr && Date.now() - cookieTime < COOKIE_TTL) return

  try {
    const spiRes = await axios.get('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: BILIBILI_HEADERS,
      timeout: 10000,
    })

    const cookies = []
    if (spiRes.data?.data?.b_3) {
      cookies.push(`buvid3=${spiRes.data.data.b_3}`)
      cookies.push(`buvid4=${spiRes.data.data.b_4}`)
    }

    // 访问首页获取额外 Cookie
    const homeRes = await axios.get('https://www.bilibili.com', {
      headers: BILIBILI_HEADERS,
      timeout: 10000,
    })

    const setCookies = homeRes.headers['set-cookie']
    if (setCookies) {
      for (const sc of setCookies) {
        const match = sc.match(/^([^=]+)=([^;]+)/)
        if (match && !cookies.some((c) => c.startsWith(match[1]))) {
          cookies.push(`${match[1]}=${match[2]}`)
        }
      }
    }

    cookieStr = cookies.join('; ')
    cookieTime = Date.now()
    console.log('Got cookies:', cookieStr.substring(0, 80) + '...')
  } catch (err) {
    console.log('Failed to get cookie:', err.message)
  }
}

// 搜索 Bilibili 视频（使用 WBI 签名）
export async function search(keyword, page = 1, order = '', reqId = '') {
  console.log(`${reqId} [bilibili.search] start: keyword="${keyword}" page=${page} order="${order}"`)
  await ensureWbiKeys()
  console.log(`${reqId} [bilibili.search] WBI keys ready`)

  // order: ''=综合, 'click'=播放量, 'pubdate'=新发布
  const params = {
    search_type: 'video',
    keyword,
    page,
    order,
    duration: '',
    tids_1: '',
    tids_2: '',
  }

  const signedParams = signWbi(params, wbiKeys.imgKey, wbiKeys.subKey)
  console.log(`${reqId} [bilibili.search] signed params:`, JSON.stringify({ ...signedParams, w_rid: signedParams.w_rid?.substring(0, 16) + '...' }))

  // 最多重试 3 次（应对 B站限流返回空结果）
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    const tAttempt = Date.now()
    console.log(`${reqId} [bilibili.search] attempt ${attempt + 1}/3, sending request...`)

    // 等待请求间隔，防止 B站限流
    await waitSearchSlot()

    try {
      res = await api.get('/x/web-interface/wbi/search/type', {
        params: signedParams,
        headers: cookieStr ? { Cookie: cookieStr } : {},
      })
    } catch (axiosErr) {
      const elapsed = Date.now() - tAttempt
      console.error(`${reqId} [bilibili.search] attempt ${attempt + 1} AXIOS ERROR: ${axiosErr.message}, elapsed=${elapsed}ms`)
      console.error(`${reqId} [bilibili.search] axios error code: ${axiosErr.code}, status: ${axiosErr.response?.status}`)
      if (axiosErr.response) {
        console.error(`${reqId} [bilibili.search] response body:`, JSON.stringify(axiosErr.response.data).substring(0, 500))
      }
      if (attempt < 2) {
        const delay = 500 * (attempt + 1)
        console.log(`${reqId} [bilibili.search] retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw axiosErr
    }

    const elapsed = Date.now() - tAttempt
    console.log(`${reqId} [bilibili.search] attempt ${attempt + 1} response received, elapsed=${elapsed}ms`)

    // 检查响应类型
    if (typeof res.data !== 'object' || res.data === null) {
      console.error(`${reqId} [bilibili.search] attempt ${attempt + 1} NON-JSON RESPONSE`)
      console.error(`${reqId} [bilibili.search] response type: ${typeof res.data}`)
      console.error(`${reqId} [bilibili.search] response preview:`, String(res.data).substring(0, 500))
      if (attempt < 2) {
        const delay = 500 * (attempt + 1)
        console.log(`${reqId} [bilibili.search] retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw new Error('Bilibili 搜索请求被拦截（非 JSON 响应），请稍后重试')
    }

    console.log(`${reqId} [bilibili.search] response code=${res.data.code}, message="${res.data.message || ''}"`)

    if (res.data.code !== 0) {
      // 鉴权失效（code=-101 未登录 / code=-352 风控），清除缓存以便下次重新获取
      if (res.data.code === -101 || res.data.code === -352) {
        console.log(`${reqId} [bilibili.search] auth expired (code=${res.data.code}), clearing cache for refresh`)
        cookieStr = ''
        cookieTime = 0
        wbiKeys = null
        wbiKeysTime = 0
        if (attempt < 2) {
          const delay = 1000 * (attempt + 1)
          console.log(`${reqId} [bilibili.search] refreshing credentials, retrying in ${delay}ms...`)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
      console.error(`${reqId} [bilibili.search] API ERROR: code=${res.data.code}, message="${res.data.message}"`)
      console.error(`${reqId} [bilibili.search] full response data:`, JSON.stringify(res.data).substring(0, 500))
      throw new Error(res.data.message || '搜索失败')
    }

    // 检查结果数组
    const resultArr = res.data.data?.result
    const numResults = res.data.data?.numResults
    const numPages = res.data.data?.numPages
    console.log(`${reqId} [bilibili.search] result: ${Array.isArray(resultArr) ? resultArr.length : 'N/A'} items, numResults=${numResults}, numPages=${numPages}`)

    // 检查是否返回空结果或异常结构（限流时 result 可能不是数组、为 null/undefined，或空数组）
    const isEmpty = !Array.isArray(resultArr) || resultArr.length === 0 || numResults === undefined
    if (isEmpty && attempt < 2) {
      console.log(`${reqId} [bilibili.search] attempt ${attempt + 1} returned EMPTY/INVALID result (result=${Array.isArray(resultArr) ? '[]' : typeof resultArr}), retrying...`)
      // 打印完整响应数据帮助调试
      console.log(`${reqId} [bilibili.search] full data:`, JSON.stringify(res.data.data || {}).substring(0, 300))
      const delay = 800 * (attempt + 1)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }

    if (isEmpty && attempt === 2) {
      console.error(`${reqId} [bilibili.search] ALL 3 ATTEMPTS returned empty/invalid result`)
    }

    break
  }

  const results = (res.data.data?.result || []).map((item) => ({
    bvid: item.bvid,
    title: item.title.replace(/<[^>]+>/g, ''),
    author: item.author,
    cover: item.pic?.startsWith('//') ? `https:${item.pic}` : item.pic || '',
    duration: item.duration,
    playCount: item.play,
  }))

  const total = res.data.data?.numResults || results.length
  const numPages = res.data.data?.numPages || Math.max(1, Math.ceil(total / 20))

  console.log(`${reqId} [bilibili.search] DONE: ${results.length} results parsed, total=${total}, numPages=${numPages}`)

  return {
    total,
    page,
    pageSize: 20,
    numPages,
    results,
  }
}

// 获取视频详情（cid）
export async function getVideoInfo(bvid) {
  await ensureCookie()

  const res = await api.get('/x/web-interface/view', {
    params: { bvid },
    headers: cookieStr ? { Cookie: cookieStr } : {},
  })

  if (res.data.code !== 0) {
    throw new Error(res.data.message || '获取视频信息失败')
  }

  return {
    bvid,
    cid: res.data.data.cid,
    title: res.data.data.title,
    cover: res.data.data.pic,
    duration: res.data.data.duration,
  }
}

// 获取音频流地址
export async function getAudioUrl(bvid) {
  const videoInfo = await getVideoInfo(bvid)
  const res = await api.get('/x/player/playurl', {
    params: {
      bvid,
      cid: videoInfo.cid,
      fnval: 16,
    },
    headers: cookieStr ? { Cookie: cookieStr } : {},
  })

  if (res.data.code !== 0) {
    throw new Error(res.data.message || '获取播放地址失败')
  }

  const audioList = res.data.data?.dash?.audio
  if (!audioList || audioList.length === 0) {
    throw new Error('该视频没有可用的音频流')
  }

  const bestAudio = audioList.sort((a, b) => b.bandwidth - a.bandwidth)[0]

  return {
    title: videoInfo.title,
    cover: videoInfo.cover,
    duration: videoInfo.duration,
    audioUrl: bestAudio.baseUrl,
  }
}
