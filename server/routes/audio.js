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

// 音频流代理：完整下载到磁盘缓存，服务端用 fs.createReadStream 处理 Range 请求
// 解决 B站 CDN 对单连接数据量限制导致的中途断流问题
router.get('/stream', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    const { dataPath, metaPath } = getCachePath(url)

    // 检查缓存是否有效，记录缓存命中/未命中日志
    const cacheValid = isCacheValid(dataPath, metaPath)
    const oldMeta = readMeta(metaPath)

    if (cacheValid) {
      const age = Date.now() - fs.statSync(dataPath).mtimeMs
      console.log(`[Cache] HIT  age=${formatAge(age)}  size=${oldMeta?.size || '?'}  url=${url.slice(0, 80)}`)
    } else {
      if (oldMeta) {
        const age = Date.now() - (oldMeta.createdAt || 0)
        console.log(`[Cache] MISS age=${formatAge(age)}  reason=invalid  url=${url.slice(0, 80)}`)
      } else {
        console.log(`[Cache] MISS age=N/A  reason=not_found  url=${url.slice(0, 80)}`)
      }

      // 下载到磁盘
      const response = await axios.get(url, {
        headers: BILIBILI_HEADERS,
        responseType: 'stream',
        timeout: 30000,
      })

      const contentType = response.headers['content-type'] || 'audio/mp4'
      const expectedLength = parseInt(response.headers['content-length'])

      // 先写到临时文件，下载完成后重命名（避免半截文件被当作有效缓存）
      const tmpPath = dataPath + '.tmp'
      const writeStream = fs.createWriteStream(tmpPath)

      await new Promise((resolve, reject) => {
        response.data.pipe(writeStream)
        response.data.on('error', reject)
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      // 校验完整性
      const actualSize = fs.statSync(tmpPath).size
      if (expectedLength && actualSize < expectedLength) {
        fs.unlinkSync(tmpPath)
        throw new Error(`数据不完整: ${actualSize}/${expectedLength}`)
      }

      // 重命名为正式缓存文件
      fs.renameSync(tmpPath, dataPath)

      // 写入元数据
      writeMeta(metaPath, {
        contentType,
        size: actualSize,
        url: url.slice(0, 100),
        createdAt: Date.now(),
      })

      console.log(`[Cache] STORED  size=${actualSize}  url=${url.slice(0, 80)}`)

      // 异步清理缓存（不阻塞响应）
      setImmediate(cleanCache)
    }

    // 读取缓存元数据
    const meta = readMeta(metaPath)
    const contentType = meta?.contentType || 'audio/mp4'
    const fileSize = fs.statSync(dataPath).size

    // 处理 Range 请求（fs.createReadStream 原生支持）
    const range = req.headers.range
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : fileSize - 1
        if (start < fileSize) {
          res.status(206)
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          res.setHeader('Content-Length', end - start + 1)
          res.setHeader('Content-Type', contentType)
          res.setHeader('Accept-Ranges', 'bytes')
          fs.createReadStream(dataPath, { start, end }).pipe(res)
          return
        }
      }
    }

    // 返回完整文件
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', fileSize)
    res.setHeader('Accept-Ranges', 'bytes')
    fs.createReadStream(dataPath).pipe(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '音频流获取失败' })
    }
  }
})

export default router
