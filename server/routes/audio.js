import { Router } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
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

// URL -> 缓存文件名（MD5 哈希，避免非法字符）
function getCachePath(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex')
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

// 检查缓存是否有效（文件存在且大小匹配，不设 TTL）
function isCacheValid(dataPath, metaPath) {
  if (!fs.existsSync(dataPath) || !fs.existsSync(metaPath)) return false
  const stats = fs.statSync(dataPath)
  const meta = readMeta(metaPath)
  if (!meta) return false
  if (stats.size !== meta.size) return false
  return true
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
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    if (!isAllowedUrl(url)) {
      return res.status(403).json({ success: false, message: '不允许的 URL 域名' })
    }

    const { dataPath, metaPath } = getCachePath(url)

    // 检查缓存是否有效
    const cacheValid = isCacheValid(dataPath, metaPath)
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
      console.log(`[Cache] HIT  age=${formatAge(age)}  size=${oldMeta?.size || '?'}  url=${url.slice(0, 80)}`)

      const meta = readMeta(metaPath)
      const contentType = meta?.contentType || 'audio/mp4'
      const fileSize = fs.statSync(dataPath).size

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
      console.log(`[Cache] MISS age=${formatAge(age)}  reason=invalid  url=${url.slice(0, 80)}`)
    } else {
      console.log(`[Cache] MISS age=N/A  reason=not_found  url=${url.slice(0, 80)}`)
    }

    // 如果客户端请求非零起点 Range（seek），无法从 B站流中途开始，
    // 回退到先完整下载再从磁盘读取
    if (hasRange && rangeStart > 0) {
      await downloadToCache(url, dataPath, metaPath)
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
    console.log(`[Cache] STREAM  url=${url.slice(0, 80)}`)
    const response = await axios.get(url, {
      headers: BILIBILI_HEADERS,
      responseType: 'stream',
      timeout: 30000,
    })

    const contentType = response.headers['content-type'] || 'audio/mp4'
    const expectedLength = parseInt(response.headers['content-length'])

    // 响应头（用 200 返回完整流，客户端可缓冲后播放）
    res.setHeader('Content-Type', contentType)
    if (expectedLength) {
      res.setHeader('Content-Length', expectedLength)
    }
    res.setHeader('Accept-Ranges', 'bytes')
    res.status(200)

    // 同时写入临时文件用于缓存
    const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
    const writeStream = fs.createWriteStream(tmpPath)

    // 将 B站数据流同时 pipe 到客户端和磁盘
    response.data.on('data', (chunk) => {
      writeStream.write(chunk)
    })

    // 客户端提前断开时清理
    req.on('close', () => {
      response.data.destroy()
      writeStream.destroy()
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
    })

    // 流结束时：完成磁盘写入，重命名为正式缓存
    response.data.on('end', () => {
      writeStream.end()
    })

    response.data.on('error', (err) => {
      console.error(`[Cache] STREAM ERROR: ${err.message}`)
      writeStream.destroy()
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: '音频流获取失败' })
      } else {
        res.end()
      }
    })

    writeStream.on('finish', () => {
      const actualSize = fs.statSync(tmpPath).size
      if (expectedLength && actualSize < expectedLength) {
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
      })
      console.log(`[Cache] STORED  size=${actualSize}  url=${url.slice(0, 80)}`)
      setImmediate(cleanCache)
    })

    writeStream.on('error', (err) => {
      console.error(`[Cache] WRITE ERROR: ${err.message}`)
      response.data.destroy()
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
    })

    // pipe 到客户端
    response.data.pipe(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '音频流获取失败' })
    }
  }
})

// 完整下载到磁盘缓存（用于 seek 场景，必须先完整下载）
async function downloadToCache(url, dataPath, metaPath) {
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
  if (expectedLength && actualSize < expectedLength) {
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
  })

  console.log(`[Cache] STORED  size=${actualSize}  url=${url.slice(0, 80)}`)
  setImmediate(cleanCache)
}

export default router
