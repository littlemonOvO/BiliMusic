import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import searchRoutes from './routes/search.js'
import audioRoutes from './routes/audio.js'
import imageRoutes from './routes/image.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())

// 速率限制：每分钟最多 60 次请求
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
})
app.use('/api/', limiter)

// API 路由
app.use('/api/search', searchRoutes)
app.use('/api/audio', audioRoutes)
app.use('/api/image', imageRoutes)

// 生产环境：托管前端静态文件
const clientDist = join(__dirname, '../client/dist')
app.use(express.static(clientDist))

// SPA 回退：非 API 路由返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(join(clientDist, 'index.html'))
  }
})

app.listen(PORT, () => {
  console.log(`BiliMusic server running at http://localhost:${PORT}`)
})
