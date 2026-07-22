// 为"单个数组字段"的 Pinia store 生成持久化配置。
// 以裸数组格式存储（而非 { field: [...] }），保持与该项目旧版手写
// localStorage 数据格式一致，升级后用户已存的收藏/歌单不丢失。
// 解析失败时回退为空数组，行为与旧版 try/catch 一致。
export function arrayPersist(key, field) {
  return {
    key,
    serializer: {
      serialize: (state) => JSON.stringify(state[field] ?? []),
      deserialize: (raw) => {
        try {
          const parsed = raw ? JSON.parse(raw) : []
          return { [field]: Array.isArray(parsed) ? parsed : [] }
        } catch {
          return { [field]: [] }
        }
      },
    },
  }
}
