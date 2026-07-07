import { Router } from 'express'
import axios from 'axios'
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

// 音频流代理：转发音频请求，附加 Referer 头
router.get('/stream', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    const response = await axios.get(url, {
      headers: BILIBILI_HEADERS,
      responseType: 'stream',
      timeout: 15000,
    })

    // 转发 Content-Type 和 Content-Length
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mp4')
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length'])
    }
    // 支持 Range 请求（用于拖动进度条）
    res.setHeader('Accept-Ranges', 'bytes')

    response.data.pipe(res)
  } catch (err) {
    res.status(500).json({ success: false, message: '音频流获取失败' })
  }
})

export default router
