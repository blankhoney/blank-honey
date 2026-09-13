/** Product configuration. Private destinations are supplied by environment variables. */
export const config = {
  name: 'YOUR NAME',
  description: '记录一些值得停留的瞬间。代码、远行，以及日常的缝隙。',
  about: '写代码，也写一些没有用途的句子。记录远行，和日常的缝隙。',
  githubUrl: '',
  demoContent: false,
  sayings: ['Tempus fugit', 'Labor omnia vincit', 'Ars longa, vita brevis', 'Per aspera ad astra'],
  navigation: [
    { href: '/articles/', label: '文章', en: 'ARTICLES' },
    { href: '/probe/', label: '探针', en: 'PROBE' },
    { href: '/map/', label: '地图', en: 'MAP' },
    { href: '/graph/', label: '图谱', en: 'GRAPH' },
    { href: '/tools/', label: '工具', en: 'TOOLS' },
    { href: '/lab/', label: '实验室', en: 'LAB' },
  ],
  categories: [
    { slug: 'daily', name: '日常' },
    { slug: 'engineering', name: '工程' },
    { slug: 'papers', name: '论文笔记' },
    { slug: 'tutorials', name: '教程' },
    { slug: 'travel', name: '旅行' },
    { slug: 'design', name: '设计' },
    { slug: 'thoughts', name: '感悟' },
  ],
  hero: [
    { id: 'io724', name: '流体墨迹', source: 'https://io724.com' },
    { id: 'miniload', name: '像素云', source: 'https://miniload.top' },
    { id: 'isaca', name: '错层索引', source: 'https://isaca.pro' },
    { id: 'yantao', name: '代码札记', source: 'https://yantao.wiki' },
    // ios25span.com is unavailable; add its verified effect here when the reference returns.
  ],
  particles: { desktop: 1100, mobile: 420, light: 240 },
  map: {
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    attributionUrl: 'https://www.openstreetmap.org/copyright',
    maxZoom: 19,
  },
  radio: [
    {
      id: 'piano-01',
      name: '静心钢琴 · Meditation Impromptu 01',
      source: 'direct' as 'direct' | 'rss',
      urlEnv: 'RADIO_PIANO_01_URL',
      url: '',
    },
    {
      id: 'piano-02',
      name: '缓缓流动 · Meditation Impromptu 02',
      source: 'direct' as 'direct' | 'rss',
      urlEnv: 'RADIO_PIANO_02_URL',
      url: '',
    },
    {
      id: 'dream',
      name: '轻柔节拍 · Dream Culture',
      source: 'direct' as 'direct' | 'rss',
      urlEnv: 'RADIO_DREAM_URL',
      url: '',
    },
  ],
  // Add one record and rebuild; local HTML stays on the separate lab origin.
  tools: [
    {
      slug: 'json',
      name: 'JSON WORKBENCH',
      description: '展开、压缩、检查一小段 JSON。内容留在浏览器。',
      urlEnv: 'TOOL_JSON_URL',
      html: 'examples/json.html',
    },
    {
      slug: 'timer',
      name: 'FOCUS TIMER',
      description: '给一段不被打断的时间。开始、暂停，然后重新来过。',
      urlEnv: 'TOOL_TIMER_URL',
      html: 'examples/timer.html',
    },
    {
      slug: 'text',
      name: 'WORD COUNTER',
      description: '数一数汉字、英文单词和字符。不存储输入。',
      urlEnv: 'TOOL_TEXT_URL',
      html: 'examples/text.html',
    },
  ],
  experiments: [
    {
      slug: 'paper',
      name: 'PAPER STUDY',
      description: '一张纸，一道折痕。观察光线经过纸背的过程。',
      urlEnv: 'LAB_PAPER_URL',
      html: 'examples/paper.html',
    },
  ],
} as const;
