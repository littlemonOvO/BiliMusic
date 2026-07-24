import { Router } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'
import { fileURLToPath } from 'url'
import { getAudioUrl } from '../services/bilibili.js'
import { BILIBILI_HEADERS } from '../lib/constants.js'
import { isAllowedUrl } from '../lib/urlGuard.js'
import { parseRange } from '../lib/range.js'

const router = Router()

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

// 启动时清理残留 .tmp（上次进程崩溃/被杀时中断的下载留下，无对应 .dat）
// 启动时没有下载在进行，故所有 .tmp 都是残留，可安全删除
try {
  for (const f of fs.readdirSync(CACHE_DIR)) {
    if (f.endsWith('.tmp')) {
      fs.unlinkSync(path.join(CACHE_DIR, f))
      console.log(`[Cache] 启动清理残留临时文件: ${f}`)
    }
  }
} catch (e) {
  console.error(`[Cache] 启动清理 .tmp 失败: ${e.message}`)
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

// 后台补全锁：同一首歌只允许一个 downloadToCache 在跑
const bgFetchLocks = new Set()

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

// LFU 清理：超过上限时，优先淘汰命中数最低的；命中数相同则淘汰创建时间最早的
function cleanCache() {
  try {
    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.dat'))
      .map((f) => {
        const fullPath = path.join(CACHE_DIR, f)
        const metaPath = fullPath.replace('.dat', '.meta')
        const stats = fs.statSync(fullPath)
        const meta = readMeta(metaPath)
        return {
          path: fullPath,
          hits: meta?.hits ?? 0,
          // meta 缺失或无 createdAt 时回退到文件 mtime
          createdAt: meta?.createdAt ?? stats.mtimeMs,
        }
      })
      .sort((a, b) => a.hits - b.hits || a.createdAt - b.createdAt)

    while (files.length > MAX_CACHE_FILES) {
      const victim = files.shift()
      fs.unlinkSync(victim.path)
      const metaPath = victim.path.replace('.dat', '.meta')
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
    }
  } catch {
    // 清理失败不影响主流程
  }
}

// 分块下载到 writable sink：首段拉取后，若未拉满 expectedLength 则用 Range 续传，
// 直到拉满或达到 MAX_CHUNKS。B站 CDN 中断后自动断点续传。
// /stream 与 downloadToCache 共用此逻辑，避免两处各写一份分块/续传代码。
//
// - sink：数据写入目标（流式路径传 PassThrough，磁盘补全传 fs.WriteStream）
// - onFirst(resp, contentType, expectedLength)：首段响应到达、数据流出前的钩子
//   （流式路径用于设置客户端响应头；磁盘补全仅用于打日志）
// - onProgress(downloadedBytes)：每段下载后回调（流式路径用于客户端断开日志的字节数）
// - tag：日志前缀（流式路径为 ''，磁盘补全为 'BG'/'DL'）
// 返回 { contentType, expectedLength, downloadedBytes, hadError }
async function fetchSegments(url, sink, { log, tag = '', onFirst = null, onProgress = null } = {}) {
  const MAX_CHUNKS = 10
  const prefix = tag ? `${tag}-` : ''
  let contentType = 'audio/mp4'
  let expectedLength = 0
  let downloadedBytes = 0
  let chunkIndex = 0
  let hadError = false

  // 把一段已打开的 resp.data 流入 sink（带 backpressure），返回 { size, error }
  // 错误不 reject：返回已下载部分，由调用方决定是否续传
  function pipeSegment(resp, startByte, chunkContentLength) {
    let chunkSize = 0
    const t0 = Date.now()
    return new Promise((resolve) => {
      resp.data.on('data', (chunk) => {
        chunkSize += chunk.length
        const ok = sink.write(chunk)
        if (!ok) {
          resp.data.pause()
          sink.once('drain', () => resp.data.resume())
        }
      })
      resp.data.on('end', () => {
        const elapsed = Date.now() - t0
        log(`${prefix}CHUNK-DONE  chunk=${chunkIndex}  chunkSize=${chunkSize}  chunkContentLength=${chunkContentLength || 'N/A'}  elapsed=${elapsed}ms  total=${chunkSize + startByte}/${expectedLength}`)
        resolve({ size: chunkSize, error: null })
      })
      resp.data.on('error', (err) => {
        const elapsed = Date.now() - t0
        log(`${prefix}CHUNK-ERROR  chunk=${chunkIndex}  chunkSize=${chunkSize}  elapsed=${elapsed}ms  error=${err.message}  total=${chunkSize + startByte}/${expectedLength}`)
        resolve({ size: chunkSize, error: err })
      })
    })
  }

  // 首段
  chunkIndex = 1
  {
    const resp = await axios.get(url, {
      headers: BILIBILI_HEADERS,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: (s) => s >= 200 && s < 400,
    })
    contentType = resp.headers['content-type'] || 'audio/mp4'
    expectedLength = parseInt(resp.headers['content-length'])
    onFirst?.(resp, contentType, expectedLength)

    // 首段是全量 GET，chunk 内容长度即总长度
    const result = await pipeSegment(resp, 0, expectedLength)
    downloadedBytes += result.size
    onProgress?.(downloadedBytes)
    if (result.error) {
      log(`${prefix}INTERRUPT  chunk=1  downloaded=${downloadedBytes}/${expectedLength}  error=${result.error.message}`)
      hadError = true
    }
  }

  // 后续段：B站中断后用 Range 请求从断点继续
  // 注意：不能仅靠 result.error 判断是否完整，B站 CDN 有时提前 end 但数据不完整
  while (expectedLength && downloadedBytes < expectedLength && chunkIndex < MAX_CHUNKS) {
    chunkIndex++
    try {
      const resp = await axios.get(url, {
        headers: { ...BILIBILI_HEADERS, Range: `bytes=${downloadedBytes}-` },
        responseType: 'stream',
        timeout: 30000,
        validateStatus: (s) => s >= 200 && s < 400,
      })
      const chunkContentLength = parseInt(resp.headers['content-length'])
      const contentRange = resp.headers['content-range']
      log(`${prefix}RESUME  chunk=${chunkIndex}  bytes=${downloadedBytes}-  status=${resp.status}  contentLength=${chunkContentLength || 'N/A'}  contentRange=${contentRange || 'N/A'}`)

      const result = await pipeSegment(resp, downloadedBytes, chunkContentLength)
      downloadedBytes += result.size
      onProgress?.(downloadedBytes)
      if (result.error) {
        log(`${prefix}INTERRUPT  chunk=${chunkIndex}  downloaded=${downloadedBytes}/${expectedLength}  error=${result.error.message}`)
        hadError = true
      }
    } catch (chunkErr) {
      log(`${prefix}CHUNK-ERROR  chunk=${chunkIndex}  downloaded=${downloadedBytes}/${expectedLength}  error=${chunkErr.message}`)
      hadError = true
      break
    }
  }

  log(`${prefix}DOWNLOAD-END  downloaded=${downloadedBytes}/${expectedLength}  chunks=${chunkIndex}  hadError=${hadError}`)
  return { contentType, expectedLength, downloadedBytes, hadError }
}

// 音频流代理：
// - 缓存命中：从磁盘读取，支持 Range 请求
// - 缓存未命中：从 B站 CDN 边下载边响应客户端，同时写入磁盘缓存
// 解决 B站 CDN 对单连接数据量限制导致的中途断流问题
router.get('/stream', async (req, res) => {
  const reqId = Date.now() +(Math.random()*1000 | 0)
  const log = (msg) => console.log(`[Cache:${reqId}] ${msg}`)

  try {
    const { url, title, bvid } = req.query
    const songTitle = title ? decodeURIComponent(title) : ''
    const rangeHeader = req.headers.range

    log(`REQUEST  title="${songTitle}"  bvid=${bvid || 'N/A'}  range=${rangeHeader || 'none'}  url=${url?.slice(0, 80)}...`)

    if (!url) {
      log('REJECT  reason=missing_url')
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    if (!isAllowedUrl(url)) {
      log(`REJECT  reason=blocked_host  url=${url.slice(0, 80)}`)
      return res.status(403).json({ success: false, message: '不允许的 URL 域名' })
    }

    const { dataPath, metaPath } = getCachePath(url, bvid)
    const cacheHash = path.basename(dataPath, '.dat')

    // 检查缓存是否有效
    const { valid: cacheValid, complete: cacheComplete } = checkCache(dataPath, metaPath)
    const oldMeta = readMeta(metaPath)

    // 解析 Range 请求
    const range = parseRange(rangeHeader)
    const hasRange = !!range
    const rangeStart = range?.start ?? 0

    if (cacheValid) {
      // ===== 缓存命中：从磁盘读取，支持 Range =====
      const age = Date.now() - fs.statSync(dataPath).mtimeMs
      const tag = cacheComplete ? 'HIT' : 'HIT-PARTIAL'
      const fileSize = fs.statSync(dataPath).size
      log(`${tag}  age=${formatAge(age)}  size=${fileSize}  complete=${cacheComplete}  title="${songTitle}"  file=${cacheHash}`)

      const meta = readMeta(metaPath)
      const contentType = meta?.contentType || 'audio/mp4'

      // 命中计数 +1（用于 LFU 淘汰：命中数最低优先淘汰）
      if (meta) {
        meta.hits = (meta.hits || 0) + 1
        writeMeta(metaPath, meta)
      }

      // 缓存不完整时，后台异步补全下载（加锁防止并发）
      if (!cacheComplete && !bgFetchLocks.has(cacheHash)) {
        bgFetchLocks.add(cacheHash)
        log(`BG-FETCH  title="${songTitle}"  file=${cacheHash}`)

        // 用 bvid 重新获取新鲜 URL，避免使用过期的 B站签名 URL
        const bgFetchPromise = bvid
          ? getAudioUrl(bvid)
              .then((data) => data.audioUrl)
              .catch((err) => {
                log(`BG-FETCH URL-REFRESH FAILED: ${err.message}, falling back to cached url`)
                return url
              })
          : Promise.resolve(url)

        bgFetchPromise
          .then((freshUrl) => downloadToCache(freshUrl, dataPath, metaPath, songTitle, cacheHash, true))
          .catch((err) => {
            log(`BG-FETCH FAILED: ${err.message}  title="${songTitle}"  file=${cacheHash}`)
          })
          .finally(() => {
            bgFetchLocks.delete(cacheHash)
          })
      } else if (!cacheComplete && bgFetchLocks.has(cacheHash)) {
        log(`BG-FETCH SKIP (locked)  title="${songTitle}"  file=${cacheHash}`)
      }

      if (hasRange && rangeStart < fileSize) {
        const end = range.end ?? fileSize - 1
        res.status(206)
        res.setHeader('Content-Range', `bytes ${rangeStart}-${end}/${fileSize}`)
        res.setHeader('Content-Length', end - rangeStart + 1)
        res.setHeader('Content-Type', contentType)
        res.setHeader('Accept-Ranges', 'bytes')
        log(`SERVE  range=${rangeStart}-${end}/${fileSize}  from=cache`)
        fs.createReadStream(dataPath, { start: rangeStart, end }).pipe(res)
      } else {
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Length', fileSize)
        res.setHeader('Accept-Ranges', 'bytes')
        log(`SERVE  full=${fileSize}  from=cache`)
        fs.createReadStream(dataPath).pipe(res)
      }
      return
    }

    // ===== 缓存未命中 =====
    if (oldMeta) {
      const age = Date.now() - (oldMeta.createdAt || 0)
      const actualSize = fs.existsSync(dataPath) ? fs.statSync(dataPath).size : 0
      log(`MISS  age=${formatAge(age)}  reason=invalid  metaSize=${oldMeta.size}  actualSize=${actualSize}  title="${songTitle}"  file=${cacheHash}`)
    } else {
      log(`MISS  age=N/A  reason=not_found  title="${songTitle}"  file=${cacheHash}`)
    }

    // 如果客户端请求非零起点 Range（seek），无法从 B站流中途开始，
    // 回退到先完整下载再从磁盘读取
    if (hasRange && rangeStart > 0) {
      log(`SEEK  rangeStart=${rangeStart}  falling back to downloadToCache`)

      // 客户端断开时取消下载
      let seekAborted = false
      const onSeekClose = () => {
        seekAborted = true
        log(`SEEK-ABORT  client disconnected during download`)
      }
      req.on('close', onSeekClose)

      try {
        await downloadToCache(url, dataPath, metaPath, songTitle, cacheHash, false)
      } finally {
        req.off('close', onSeekClose)
      }

      // 客户端已断开，不再写响应
      if (seekAborted || res.writableEnded) {
        log(`SEEK-SKIP  client gone, cache stored`)
        return
      }

      const meta = readMeta(metaPath)
      const contentType = meta?.contentType || 'audio/mp4'
      const fileSize = fs.statSync(dataPath).size
      const end = range.end ?? fileSize - 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${rangeStart}-${end}/${fileSize}`)
      res.setHeader('Content-Length', end - rangeStart + 1)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Accept-Ranges', 'bytes')
      log(`SERVE  range=${rangeStart}-${end}/${fileSize}  from=downloaded`)
      fs.createReadStream(dataPath, { start: rangeStart, end }).pipe(res)
      return
    }

    // 从 B站 CDN 边下载边响应客户端 + 同时写入磁盘缓存
    // B站 CDN 中断时自动从断点继续下载，拼接成完整流
    log(`STREAM  title="${songTitle}"  file=${cacheHash}  url=${url.slice(0, 80)}...`)

    // 临时文件用于缓存
    const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
    const writeStream = fs.createWriteStream(tmpPath)

    // PassThrough 作为中转：分块下载的数据都写入这里，再 pipe 到客户端和磁盘
    const passThrough = new PassThrough()
    passThrough.pipe(res)
    passThrough.pipe(writeStream)

    // 客户端断开时：让下载继续写磁盘，只停止给客户端
    let clientClosed = false
    const progress = { downloaded: 0, expected: 0 }
    req.on('close', () => {
      clientClosed = true
      passThrough.unpipe(res)
      log(`CLIENT-DISCONNECT  downloaded=${progress.downloaded}/${progress.expected || 'N/A'}`)
    })

    // 分块下载（首段 + 断点续传）统一由 fetchSegments 处理
    let seg
    try {
      seg = await fetchSegments(url, passThrough, {
        log,
        tag: '',
        onFirst: (resp, ct, len) => {
          progress.expected = len
          log(`BILI-RESP  status=${resp.status}  contentLength=${len || 'N/A'}  contentType=${ct}`)
          res.setHeader('Content-Type', ct)
          if (len) res.setHeader('Content-Length', len)
          res.setHeader('Accept-Ranges', 'bytes')
          res.status(200)
        },
        onProgress: (n) => {
          progress.downloaded = n
        },
      })
    } catch (e) {
      // 首段拉取失败（B站不可达等）：清理已创建的写流和临时文件后向上抛
      passThrough.destroy()
      writeStream.destroy()
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
      throw e
    }
    const { contentType, expectedLength, downloadedBytes, hadError } = seg

    // 结束 passThrough，pipe 会自动 end writeStream 和 res
    // 注意：不要手动 writeStream.end()，否则 PassThrough 缓冲里剩余数据会丢失
    // （pipe 的 end 是异步触发的，同步 end writeStream 会让它提前进入 ended 状态）
    if (!clientClosed && hadError && downloadedBytes < expectedLength) {
      // 数据不完整时，先 unpipe 让 PassThrough 剩余数据继续写磁盘，并明确 end res
      passThrough.unpipe(res)
      if (!res.writableEnded) {
        log(`CLOSING-CLIENT  reason=incomplete_data  downloaded=${downloadedBytes}/${expectedLength}`)
        res.end()
      }
    }
    passThrough.end()

    writeStream.on('finish', () => {
      const actualSize = fs.statSync(tmpPath).size
      const isComplete = !expectedLength || actualSize >= expectedLength
      if (!isComplete) {
        log(`INCOMPLETE  actual=${actualSize}/${expectedLength}  keeping partial cache`)
      }
      try {
        fs.renameSync(tmpPath, dataPath)
      } catch {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      }
      writeMeta(metaPath, {
        contentType,
        size: actualSize,
        url: '',
        createdAt: Date.now(),
        complete: isComplete,
        hits: 0,
      })
      log(`STORED  size=${actualSize}  complete=${isComplete}  title="${songTitle}"  file=${cacheHash}`)
      setImmediate(cleanCache)
    })

    writeStream.on('error', (err) => {
      log(`WRITE ERROR: ${err.message}`)
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
    })
  } catch (err) {
    console.error(`[Cache:${reqId}] STREAM ERROR: ${err.message}`)
    console.error(`[Cache:${reqId}] STACK: ${err.stack}`)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '音频流获取失败' })
    }
  }
})

// 完整下载到磁盘缓存（用于 seek 场景 / 后台补全不完整缓存）
// 支持 B站 CDN 中断后断点续传（分块逻辑由 fetchSegments 提供）
async function downloadToCache(url, dataPath, metaPath, songTitle = '', cacheHash = '', isBackground = false) {
  const reqId = Date.now() + (Math.random() * 1000 | 0)
  const log = (msg) => console.log(`[Cache:${reqId}] ${msg}`)
  const tag = isBackground ? 'BG' : 'DL'

  log(`${tag}-START  title="${songTitle}"  file=${cacheHash}  url=${url.slice(0, 80)}...`)

  const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  const writeStream = fs.createWriteStream(tmpPath)

  // 写入失败（磁盘满/EIO 等）时清理 .tmp，避免残留；下方 await 会感知 writeError 并抛出
  let writeError = null
  writeStream.on('error', (err) => {
    writeError = err
    log(`WRITE ERROR: ${err.message}`)
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath) } catch {}
    }
  })

  const { contentType, expectedLength, downloadedBytes } = await fetchSegments(url, writeStream, {
    log,
    tag,
    onFirst: (resp, ct, len) => {
      log(`${tag}-RESP  status=${resp.status}  contentLength=${len || 'N/A'}  contentType=${ct}`)
    },
  })

  writeStream.end()
  await new Promise((resolve) => {
    if (writeError) return resolve()
    writeStream.once('finish', resolve)
    writeStream.once('error', resolve)
  })
  if (writeError) throw new Error(`写入缓存失败: ${writeError.message}`)
  return finishDownload(tmpPath, dataPath, metaPath, contentType, expectedLength, downloadedBytes, songTitle, cacheHash, isBackground, reqId)
}

// 完成下载：重命名文件，写入元数据
function finishDownload(tmpPath, dataPath, metaPath, contentType, expectedLength, actualSize, songTitle, cacheHash, isBackground, reqId) {
  const log = (msg) => console.log(`[Cache:${reqId}] ${msg}`)
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
    url: '',
    createdAt: Date.now(),
    complete: isComplete,
    hits: 0,
  })

  const tag = isBackground ? 'BG-FETCH' : 'STORED'
  log(`${tag}  size=${actualSize}  complete=${isComplete}  title="${songTitle}"  file=${cacheHash}`)
  setImmediate(cleanCache)
}

export default router