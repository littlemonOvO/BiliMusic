import { Router } from 'express'
import { search } from '../services/bilibili.js'

const router = Router()

// 搜索音乐
router.get('/', async (req, res) => {
  try {
    const { keyword, page = 1 } = req.query

    if (!keyword) {
      return res.json({ success: false, message: '请输入搜索关键词' })
    }

    const data = await search(keyword, Number(page))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
