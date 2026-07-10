import { Router } from 'express'
import axios from 'axios'

const router = Router()

const BILIBILI_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
}

// 图片代理：转发图片请求，附加 Referer 头（避免 B站防盗链）
router.get('/', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少 url 参数' })
    }

    const response = await axios.get(url, {
      headers: BILIBILI_HEADERS,
      responseType: 'stream',
      timeout: 10000,
    })

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')

    response.data.pipe(res)

    req.on('close', () => {
      response.data.destroy()
    })
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '图片获取失败' })
    }
  }
})

export default router
