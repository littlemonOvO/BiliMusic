// 解析 Range 请求头
// 返回 { start, end } —— end 为 null 表示未指定右端，由调用方按 fileSize 补全
// 格式非法或未提供时返回 null
export function parseRange(rangeHeader) {
  if (!rangeHeader) return null
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
  if (!match) return null
  return {
    start: parseInt(match[1]),
    end: match[2] ? parseInt(match[2]) : null,
  }
}
