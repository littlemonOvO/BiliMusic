import { Router } from 'express'
import { search } from '../services/bilibili.js'

const router = Router()

// 搜索音乐
router.get('/', async (req, res) => {
  const { keyword, page = 1, order = '' } = req.query
  const reqId = `[${Date.now()}]`
  const t0 = Date.now()

  console.log(`${reqId} === SEARCH REQUEST ===`)
  console.log(`${reqId} keyword="${keyword}" page=${page} order="${order}"`)
  console.log(`${reqId} query raw:`, JSON.stringify(req.query))

  if (!keyword) {
    console.log(`${reqId} REJECT: missing keyword`)
    return res.json({ success: false, message: '请输入搜索关键词' })
  }

  try {
    const data = await search(keyword, Number(page), order, reqId)
    const elapsed = Date.now() - t0
    console.log(`${reqId} SEARCH OK: ${data.results.length} results, total=${data.total}, numPages=${data.numPages}, elapsed=${elapsed}ms`)
    res.json({ success: true, data })
  } catch (err) {
    const elapsed = Date.now() - t0
    console.error(`${reqId} SEARCH ERROR: ${err.message}, elapsed=${elapsed}ms`)
    console.error(`${reqId} error stack:`, err.stack)
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
