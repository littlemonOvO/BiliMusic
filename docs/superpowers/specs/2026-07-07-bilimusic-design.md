# BiliMusic 设计文档

> 创建日期：2026-07-07
> 最后更新：2026-07-17
> 状态：已确认

## 1. 项目概述

BiliMusic 是一个基于 Web 的音乐应用，允许用户搜索、播放 Bilibili 平台上的音乐内容，并支持收藏和歌单管理。应用采用前后端分离架构，免登录，收藏和歌单数据存储在本地。

### 核心功能

- **搜索**：搜索 Bilibili 上的音乐/视频内容
- **在线播放**：播放音频流，支持播放控制（播放/暂停、进度、音量、静音）、播放队列、播放模式切换
- **收藏与歌单**：收藏喜欢的音乐，创建和管理自定义歌单
- **播放队列管理**：独立播放队列，支持去重、插入下一首、清空、列表循环/随机播放

### 非目标（YAGNI）

- 不支持用户登录/Bilibili 账号关联
- 不支持歌词显示
- 不支持评论区
- 不支持音频下载

### 主题模式

- 支持深色（NEON SOUNDFLOW，默认）与浅色（FROST ARCTIC，冷白 + 青色）双主题
- 通过顶栏切换按钮即时切换，选择持久化到 localStorage
- 主题相关令牌（颜色/发光/玻璃/遮罩/阴影）由 CSS 变量驱动，结构令牌（间距/圆角/过渡/字体）保持静态

## 2. 技术架构

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Vue 3（Composition API + `<script setup>`） |
| 构建工具 | Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| 样式 | 手写 SCSS（设计令牌系统） |
| 字体 | @fontsource 本地字体（避免 CDN 被墙） |
| 后端 | Node.js + Express |
| 通信 | REST API（JSON） |

### 项目目录结构

```
BiliMusic/
├── client/                    # 前端 Vue 3 应用
│   ├── public/                # 静态资源
│   ├── src/
│   │   ├── api/               # 前端 API 调用封装
│   │   │   └── index.js       # axios 封装，统一 API 调用
│   │   ├── assets/            # 图片、图标等
│   │   ├── components/        # 可复用组件
│   │   │   ├── SearchBar.vue
│   │   │   ├── MusicList.vue
│   │   │   ├── MusicItem.vue
│   │   │   ├── QueuePanel.vue     # 播放队列面板
│   │   │   ├── PlaylistModal.vue
│   │   │   └── AddToPlaylistModal.vue
│   │   ├── composables/       # 组合式函数
│   │   │   └── useToast.js    # Toast 通知
│   │   ├── views/             # 页面视图
│   │   │   ├── SearchView.vue
│   │   │   ├── PlayerView.vue
│   │   │   ├── FavoritesView.vue
│   │   │   └── PlaylistsView.vue
│   │   ├── stores/            # Pinia 状态管理
│   │   │   ├── player.js      # 播放器 + 播放队列
│   │   │   ├── favorites.js
│   │   │   └── playlists.js
│   │   ├── router/            # 路由配置
│   │   │   └── index.js
│   │   ├── styles/            # 全局样式
│   │   │   ├── variables.scss # SCSS 设计令牌
│   │   │   ├── global.scss    # 全局样式
│   │   │   └── mixins.scss    # SCSS mixins
│   │   ├── App.vue            # 根组件（含底部播放栏）
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                    # 后端 Express 服务
│   ├── routes/
│   │   ├── search.js          # /api/search 路由
│   │   └── audio.js           # /api/audio/url 和 /api/audio/stream 路由（含磁盘缓存、流式中转、断点续传）
│   ├── services/
│   │   └── bilibili.js        # Bilibili API 封装（WBI 签名、Cookie TTL 缓存）
│   ├── cache/
│   │   └── audio/             # 音频磁盘缓存目录（.dat 数据 + .meta 元数据，LRU 最多 200 个）
│   ├── app.js                 # Express 应用入口
│   └── package.json
├── package.json               # 根目录，统一管理脚本
└── docs/                      # 文档
```

### 开发与部署

- **开发环境**：前端运行在 Vite dev server（`localhost:5173`），后端运行在 Express（`localhost:3000`）。Vite proxy 配置将 `/api` 请求转发到后端
- **根目录脚本**：
  - `npm run dev`：同时启动前后端开发服务（使用 concurrently）
  - `npm run build`：构建前端静态文件到 `client/dist`
  - `npm start`：启动后端生产服务，同时托管前端静态文件

## 3. Bilibili API 实现

### 搜索功能

- **接口**：`GET https://api.bilibili.com/x/web-interface/search/type`
- **参数**：`search_type=video`、`keyword=关键词`、`page=页码`
- **返回数据提取**：标题（`title`）、UP主（`author`）、封面（`pic`）、BVID（`bvid`）、时长（`duration`）
- **请求头**：需设置 `Referer: https://www.bilibili.com` 和 `User-Agent`

### 获取视频详情（获取 cid）

- **接口**：`GET https://api.bilibili.com/x/web-interface/view`
- **参数**：`bvid=BV...`
- **返回**：`cid`（用于获取播放地址）、分P列表

### 获取音频地址

- **接口**：`GET https://api.bilibili.com/x/player/playurl`
- **参数**：`bvid`、`cid`、`fnval=16`（DASH 格式）
- **处理**：从返回的 DASH 数据中提取 `dash.audio` 数组，取第一个音频流的 `baseUrl` 作为播放地址
- **防盗链处理**：Bilibili 音频流地址会检查 `Referer` 头，浏览器 `<audio>` 标签无法设置该头。因此后端需要提供音频流代理端点，转发请求并附加正确的请求头

### 后端 API 设计

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/search` | GET | `keyword`、`page` | 搜索音乐，返回格式化结果列表 |
| `/api/audio/url` | GET | `bvid` | 获取音频流地址，后端内部完成 bvid→cid→playurl 的完整流程 |
| `/api/audio/stream` | GET | `url`、`bvid`、`title` | 音频流代理：边下载边响应客户端 + 磁盘缓存，支持 Range 请求与断点续传 |

### 音频流代理实现（关键）

由于 B站 CDN 对单个连接有数据量限制（约 150s 数据量后会中断），且浏览器 Range 续传请求 B站不响应，音频流代理采用**磁盘缓存 + 流式中转**方案，避免每次播放都回源 B站，并通过断点续传自动补齐被中断的数据：

#### 缓存存储

- **缓存目录**：`server/cache/audio/`
- **缓存键**：优先用 `bvid` 的 MD5（而非 URL），保证同一首歌即使 B站签名 URL 变化也能命中缓存
- **文件结构**：
  - `<hash>.dat`：音频数据
  - `<hash>.meta`：JSON 元数据（`contentType`、`size`、`complete`、`createdAt`）
- **临时文件**：下载时写入 `<hash>.<pid>.<ts>.<rand>.tmp`，完成后 `rename` 为 `.dat`，防止并发写入冲突
- **LRU 清理**：超过 `MAX_CACHE_FILES=200` 时删除最旧文件（按 mtime 排序）

#### 缓存命中流程（HIT / HIT-PARTIAL）

1. `checkCache()` 校验 `.dat` 与 `.meta` 是否存在且 `size` 一致
2. `meta.complete !== false` 标记为完整缓存（HIT），否则为部分缓存（HIT-PARTIAL）
3. 从磁盘读取并支持 Range 请求（206 响应）
4. **部分缓存后台补全**：若 `!cacheComplete` 且无锁，用 `bgFetchLocks`（Set）加锁后异步调用 `downloadToCache` 补全；期间仍用已缓存数据响应客户端
5. **BG-FETCH URL 刷新**：后台补全不使用客户端传来的过期 URL，而是用 `bvid` 调用 `getAudioUrl` 获取新鲜签名 URL，刷新失败则回退到原 URL

#### 缓存未命中流程（MISS）

分两种场景：

**1. 普通播放（无 Range 或 rangeStart=0）-- 流式中转**

采用 PassThrough 双 pipe 架构，边下载边响应客户端，同时写入磁盘缓存：

```javascript
const passThrough = new PassThrough()
passThrough.pipe(res)         // 流向客户端
passThrough.pipe(writeStream) // 流向磁盘临时文件
```

- **分块下载**：第一段复用初始 response；B站中断后用 Range 请求从断点继续（最多 10 个 chunk）
- **背压处理**：`passThrough.write` 返回 false 时暂停上游，`drain` 事件恢复
- **客户端断开**：`req.on('close')` 时 `unpipe(res)` 停止向客户端写入，但**继续下载写磁盘**，避免浪费已下载的数据
- **数据不完整处理**：`hadError && downloadedBytes < expectedLength` 时 `unpipe(res)` 并 `res.end()` 结束客户端响应，但 PassThrough 仍会 flush 剩余缓冲到磁盘
- **关键细节**：不要手动 `writeStream.end()`，否则 PassThrough 缓冲里剩余数据会丢失（pipe 的 end 是异步触发的）

**2. Seek 场景（rangeStart > 0）-- 先完整下载再切片**

B站 CDN 不支持从中间位置开始流式返回，因此 seek 时回退到 `downloadToCache` 完整下载：

- `req.on('close')` 监听客户端断开，设置 `seekAborted` 标志
- 下载完成后检查 `seekAborted || res.writableEnded`，若客户端已断开则不再写响应
- 否则从磁盘按 Range 读取返回 206

#### 断点续传机制

B站 CDN 会在数据量达到阈值后中断连接（`aborted` 错误），处理策略：

- 捕获 `error` 事件但**不 reject**，返回 `{ size, error }` 让循环继续
- 用 `Range: bytes=<downloadedBytes>-` 发起续传请求（B站 CDN 支持 206 响应）
- 最多重试 `MAX_CHUNKS=10` 次
- 注意：B站 CDN 有时提前 `end` 但数据不完整，需对比 `downloadedBytes` 与 `expectedLength` 判断

#### 不完整缓存的处理

- `finishDownload` 中对比 `actualSize` 与 `expectedLength`，写入 meta 的 `complete` 字段
- `complete=false` 的缓存仍可被命中（HIT-PARTIAL），并触发后台补全
- 后台补全失败时保留部分缓存，下次播放再次尝试

### 请求头处理

后端调用 Bilibili API 时统一设置：
```
Referer: https://www.bilibili.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Cookie: （可选，用于提升接口可用性）
```

### 统一响应格式

```json
{
  "success": true,
  "data": { ... }
}
```

错误时：
```json
{
  "success": false,
  "message": "错误描述"
}
```

## 4. 前端设计

### 页面与路由

| 路径 | 视图 | 说明 |
|------|------|------|
| `/` | SearchView | 搜索页，默认首页 |
| `/player` | PlayerView | 播放器详情页 |
| `/favorites` | FavoritesView | 收藏列表（含"播放全部"按钮） |
| `/playlists` | PlaylistsView | 歌单列表及详情（含"播放歌单"/"加入播放列表"按钮） |

### 核心组件

- **SearchBar.vue**：搜索输入框，支持回车搜索
- **MusicList.vue**：音乐列表组件，可复用于搜索结果、收藏、歌单页面；透传 `play`/`add-to-playlist`/`add-to-next`/`remove` 事件
- **MusicItem.vue**：单条音乐条目，显示封面、标题、UP主、时长；操作按钮：收藏(♥)、添加到下一首(⏭)、添加到歌单(+)、从歌单移除(✕)
- **QueuePanel.vue**：播放队列面板（fixed 定位），显示当前队列，支持切歌、移除、收藏、添加到歌单、清空、切换播放模式
- **PlaylistModal.vue**：创建歌单的弹窗
- **AddToPlaylistModal.vue**：选择添加到哪个歌单的弹窗

### 底部播放栏（App.vue）

全局固定播放栏，无歌曲时收起（height:0 过渡），有歌曲时显示：
- 当前歌曲信息（封面、标题、UP主）
- 收藏按钮(♥)
- 添加到歌单按钮(＋) - 点击弹出 fixed 定位菜单
- 声波可视化（32 根柱状条，播放时动画）
- 播放控制（上一首、播放/暂停、下一首）
- 进度条（可拖动 seek）
- 音量控制（喇叭图标点击静音 + 滑块）
- 播放队列按钮(☰) - 显示队列数量徽标

### 状态管理（Pinia Stores）

**player.js**：
- `currentSong`：当前播放的歌曲对象
- `isPlaying`：播放状态
- `currentTime`：当前播放进度
- `duration`：总时长
- `volume`：音量（0-1）
- `prevVolume`：静音前的音量（用于取消静音恢复）
- `playQueue`：播放队列（深拷贝，与源数据隔离）
- `currentIndex`：当前播放索引
- `playMode`：播放模式（`'list'` 列表循环 | `'shuffle'` 随机播放）
- `isLoading`、`error`：加载状态和错误信息

核心方法：
- `play(song)`：获取音频流地址并播放
- `togglePlay()`：切换播放/暂停
- `setQueue(songs, index)`：设置播放队列（去重 + 深拷贝）
- `playPlaylist(songs)`：替换队列为歌单所有歌曲并播放第一首
- `addToQueue(songs)`：追加歌曲到队列末尾（去重），返回实际添加数量
- `playSingle(song)`：只播放一首歌（替换整个队列）
- `insertNext(song)`：插入到当前播放的下一首位置（去重），返回是否成功
- `playNext()` / `playPrev()`：根据播放模式切换下一首/上一首
- `playIndex(index)`：从队列中播放指定索引
- `removeFromQueue(bvid)`：从队列移除歌曲（若移除当前歌曲则自动播放下一首）
- `clearQueue()`：清空队列但保留 currentSong（等面板关闭时再清除）
- `flushEmpty()`：队列已空时真正清除 currentSong
- `toggleMute()`：切换静音
- `togglePlayMode()`：切换列表循环/随机播放

**favorites.js**：
- `items`：收藏的歌曲列表
- `isFavorite(bvid)`：判断是否已收藏
- `toggle(song)`：添加/移除收藏
- 自动同步到 localStorage

**playlists.js**：
- `playlists`：歌单列表（每个歌单含 id、name、songs、createdAt）
- `createPlaylist(name)`：创建歌单
- `addToPlaylist(playlistId, song)`：添加歌曲到歌单（已去重）
- `removeFromPlaylist(playlistId, bvid)`：从歌单移除歌曲
- `getPlaylist(id)`、`isInPlaylist(playlistId, bvid)`、`deletePlaylist(id)`、`renamePlaylist(id, name)`
- 自动同步到 localStorage

### 数据隔离与去重

- **数据隔离**：所有进入播放队列的歌曲都通过 `songs.map(s => ({...s}))` 深拷贝，避免与收藏列表、搜索结果、歌单共享引用
- **播放队列去重**：`setQueue`、`addToQueue`、`insertNext` 均按 `bvid` 去重
- **歌单去重**：`addToPlaylist` 内部检查 `bvid` 是否已存在

### 音频播放与错误恢复

前端 audio 元素的事件处理与状态同步：

| 事件 | 处理逻辑 |
|------|----------|
| `@play` | 同步 `isPlaying = true` |
| `@pause` | 同步 `isPlaying = false`；清除 waiting 超时计时器 |
| `@playing` | 清除 waiting 超时；重置重试计数 |
| `@ended` | 调用 `playNext()` 自动切下一首 |
| `@error` | 自动重试（最多 2 次），超过则提示用户 |
| `@waiting` | 启动 15s 超时计时器，超时后重试 |
| `@timeupdate` | 更新 `currentTime` |
| `@loadedmetadata` | 更新 `duration` |

**竞态条件处理**：
- `audioStreamUrl` watch 和 `isPlaying` watch 都会调用 `audio.play()`，通过捕获 `AbortError` 避免冲突
- 切歌时 `audioStreamUrl` watch 清除 waiting 计时器，避免旧计时器在新歌上错误触发
- `audioRetryCount` 在 `onAudioPlaying`（播放成功）时重置，而非切歌时重置（避免重试时计数被清零导致无限重试）

### 页面布局

```
┌─────────────────────────────────────────┐
│  ◈ BiliMusic             [🔍 搜索...]     │  ← 顶部导航栏（深色）
├──────────┬──────────────────────────────┤
│          │                              │
│  ◉ 搜索  │       主内容区域              │
│  ◌ 播放器│  （搜索结果/收藏/歌单列表）     │
│  ◌ 收藏  │                              │
│  ◌ 歌单  │                              │
│          │                              │
├──────────┴──────────────────────────────┤
│  [封面] 歌曲名 - UP主  [▶] ━━━━ 3:21   │  ← 底部播放栏（固定，无歌曲时收起）
└─────────────────────────────────────────┘
```

- 左侧边栏：导航菜单，当前页高亮（青色）
- 主内容区：根据路由显示对应内容
- 底部播放栏：全局可见，无歌曲时 height:0 收起（不占空间）

## 5. UI 视觉设计

### 设计风格

**NEON SOUNDFLOW** - 复古未来主义音频实验室美学

### 配色方案（暗色 + 青色霓虹）

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主背景 | `#06070B` | 深黑（$color-void） |
| 次背景/卡片 | `#0F1218` | 稍亮的深色（$color-surface-1） |
| 边框 | `#1E2433` | 灰色边框（$color-border） |
| 主强调色 | `#22D3EE` | 青色霓虹（$color-cyan-bright） |
| 深青色 | `#06B6D4` | hover/渐变（$color-cyan-deep） |
| 次强调色 | `#EC4899` | 品红（收藏、随机播放） |
| 主文字 | `#E6EDF3` | 浅灰白（$color-text） |
| 次文字 | `#7D8590` | 灰色（$color-text-mute） |
| 错误色 | `#F85149` | 红色（$color-error） |

### 字体

使用 @fontsource 本地字体（避免 Google Fonts CDN 被墙）：
- **Display 字体**：Orbitron（标题、按钮）
- **Mono 字体**：JetBrains Mono（数据、计数、状态）
- **正文字体**：Rajdhani

### 视觉风格

- 玻璃拟态（glassmorphism）：`backdrop-filter: blur(10px)` + 半透明背景
- 青色霓虹发光效果：`text-glow` 和 `box-shadow` glow
- 过渡动画 `0.2-0.4s` ease
- 卡片式布局，圆角 `8px`
- 声波可视化动画（底部播放栏 32 根柱状条）
- 页面切换过渡动画
- 响应式设计，适配桌面和移动端（< 900px 隐藏侧边栏文字）

### 弹窗定位策略

由于 `overflow: hidden` 和 `backdrop-filter` 会裁剪子元素的绝对定位弹窗，所有弹窗菜单采用 **`position: fixed` + JS 计算坐标** 方案：
- 底部播放栏的"添加到歌单"菜单：`fixed` + `transform: translateY(-100%)` 紧贴按钮上方
- QueuePanel 的"添加到歌单"菜单：`fixed` + `rect.right - 220` 右对齐
- QueuePanel 使用 `v-if` 组件级卸载，避免状态残留

## 6. 错误处理

### 前端

- API 请求失败时显示 toast 通知（`useToast` composable）
- 搜索结果为空时显示空状态提示
- 音频加载失败时自动重试（最多 2 次）
- 音频缓冲超时（15s 无数据）自动重试
- 超过重试限制后提示用户切换歌曲
- 播放器调试日志系统（`window.__exportPlayerLogs()`）

### 后端

- Bilibili API 请求失败返回统一错误格式
- WBI 密钥/Cookie 带 TTL 缓存（Cookie 30 分钟、WBI 密钥 1 小时），遇 `code=-101`（未登录）/ `code=-352`（风控）自动清除缓存重新获取
- 音频流下载超时设置 30 秒
- 音频数据完整性校验（对比 Content-Length，不完整则标记 `complete=false`）
- 磁盘缓存 LRU 策略（最多 200 个文件，超出删最旧）
- 后台补全锁（`bgFetchLocks`）防止同一首歌并发下载
- 详细日志系统：每个请求带 `reqId`，记录 MISS/HIT/STREAM/CHUNK-DOWNLOAD/INTERRUPT/RESUME/STORED/CLIENT-DISCONNECT 等关键事件，并包含 `title` 和 `file`（MD5 hash）便于辨识

## 7. 测试策略

| 测试类型 | 工具 | 测试内容 |
|----------|------|----------|
| 前端单元测试 | Vitest | 组件渲染、Store 逻辑、localStorage 持久化 |
| 后端单元测试 | Jest | API 路由、Bilibili 服务解析逻辑 |

关键测试点：
- 搜索结果解析正确性
- 音频 URL 获取流程
- 收藏/歌单的 localStorage 持久化
- 播放器状态切换
- 播放队列去重逻辑
- 音频流代理的 Range 请求处理

## 8. 已知限制

- B站 CDN 数据量限制：通过磁盘缓存 + 流式中转 + 断点续传方案规避，首次播放若遇中断会自动续传补齐；部分缓存（HIT-PARTIAL）会触发后台异步补全
- 缓存不自动过期：`.dat`/`.meta` 文件无 TTL，仅通过 LRU（200 个）淘汰；如需清理需手动删除 `server/cache/audio/` 目录
- Seek 场景开销：seek 到未缓存位置时需完整下载到磁盘后再切片返回，首次 seek 会有延迟
- 无用户登录：收藏和歌单仅存储在本地 localStorage
- 无歌词显示
- 无音频下载
