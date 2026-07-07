# BiliMusic 设计文档

> 创建日期：2026-07-07
> 状态：已确认

## 1. 项目概述

BiliMusic 是一个基于 Web 的音乐应用，允许用户搜索、播放 Bilibili 平台上的音乐内容，并支持收藏和歌单管理。应用采用前后端分离架构，免登录，收藏和歌单数据存储在本地。

### 核心功能

- **搜索**：搜索 Bilibili 上的音乐/视频内容
- **在线播放**：播放音频流，支持播放控制（播放/暂停、进度、音量）
- **收藏与歌单**：收藏喜欢的音乐，创建和管理自定义歌单

### 非目标（YAGNI）

- 不支持用户登录/Bilibili 账号关联
- 不支持歌词显示
- 不支持评论区
- 不支持深色/浅色模式切换（仅暗色主题）
- 不支持音频下载

## 2. 技术架构

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Vue 3（Composition API） |
| 构建工具 | Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| 样式 | 手写 SCSS |
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
│   │   │   ├── PlayerBar.vue
│   │   │   ├── PlaylistModal.vue
│   │   │   └── AddToPlaylistModal.vue
│   │   ├── views/             # 页面视图
│   │   │   ├── SearchView.vue
│   │   │   ├── PlayerView.vue
│   │   │   ├── FavoritesView.vue
│   │   │   └── PlaylistsView.vue
│   │   ├── stores/            # Pinia 状态管理
│   │   │   ├── player.js
│   │   │   ├── favorites.js
│   │   │   └── playlists.js
│   │   ├── router/            # 路由配置
│   │   │   └── index.js
│   │   ├── styles/            # 全局样式
│   │   │   ├── variables.scss # SCSS 变量
│   │   │   ├── global.scss    # 全局样式
│   │   │   └── mixins.scss    # SCSS mixins
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                    # 后端 Express 服务
│   ├── routes/
│   │   ├── search.js          # /api/search 路由
│   │   └── audio.js           # /api/audio-url 和 /api/audio-stream 路由
│   ├── services/
│   │   └── bilibili.js        # Bilibili API 封装
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
| `/api/audio-url` | GET | `bvid` | 获取音频流地址，后端内部完成 bvid→cid→playurl 的完整流程 |
| `/api/audio-stream` | GET | `url` | 音频流代理：转发音频请求，附加 Referer 头，返回音频流给前端 |

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
| `/favorites` | FavoritesView | 收藏列表 |
| `/playlists` | PlaylistsView | 歌单列表及详情 |

### 核心组件

- **SearchBar.vue**：搜索输入框，支持回车搜索，输入时显示搜索建议
- **MusicList.vue**：音乐列表组件，可复用于搜索结果、收藏、歌单页面
- **MusicItem.vue**：单条音乐条目，显示封面、标题、UP主、时长，支持点击播放和右键菜单（收藏、添加到歌单）
- **PlayerBar.vue**：底部固定播放控制栏，显示当前歌曲信息、播放/暂停按钮、进度条、音量控制
- **PlaylistModal.vue**：创建/编辑歌单的弹窗
- **AddToPlaylistModal.vue**：选择添加到哪个歌单的弹窗

### 状态管理（Pinia Stores）

**player.js**：
- `currentSong`：当前播放的歌曲对象
- `isPlaying`：播放状态
- `currentTime`：当前播放进度
- `duration`：总时长
- `volume`：音量（0-1）
- `playQueue`：播放队列

**favorites.js**：
- `items`：收藏的歌曲列表
- `isFavorite(bvid)`：判断是否已收藏
- `toggle(song)`：添加/移除收藏
- 自动同步到 localStorage

**playlists.js**：
- `playlists`：歌单列表（每个歌单含 id、name、songs）
- `createPlaylist(name)`：创建歌单
- `addToPlaylist(playlistId, song)`：添加歌曲到歌单
- `removeFromPlaylist(playlistId, bvid)`：从歌单移除歌曲
- 自动同步到 localStorage

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
│  [封面] 歌曲名 - UP主  [▶] ━━━━ 3:21   │  ← 底部播放栏（固定）
└─────────────────────────────────────────┘
```

- 左侧边栏：导航菜单，当前页高亮（青色）
- 主内容区：根据路由显示对应内容
- 底部播放栏：全局可见，显示当前播放状态

## 5. UI 视觉设计

### 配色方案（暗色 + 青色）

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主背景 | `#0D1117` | 深黑蓝 |
| 次背景/卡片 | `#161B22` | 稍亮的深色 |
| 边框 | `#30363D` | 灰色边框 |
| 主强调色 | `#22D3EE` | 青色（按钮、高亮、进度条、激活态） |
| 次强调色 | `#06B6D4` | 深青色（hover 状态） |
| 主文字 | `#E6EDF3` | 浅灰白 |
| 次文字 | `#7D8590` | 灰色 |
| 错误色 | `#F85149` | 红色 |

### 字体

系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif`

### 视觉风格

- 卡片式布局，圆角 `8px`
- 悬浮阴影效果，hover 时背景微亮
- 过渡动画 `0.2-0.3s` ease
- 青色用于：当前播放项、激活导航项、主按钮、进度条
- 响应式设计，适配桌面和移动端

## 6. 错误处理

### 前端

- API 请求失败时显示 toast 通知
- 搜索结果为空时显示空状态提示
- 音频加载失败时提供重试按钮
- 网络断开时显示全局提示

### 后端

- Bilibili API 请求失败返回统一错误格式
- 请求超时设置 10 秒
- 简单速率限制（每分钟最多 60 次请求）

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
