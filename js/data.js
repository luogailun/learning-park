/* =======================================================
   学习乐园 · 配置数据（纯打卡版）
   ======================================================= */

/* ---------- 体能子项 ---------- */
const SPORT_ITEMS = [
  {
    id: 'rope',
    name: '跳绳',
    emoji: '🪢',
    unit: '个',
    goal: 200,
    tip: '小贴士：手腕摇绳、前脚掌落地，连续跳更省力气！',
    color: 'pink'
  },
  {
    id: 'basketball',
    name: '篮球',
    emoji: '🏀',
    unit: '次',
    goal: 100,
    tip: '小贴士：拍球、运球或投篮都可以，合计次数就达标啦！',
    color: 'blue'
  }
];

/* ---------- 每个模块的今日小建议（随机轮播） ---------- */
const MODULE_TIPS = {
  word: [
    '今天记 10 个英语单词，读 3 遍再默写 ✏️',
    '把昨天的单词再复习一遍，记得更牢哦～',
    '大声读单词，嘴巴和耳朵一起记！'
  ],
  poem: [
    '今天背一首古诗，先读 3 遍再合上书 📖',
    '试着把古诗背给爸爸妈妈听吧！',
    '边读边想象诗里的画面，很快就记住啦～'
  ],
  think: [
    '今天做 3 道思维题，先自己想 5 分钟 🧠',
    '做完想一想：还有别的解法吗？',
    '把解题思路讲给别人听，会变得更聪明！'
  ],
  zi: [
    '今天听写 12 个词语，写完自己检查一遍 ✍️',
    '错的字多写两遍，明天就不会忘啦～',
    '注意形近字，看清偏旁再下笔！'
  ],
  read: [
    '今天读课外书 20-30 分钟 📚',
    '读完想一想：最喜欢哪一段？',
    '遇到好词好句，抄在小本子上吧～'
  ],
  sport: [
    '先跳绳再打篮球，注意先热身哦 🏀',
    '运动完记得拉伸，明天肌肉不酸痛！',
    '叫上小伙伴一起运动，更开心～'
  ]
};

/* ---------- 荣誉等级（按连续打卡天数升级） ---------- */
const HONOR_LEVELS = [
  { d: 0,   emoji: '🥚', name: '启程新星', desc: '刚刚出发，一切皆有可能！' },
  { d: 3,   emoji: '🌱', name: '坚持小芽', desc: '连续 3 天，好习惯正在发芽～' },
  { d: 7,   emoji: '🌸', name: '勤学小花', desc: '连续 7 天，一整周没间断！' },
  { d: 14,  emoji: '🎈', name: '闯关达人', desc: '连续 14 天，节奏稳稳的！' },
  { d: 21,  emoji: '⭐', name: '闪耀之星', desc: '连续 21 天，习惯已经养成！' },
  { d: 30,  emoji: '🔥', name: '坚持之火', desc: '连续 30 天，满月成就达成！' },
  { d: 50,  emoji: '🏅', name: '荣耀骑士', desc: '连续 50 天，真的很了不起！' },
  { d: 75,  emoji: '👑', name: '钻石王者', desc: '连续 75 天，王者风范！' },
  { d: 100, emoji: '🏆', name: '传奇大师', desc: '连续 100 天，传奇诞生！' },
  { d: 180, emoji: '🌈', name: '学习之光', desc: '连续 180 天，你就是光！' }
];

/* ---------- 徽章成就 ---------- */
const BADGES = [
  { id: 'first',    emoji: '🎬', name: '第一步',   desc: '完成第一次打卡',        test: s => s.totalChecks >= 1 },
  { id: 'check20',  emoji: '📌', name: '小有积累', desc: '累计打卡 20 次',        test: s => s.totalChecks >= 20 },
  { id: 'check60',  emoji: '📎', name: '渐入佳境', desc: '累计打卡 60 次',        test: s => s.totalChecks >= 60 },
  { id: 'check150', emoji: '🗂️', name: '打卡达人', desc: '累计打卡 150 次',       test: s => s.totalChecks >= 150 },
  { id: 'check300', emoji: '🗃️', name: '打卡狂人', desc: '累计打卡 300 次',       test: s => s.totalChecks >= 300 },
  { id: 'star10',   emoji: '✨', name: '十星少年', desc: '累计获得 10 颗星',      test: s => s.stars >= 10 },
  { id: 'star50',   emoji: '🌟', name: '星光闪闪', desc: '累计获得 50 颗星',      test: s => s.stars >= 50 },
  { id: 'star150',  emoji: '💫', name: '星河灿烂', desc: '累计获得 150 颗星',     test: s => s.stars >= 150 },
  { id: 'star500',  emoji: '🌠', name: '星辰大海', desc: '累计获得 500 颗星',     test: s => s.stars >= 500 },
  { id: 'perfect1', emoji: '🎯', name: '初次满勤', desc: '完成 1 次六项全勤',     test: s => s.perfectDays >= 1 },
  { id: 'perfect7', emoji: '🎪', name: '满勤一周', desc: '完成 7 次六项全勤',     test: s => s.perfectDays >= 7 },
  { id: 'perfect30',emoji: '🎖️', name: '满勤达人', desc: '完成 30 次六项全勤',    test: s => s.perfectDays >= 30 },
  { id: 'streak7',  emoji: '🔥', name: '七日之约', desc: '连续打卡 7 天',         test: s => s.bestStreak >= 7 },
  { id: 'streak30', emoji: '🚀', name: '月度坚持', desc: '连续打卡 30 天',        test: s => s.bestStreak >= 30 },
  { id: 'streak100',emoji: '🌠', name: '百日传奇', desc: '连续打卡 100 天',       test: s => s.bestStreak >= 100 },
  { id: 'read30',   emoji: '📚', name: '阅读小达人', desc: '阅读累计打卡 30 次',  test: s => (s.mods.read.total || 0) >= 30 },
  { id: 'sport30',  emoji: '💪', name: '运动健将', desc: '体能累计打卡 30 次',    test: s => (s.mods.sport.total || 0) >= 30 },
  { id: 'word50',   emoji: '🔤', name: '单词王者', desc: '单词累计打卡 50 次',    test: s => (s.mods.word.total || 0) >= 50 },
  { id: 'poem50',   emoji: '🌸', name: '诗词少年', desc: '古诗累计打卡 50 次',    test: s => (s.mods.poem.total || 0) >= 50 }
];

/* ---------- 打卡夸夸语 ---------- */
const PRAISES = [
  '太棒啦，继续保持！',
  '你真是个小天才！',
  '又前进了一大步！',
  '为你鼓掌，啪啪啪！',
  '坚持的你最闪亮！',
  '今天的你超厉害！',
  '闯关成功，继续加油！',
  '哇，进步看得见！'
];
