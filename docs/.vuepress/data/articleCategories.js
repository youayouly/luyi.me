/**
 * 文章页右侧「分类」列表（按数量从多到少排列，方便读者快速找到核心内容）。
 * count 对应你的实际文章/笔记数量，每次写完新文章后手动更新这里即可。
 * `to` 统一指向文章列表，后续可改为按分类筛选的独立路由。
 */
const _RAW = [
  { label: 'Python',          count: 27 },
  { label: '嵌入式 / MCU',    count: 22 },
  { label: 'C++',              count: 19 },
  { label: '总线 / SPI·I2C',  count: 18 },
  { label: '网络 / TCP·UDP',  count: 16 },
  { label: 'C / 嵌入式 C',    count: 14 },
  { label: 'MQTT / IoT',      count: 13 },
  { label: 'RTOS',             count: 11 },
  { label: '网关 / API Gateway', count: 9 },
  { label: 'Linux 驱动',      count: 8  },
  { label: 'Edge AI / ONNX',  count: 7  },
  { label: 'NLP',              count: 6  },
  { label: 'CMake / 构建',    count: 5  },
  { label: '多模态 / Vision', count: 4  },
]

export const ARTICLE_CATEGORIES = _RAW
  .sort((a, b) => b.count - a.count)  // 降序
  .map((item) => ({ ...item, to: '/article/' }))
