import { Router } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'
import { fileURLToPath } from 'url'
import { getAudioUrl } from '../services/bilibili.js'

const router = Router()

const BILIBILI_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
}

// SSRF 防护：仅允许 B站 CDN 域名
const ALLOWED_HOSTS = [
  'bilivideo.com',
  'bilivideo.cn',
  'hdslb.com',
  'biliapi.net',
  'bilibili.com',
]

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed))
  } catch {
    return false
  }
}

// 获取音频流地址（bvid -> cid -> playurl 完整流程）
router.get('/url', async (req, res) => {
  try {
    const { bvid } = req.query

    if (!bvid) {
      return res.json({ success: false, message: '缺少 bvid 参数' })
    }

    const data = await getAudioUrl(bvid)
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ===== 磁盘缓存配置 =====
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'audio')
const MAX_CACHE_FILES = 200 // 最多缓存 200 个文件

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

// 缓存键 -> 文件路径（优先用 bvid，保证同一首歌缓存键不变）
function getCachePath(url, bvid) {
  const key = bvid || url
  const hash = crypto.createHash('md5').update(key).digest('hex')
  return {
    dataPath: path.join(CACHE_DIR, `${hash}.dat`),
    metaPath: path.join(CACHE_DIR, `${hash}.meta`),
  }
}

// 读取缓存元数据
function readMeta(metaPath) {
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 写入缓存元数据
function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta))
}

// 格式化时长
function formatAge(ms) {
  if (!ms || ms < 0) return 'N/A'
  const min = Math.floor(ms / 60000)
  const hr = Math.floor(min / 60)
  if (hr > 0) return `${hr}h${min % 60}m`
  return `${min}m`
}

// 检查缓存是否有效（文件存在且大小匹配）
// 返回 { valid, complete } -- valid 表示可播放，complete 表示已完整下载
function checkCache(dataPath, metaPath) {
  if (!fs.existsSync(dataPath) || !fs.existsSync(metaPath)) return { valid: false, complete: false }
  const stats = fs.statSync(dataPath)
  const meta = readMeta(metaPath)
  if (!meta) return { valid: false, complete: false }
  if (stats.size !== meta.size) return { valid: false, complete: false }
  return { valid: true, complete: meta.complete !== false }
}

// LRU 清理：超过上限时删最旧的
function cleanCache() {
  try {
    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.dat'))
      .map((f) => {
        const fullPath = path.join(CACHE_DIR, f)
        const stats = fs.statSync(fullPath)
        return { name: f, path: fullPath, mtime: stats.mtimeMs }
      })
      .sort((a, b) => a.mtime - b.mtime)

    while (files.length > MAX_CACHE_FILES) {
      const oldest = files.shift()
      fs.unlinkSync(oldest.path)
      const metaPath = oldest.path.replace('.dat', '.meta')
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
    }
  } catch {
    // 清理失败不影响主流程
  }
}

// 音频流代理：
// - 缓存命中：从磁盘读取，支持 Range 请求
// - 缓存未命中：从 B站 CDN 边下载边响应客户端，同时写入磁盘缓存
// 解决 B站 CDN 对单连接数据量限制导致的中途断流问题
router.get('/stream', async (req, res) => {
  try {
    const { url, title, bvid } = req.query
    const songTitle = title ? decodeURIComponent(title) : ''

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    if (!isAllowedUrl(url)) {
      return res.status(403).json({ success: false, message: '不允许的 URL 域名' })
    }

    const { dataPath, metaPath } = getCachePath(url, bvid)
    const cacheHash = path.basename(dataPath, '.dat')

    // 检查缓存是否有效
    const { valid: cacheValid, complete: cacheComplete } = checkCache(dataPath, metaPath)
    const oldMeta = readMeta(metaPath)

    // 解析 Range 请求
    const rangeHeader = req.headers.range
    let rangeStart = 0
    let hasRange = false
    if (rangeHeader) {
      const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
      if (match) {
        rangeStart = parseInt(match[1])
        hasRange = true
      }
    }

    if (cacheValid) {
      // ===== 缓存命中：从磁盘读取，支持 Range =====
      const age = Date.now() - fs.statSync(dataPath).mtimeMs
      const tag = cacheComplete ? 'HIT' : 'HIT-PARTIAL'
      console.log(`[Cache] ${tag}  age=${formatAge(age)}  size=${oldMeta?.size || '?'}  title="${songTitle}"  file=${cacheHash}`)

      const meta = readMeta(metaPath)
      const contentType = meta?.contentType || 'audio/mp4'
      const fileSize = fs.statSync(dataPath).size

      // 缓存不完整时，后台异步补全下载
      if (!cacheComplete) {
        console.log(`[Cache] BG-FETCH  title="${songTitle}"  file=${cacheHash}`)
        downloadToCache(url, dataPath, metaPath, songTitle, cacheHash, true).catch((err) => {
          console.error(`[Cache] BG-FETCH FAILED: ${err.message}  title="${songTitle}"  file=${cacheHash}`)
        })
      }

      if (hasRange && rangeStart < fileSize) {
        const end = rangeHeader.match(/bytes=(\d+)-(\d*)/)[2]
          ? parseInt(rangeHeader.match(/bytes=(\d+)-(\d*)/)[2])
          : fileSize - 1
        res.status(206)
        res.setHeader('Content-Range', `bytes ${rangeStart}-${end}/${fileSize}`)
        res.setHeader('Content-Length', end - rangeStart + 1)
        res.setHeader('Content-Type', contentType)
        res.setHeader('Accept-Ranges', 'bytes')
        fs.createReadStream(dataPath, { start: rangeStart, end }).pipe(res)
      } else {
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Length', fileSize)
        res.setHeader('Accept-Ranges', 'bytes')
        fs.createReadStream(dataPath).pipe(res)
      }
      return
    }

    // ===== 缓存未命中 =====
    if (oldMeta) {
      const age = Date.now() - (oldMeta.createdAt || 0)
      console.log(`[Cache] MISS age=${formatAge(age)}  reason=invalid  title="${songTitle}"  file=${cacheHash}`)
    } else {
      console.log(`[Cache] MISS age=N/A  reason=not_found  title="${songTitle}"  file=${cacheHash}`)
    }

    // 如果客户端请求非零起点 Range（seek），无法从 B站流中途开始，
    // 回退到先完整下载再从磁盘读取
    if (hasRange && rangeStart > 0) {
      await downloadToCache(url, dataPath, metaPath, songTitle, cacheHash, false)
      const meta = readMeta(metaPath)
      const contentType = meta?.contentType || 'audio/mp4'
      const fileSize = fs.statSync(dataPath).size
      const end = rangeHeader.match(/bytes=(\d+)-(\d*)/)[2]
        ? parseInt(rangeHeader.match(/bytes=(\d+)-(\d*)/)[2])
        : fileSize - 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${rangeStart}-${end}/${fileSize}`)
      res.setHeader('Content-Length', end - rangeStart + 1)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Accept-Ranges', 'bytes')
      fs.createReadStream(dataPath, { start: rangeStart, end }).pipe(res)
      return
    }

    // 从 B站 CDN 边下载边响应客户端 + 同时写入磁盘缓存
    console.log(`[Cache] STREAM  title="${songTitle}"  file=${cacheHash}`)
    const response = await axios.get(url, {
      headers: BILIBILI_HEADERS,
      responseType: 'stream',
      timeout: 30000,
    })

    const contentType = response.headers['content-type'] || 'audio/mp4'
    const expectedLength = parseInt(response.headers['content-length'])

    // 响应头
    res.setHeader('Content-Type', contentType)
    if (expectedLength) {
      res.setHeader('Content-Length', expectedLength)
    }
    res.setHeader('Accept-Ranges', 'bytes')
    res.status(200)

    // 同时写入临时文件用于缓存
    const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
    const writeStream = fs.createWriteStream(tmpPath)

    // 用 PassThrough 正确分流：B站流 -> PassThrough -> 客户端 + 磁盘
    // PassThrough 自动处理背压，避免 on('data') + pipe() 并用导致的冲突
    const passThrough = new PassThrough()
    response.data.pipe(passThrough)
    passThrough.pipe(res)
    passThrough.pipe(writeStream)

    // 客户端断开时：只停止给客户端的 pipe，但让 B站下载继续写入磁盘
    let clientClosed = false
    req.on('close', () => {
      clientClosed = true
      // 只 unpipe 客户端，不 destroy B站源流，让缓存下载继续
      passThrough.unpipe(res)
    })

    // B站流结束：完成磁盘写入，保存缓存
    response.data.on('end', () => {
      writeStream.end()
    })

    // B站流错误（如 CDN 限流中断）：保留已下载的部分作为缓存
    response.data.on('error', (err) => {
      console.error(`[Cache] STREAM ERROR: ${err.message}`)
      writeStream.end()
      if (!clientClosed && !res.headersSent) {
        res.status(500).json({ success: false, message: '音频流获取失败' })
      } else if (!clientClosed) {
        res.end()
      }
    })

    writeStream.on('finish', () => {
      const actualSize = fs.statSync(tmpPath).size
      const isComplete = !expectedLength || actualSize >= expectedLength
      if (!isComplete) {
        console.log(`[Cache] INCOMPLETE: ${actualSize}/${expectedLength}, keeping partial cache`)
      }
      try {
        fs.renameSync(tmpPath, dataPath)
      } catch {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      }
      writeMeta(metaPath, {
        contentType,
        size: actualSize,
        url: url.slice(0, 100),
        createdAt: Date.now(),
        complete: isComplete,
      })
      console.log(`[Cache] STORED  size=${actualSize}  complete=${isComplete}  title="${songTitle}"  file=${cacheHash}`)
      setImmediate(cleanCache)
    })

    writeStream.on('error', (err) => {
      console.error(`[Cache] WRITE ERROR: ${err.message}`)
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
    })
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '音频流获取失败' })
    }
  }
})

// 完整下载到磁盘缓存（用于 seek 场景 / 后台补全不完整缓存）
async function downloadToCache(url, dataPath, metaPath, songTitle = '', cacheHash = '', isBackground = false) {
  const response = await axios.get(url, {
    headers: BILIBILI_HEADERS,
    responseType: 'stream',
    timeout: 30000,
  })

  const contentType = response.headers['content-type'] || 'audio/mp4'
  const expectedLength = parseInt(response.headers['content-length'])

  const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  const writeStream = fs.createWriteStream(tmpPath)

  await new Promise((resolve, reject) => {
    response.data.pipe(writeStream)
    response.data.on('error', reject)
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  const actualSize = fs.statSync(tmpPath).size
  const isComplete = !expectedLength || actualSize >= expectedLength

  if (!isComplete && !isBackground) {
    fs.unlinkSync(tmpPath)
    throw new Error(`数据不完整: ${actualSize}/${expectedLength}`)
  }

  try {
    fs.renameSync(tmpPath, dataPath)
  } catch {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
  }

  writeMeta(metaPath, {
    contentType,
    size: actualSize,
    url: url.slice(0, 100),
    createdAt: Date.now(),
    complete: isComplete,
  })

  const tag = isBackground ? 'BG-FETCH' : 'STORED'
  console.log(`[Cache] ${tag}  size=${actualSize}  complete=${isComplete}  title="${songTitle}"  file=${cacheHash}`)
  setImmediate(cleanCache)
}

export default router
