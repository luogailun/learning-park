/* =======================================================
   学习乐园 · 主逻辑（纯打卡 + 荣誉体系）
   数据持久化：localStorage（key = learning-park-v2）
   ======================================================= */

const STORE_KEY = 'learning-park-v2';
const STAR_PER_TASK = 1;     // 每个模块打卡得 1 星
const STAR_ALL_BONUS = 6;    // 六项全勤额外奖励 6 星

const MODULES = [
  { id: 'word',  name: '单词乐园', short: '单词', emoji: '🔤', color: 'blue',   desc: '每天记一记英语单词' },
  { id: 'poem',  name: '古诗花园', short: '古诗', emoji: '🌸', color: 'pink',   desc: '每天背一首古诗词' },
  { id: 'think', name: '思维王国', short: '思维', emoji: '🧠', color: 'purple', desc: '每天练一练思维题' },
  { id: 'zi',    name: '生字挑战', short: '生字', emoji: '✍️', color: 'yellow', desc: '每天听写一组词语' },
  { id: 'read',  name: '阅读时光', short: '阅读', emoji: '📖', color: 'orange', desc: '每天读 20-30 分钟课外书' },
  { id: 'sport', name: '体能闯关', short: '体能', emoji: '🏀', color: 'green',  desc: '跳绳 + 篮球，身体棒棒' }
];
const NAV_EXTRA = [
  { id: 'honor', name: '荣誉殿堂', short: '荣誉', emoji: '🏅', color: 'purple' },
  { id: 'account', name: '我的账号', short: '账号', emoji: '👤', color: 'blue' }
];
const TOTAL_TASKS = MODULES.length;

/* ---------------- 日期工具 ---------------- */
function ds(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return ds(new Date()); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return ds(d); }
function cnDate(s) { const p = s.split('-'); return `${p[1]}月${p[2]}日`; }

/* ---------------- 数据存储 ---------------- */
let state = null;

function emptyMod() { return { streak: 0, last: '', total: 0 }; }
function defaultState() {
  return {
    stars: 0,
    streak: 0,
    bestStreak: 0,
    lastDate: '',
    perfectDays: 0,
    totalChecks: 0,
    honorLevel: 0,
    lastBackup: '',
    updatedAt: 0,
    user: { uid: '', email: '', nick: '', lastSync: 0 },
    sportGoal: { rope: SPORT_ITEMS[0].goal, basketball: SPORT_ITEMS[1].goal },
    today: {
      date: todayStr(),
      word: false, poem: false, think: false, zi: false, read: false, sport: false,
      sportData: { rope: 0, basketball: 0, ropeDone: false, bbDone: false }
    },
    mods: { word: emptyMod(), poem: emptyMod(), think: emptyMod(), zi: emptyMod(), read: emptyMod(), sport: emptyMod() },
    history: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
  } catch (e) { state = defaultState(); }

  // 补齐模块字段
  MODULES.forEach(m => {
    if (!state.mods[m.id]) state.mods[m.id] = emptyMod();
    state.mods[m.id] = Object.assign(emptyMod(), state.mods[m.id]);
  });
  state.today = Object.assign(defaultState().today, state.today || {});
  state.today.sportData = Object.assign(defaultState().today.sportData, state.today.sportData || {});
  state.sportGoal = Object.assign(defaultState().sportGoal, state.sportGoal || {});

  rollover();
  checkBreak();
  saveLocal();   // 仅落盘，不更新 updatedAt：避免"空设备"被误判为最新数据而覆盖云端
}

/* 只写本地（不触发云同步，供同步流程内部使用） */
function saveLocal() {
  syncToday();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

function save() {
  state.updatedAt = Date.now();
  saveLocal();
  scheduleSync();
}

/* 跨天：重置今日任务（历史已由 syncToday 写入） */
function rollover() {
  const t = todayStr();
  if (state.today.date !== t) {
    state.today = defaultState().today;
    state.today.date = t;
  }
}

/* 断签检测：上次打卡不是今天也不是昨天 → 连续天数归零 */
function checkBreak() {
  const t = todayStr();
  if (state.lastDate && state.lastDate !== t && state.lastDate !== yesterdayStr()) {
    state.streak = 0;
  }
  MODULES.forEach(m => {
    const md = state.mods[m.id];
    if (md.last && md.last !== t && md.last !== yesterdayStr()) md.streak = 0;
  });
}

/* 同步今天的完成记录到 history（供日历用） */
function syncToday() {
  const t = todayStr();
  const items = MODULES.filter(m => isDone(m.id)).map(m => m.id);
  state.history = state.history.filter(h => h.date !== t);
  if (items.length) state.history.unshift({ date: t, count: items.length, items });
  if (state.history.length > 200) state.history.length = 200;
}

/* ---------------- 状态判断 ---------------- */
function isDone(id) { return id === 'sport' ? !!state.today.sport : !!state.today[id]; }
function todayCount() { return MODULES.filter(m => isDone(m.id)).length; }
function isPerfect() { return todayCount() === TOTAL_TASKS; }

/* ---------------- 荣誉计算 ---------------- */
function honorIndex(streak) {
  let idx = 0;
  for (let i = 0; i < HONOR_LEVELS.length; i++) if (streak >= HONOR_LEVELS[i].d) idx = i;
  return idx;
}
function honorOf(streak) { return HONOR_LEVELS[honorIndex(streak)]; }
function nextHonor(streak) {
  const i = honorIndex(streak);
  return i >= HONOR_LEVELS.length - 1 ? null : HONOR_LEVELS[i + 1];
}
function earnedBadges() { return BADGES.filter(b => { try { return b.test(state); } catch (e) { return false; } }); }

/* =======================================================
   渲染：导航
   ======================================================= */
let current = 'home';

function buildNav() {
  const items = [{ id: 'home', name: '今日乐园', short: '首页', emoji: '🏠', color: 'pink' }]
    .concat(MODULES)
    .concat(NAV_EXTRA);

  document.getElementById('sideNav').innerHTML = items.map(m => `
    <button class="nav-item c-${m.color} ${current === m.id ? 'active' : ''}" data-go="${m.id}">
      <span class="n-ico">${m.emoji}</span>
      <span>${m.name}</span>
      ${m.id !== 'home' && m.id !== 'honor' && isDone(m.id) ? '<span class="nav-dot"></span>' : ''}
    </button>`).join('');

  // 移动端底部 Tab：首页 + 6 个模块（荣誉从首页进入）
  const tabs = [{ id: 'home', short: '首页', emoji: '🏠', color: 'pink' }].concat(MODULES);
  document.getElementById('tabbar').innerHTML = '<div class="tabbar-inner">' + tabs.map(m => `
    <button class="tab-item c-${m.color} ${current === m.id ? 'active' : ''}" data-go="${m.id}">
      ${m.id !== 'home' && isDone(m.id) ? '<span class="tab-dot"></span>' : ''}
      <span class="tb-ico">${m.emoji}</span>
      <span>${m.short}</span>
    </button>`).join('') + '</div>';
}

function refreshTop() {
  document.getElementById('topStar').textContent = state.stars;
  document.getElementById('sideStar').textContent = state.stars;
  document.getElementById('topStreak').textContent = state.streak;
  document.getElementById('topHonor').textContent = honorOf(state.streak).name;
  document.getElementById('sideHonorEmoji').textContent = honorOf(state.streak).emoji;
  document.getElementById('sideHonorName').textContent = honorOf(state.streak).name;
}

function render() {
  buildNav();
  refreshTop();
  const c = document.getElementById('content');
  const map = { home: renderHome, honor: renderHonor, account: renderAccount };
  MODULES.forEach(m => { map[m.id] = () => renderModule(m.id); });
  c.innerHTML = map[current]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function go(id) {
  current = id;
  const m = MODULES.find(x => x.id === id);
  const t = document.getElementById('pageTitle');
  const s = document.getElementById('pageSub');
  if (id === 'home') { t.textContent = '今日乐园'; s.textContent = `今天是 ${cnDate(todayStr())}，一起来打卡吧！`; }
  else if (id === 'honor') { t.textContent = '荣誉殿堂'; s.textContent = '坚持得越久，荣誉越高！'; }
  else if (id === 'account') { t.textContent = '我的账号'; s.textContent = '登录后数据自动备份到云端，换手机也不丢'; }
  else { t.textContent = m.name; s.textContent = isDone(id) ? '今天已经打卡啦，超棒！' : '完成后点下面的按钮打卡 ⭐'; }
  render();
}

/* ---------- 荣誉卡（首页顶部） ---------- */
function honorCard() {
  const h = honorOf(state.streak);
  const nx = nextHonor(state.streak);
  const cur = HONOR_LEVELS[honorIndex(state.streak)];
  let pct = 100, txt = '已到达最高荣誉，你太厉害啦！';
  if (nx) {
    pct = Math.min(100, Math.round((state.streak - cur.d) / (nx.d - cur.d) * 100));
    txt = `再坚持 ${nx.d - state.streak} 天，升级为「${nx.name}」${nx.emoji}`;
  }
  const badges = earnedBadges();
  return `
    <div class="honor-card">
      <div class="hc-badge">${h.emoji}</div>
      <div class="hc-main">
        <div class="hc-top">
          <span class="hc-name">${h.name}</span>
          <span class="hc-streak">🔥 连续 ${state.streak} 天</span>
        </div>
        <div class="hc-desc">${h.desc}</div>
        <div class="hc-track"><i style="width:${pct}%"></i></div>
        <div class="hc-next">${txt}</div>
      </div>
    </div>
    <div class="honor-mini">
      <button class="hm-item" data-go="honor">
        <span class="hm-v">${badges.length}/${BADGES.length}</span>
        <span class="hm-l">🏅 我的徽章</span>
      </button>
      <button class="hm-item" data-go="honor">
        <span class="hm-v">${state.bestStreak}</span>
        <span class="hm-l">🚀 最长连续</span>
      </button>
      <button class="hm-item" data-go="honor">
        <span class="hm-v">${state.totalChecks}</span>
        <span class="hm-l">✅ 累计打卡</span>
      </button>
    </div>`;
}

/* 首页顶部账号条（仅在云同步已开启时显示） */
function accountStrip() {
  if (typeof Cloud === 'undefined' || !Cloud.configured()) return '';
  if (state.user && state.user.uid) {
    return `<button class="acc-strip ok" data-go="account">☁️ 已登录 · ${state.user.email}（数据自动备份中）</button>`;
  }
  return `<button class="acc-strip" data-go="account">☁️ 登录后，星星和连续天数永不丢失 · 点此登录</button>`;
}

/* ---------- 首页 ---------- */
function renderHome() {
  const done = todayCount();
  const R = 48, C = 2 * Math.PI * R;
  const offset = C * (1 - done / TOTAL_TASKS);

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  })();

  const cards = MODULES.map(m => {
    const md = state.mods[m.id];
    return `
    <button class="task-card c-${m.color} ${isDone(m.id) ? 'done' : ''}" data-go="${m.id}">
      <div class="t-emoji">${m.emoji}</div>
      <h4>${m.name}</h4>
      <div class="t-desc">${m.desc}</div>
      <div class="t-meta">🔥 连续 ${md.streak} 天 · 累计 ${md.total} 次</div>
      <span class="t-state ${isDone(m.id) ? 'state-done' : 'state-undone'}">
        ${isDone(m.id) ? '✓ 今日已打卡' : '去打卡 →'}
      </span>
    </button>`;
  }).join('');

  return `
    <div class="hero">
      <h2>${greet}，小勇士！🦁</h2>
      <p>每天完成 6 项打卡，坚持得越久荣誉越高 —— 今天也要加油鸭～</p>
    </div>

    ${accountStrip()}
    ${honorCard()}

    <div class="card">
      <div class="today-ring-box">
        <div class="ring">
          <svg width="118" height="118">
            <circle cx="59" cy="59" r="${R}" fill="none" stroke="#EDE6F8" stroke-width="14"/>
            <circle cx="59" cy="59" r="${R}" fill="none" stroke="url(#g1)" stroke-width="14"
              stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset .8s"/>
            <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FF8FB1"/><stop offset="50%" stop-color="#B085F5"/><stop offset="100%" stop-color="#4FC3F7"/>
            </linearGradient></defs>
          </svg>
          <div class="ring-txt">
            <div class="ring-num">${done}/${TOTAL_TASKS}</div>
            <div class="ring-lbl">今日打卡</div>
          </div>
        </div>
        <div class="today-info">
          <h3>${done === TOTAL_TASKS ? '🎉 六项全勤，太厉害了！' : `还差 ${TOTAL_TASKS - done} 项就满勤啦`}</h3>
          <p>${done === TOTAL_TASKS
            ? `今天一共拿到 ${TOTAL_TASKS + STAR_ALL_BONUS} 颗星星，明天继续保持！`
            : `每项打卡得 ${STAR_PER_TASK} 颗星，六项全勤再奖励 ${STAR_ALL_BONUS} 颗 ⭐`}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--purple-l)">🎯</span>今日六大关卡</h3>
      <div class="task-grid">${cards}</div>
    </div>

    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--yellow-l)">📅</span>最近 7 天</h3>
      <p class="sec-hint">数字 = 当天完成几项打卡（最多 6 项）</p>
      ${weekStrip()}
    </div>
  `;
}

function weekStrip() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = ds(d);
    const h = state.history.find(x => x.date === key);
    const isToday = key === todayStr();
    days.push({ key, count: isToday ? todayCount() : (h ? h.count : 0), isToday });
  }
  return `<div style="display:flex;gap:8px;justify-content:space-between">` + days.map(d => {
    const bg = d.count === 0 ? '#EDE6F8' : (d.count >= TOTAL_TASKS ? '#5FD3A0' : (d.count >= 3 ? '#FFC44D' : '#FFB0C8'));
    return `<div style="text-align:center;flex:1">
      <div style="width:100%;height:40px;border-radius:12px;background:${bg};display:grid;place-items:center;
        color:${d.count === 0 ? '#A79FBB' : '#fff'};font-size:15px;font-weight:900;
        ${d.isToday ? 'box-shadow:0 0 0 3px #FFD9E6;' : ''}">${d.count}</div>
      <div style="font-size:10px;color:var(--ink-3);font-weight:700;margin-top:5px">${d.isToday ? '今天' : d.key.slice(5).replace('-', '/')}</div>
    </div>`;
  }).join('') + `</div>`;
}

/* ---------- 模块打卡页 ---------- */
function tipOf(id) {
  const arr = MODULE_TIPS[id] || ['今天也要加油哦！'];
  return arr[Math.floor(Math.random() * arr.length)];
}
let currentTip = {};

function renderModule(id) {
  const m = MODULES.find(x => x.id === id);
  const md = state.mods[id];
  if (!currentTip[id]) currentTip[id] = tipOf(id);

  let body = '';
  if (id === 'sport') body = sportBody();
  else body = `
    <div class="mod-hero c-${m.color}">
      <div class="mh-emoji">${m.emoji}</div>
      <div class="mh-tip">${currentTip[id]}</div>
    </div>`;

  return `
    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--${m.color}-l)">${m.emoji}</span>${m.name}</h3>
      <p class="sec-hint">${m.desc}</p>
      ${body}
      <div class="stat-row" style="margin:16px 0">
        <div class="stat-box"><div class="sv" style="color:#FF6F61">${md.streak}</div><div class="sl">🔥 连续天数</div></div>
        <div class="stat-box"><div class="sv" style="color:#2FA5E8">${md.total}</div><div class="sl">✅ 累计打卡</div></div>
        <div class="stat-box"><div class="sv" style="color:#E8891F">${monthCount(id)}</div><div class="sl">📅 本月次数</div></div>
      </div>
      <div class="sec-hint">最近 30 天打卡记录</div>
      ${miniCalendar(id)}
      ${checkinZone(id)}
    </div>`;
}

/* 体能专用主体 */
function sportBody() {
  const s = state.today.sportData;
  return SPORT_ITEMS.map(it => {
    const val = s[it.id] || 0;
    const goal = state.sportGoal[it.id] || it.goal;
    const pct = Math.min(100, Math.round(val / goal * 100));
    const doneFlag = it.id === 'rope' ? s.ropeDone : s.bbDone;
    return `
      <div class="sport-card s-${it.color}">
        <div class="sport-head"><span class="sp-emoji">${it.emoji}</span>${it.name}</div>
        <div class="sport-goal">今日目标：${goal} ${it.unit}（可修改）</div>
        <div class="sport-input-row">
          <input class="sport-input" type="number" inputmode="numeric" min="0" placeholder="0"
            id="input-${it.id}" value="${val || ''}">
          <button class="btn btn-ghost btn-sm" data-goal="${it.id}">🎯 改目标</button>
        </div>
        <div class="sport-progress"><i style="width:${pct}%"></i></div>
        <div class="sport-tip">${it.tip}　已完成 ${val} / ${goal} ${it.unit}</div>
        <button class="btn btn-sm ${doneFlag ? 'btn-done' : 'btn-sport'}" style="margin-top:12px"
          data-sport="${it.id}" ${doneFlag ? 'disabled' : ''}>
          ${doneFlag ? '✓ 已打卡' : '✅ 记录并打卡'}
        </button>
      </div>`;
  }).join('');
}

/* 某模块本月打卡次数 */
function monthCount(id) {
  const p = todayStr().slice(0, 7);
  return state.history.filter(h => h.date.slice(0, 7) === p && h.items && h.items.indexOf(id) >= 0).length;
}

/* 最近 30 天小日历（模块页） */
function miniCalendar(id) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = ds(d);
    const h = state.history.find(x => x.date === key);
    let hit = false;
    if (key === todayStr()) hit = isDone(id);
    else if (h && h.items) hit = h.items.indexOf(id) >= 0;
    days.push({ key, hit, isToday: key === todayStr() });
  }
  return `<div class="cal-grid">` + days.map(d => `
    <div class="cal-cell ${d.hit ? 'hit' : ''} ${d.isToday ? 'today' : ''}" title="${d.key}"></div>
  `).join('') + `</div>`;
}

/* 打卡区 */
function checkinZone(id) {
  if (isDone(id)) {
    return `
      <div class="checkin-zone">
        <div class="ci-emoji">✅</div>
        <p>今天已经打过卡啦，明天继续加油！</p>
        <div class="ci-btns">
          <button class="btn btn-ghost btn-sm" data-undo="${id}">撤销今天的打卡</button>
        </div>
      </div>`;
  }
  if (id === 'sport') {
    return `
      <div class="checkin-zone">
        <div class="ci-emoji">💪</div>
        <p>跳绳和篮球都达标后，就能拿到今天的体能星星！</p>
      </div>`;
  }
  return `
    <div class="checkin-zone">
      <div class="ci-emoji">⭐</div>
      <p>完成今天的任务后，点下面的按钮打卡，就能得到 1 颗星星！</p>
      <div class="ci-btns">
        <button class="btn btn-primary btn-lg" style="max-width:340px" data-check="${id}">🎉 完成打卡，得 1 颗星</button>
      </div>
    </div>`;
}

/* ---------- 荣誉殿堂 ---------- */
function renderHonor() {
  const h = honorOf(state.streak);
  const nx = nextHonor(state.streak);
  const cur = HONOR_LEVELS[honorIndex(state.streak)];
  let pct = 100, nextTxt = '已到达最高荣誉，你就是传说！';
  if (nx) {
    pct = Math.min(100, Math.round((state.streak - cur.d) / (nx.d - cur.d) * 100));
    nextTxt = `距离「${nx.name}」还差 ${nx.d - state.streak} 天`;
  }

  const ladder = HONOR_LEVELS.map((lv, i) => {
    const got = state.streak >= lv.d;
    const isCur = i === honorIndex(state.streak);
    return `
      <div class="lv-row ${got ? 'got' : ''} ${isCur ? 'cur' : ''}">
        <div class="lv-emoji">${lv.emoji}</div>
        <div class="lv-info">
          <div class="lv-name2">${lv.name} ${isCur ? '<span class="lv-tag">当前</span>' : ''}</div>
          <div class="lv-desc2">${lv.desc}</div>
        </div>
        <div class="lv-days">${lv.d === 0 ? '起步' : lv.d + '天'}</div>
      </div>`;
  }).join('');

  const badges = BADGES.map(b => {
    const got = (() => { try { return b.test(state); } catch (e) { return false; } })();
    return `
      <div class="badge ${got ? 'got' : ''}">
        <div class="b-emoji">${got ? b.emoji : '🔒'}</div>
        <div class="b-name">${b.name}</div>
        <div class="b-desc">${b.desc}</div>
      </div>`;
  }).join('');

  // 30 天热力日历
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = ds(d);
    const hh = state.history.find(x => x.date === key);
    const cnt = key === todayStr() ? todayCount() : (hh ? hh.count : 0);
    cells.push({ key, cnt, isToday: key === todayStr() });
  }
  const cal = cells.map(c => {
    const lvl = c.cnt === 0 ? 0 : (c.cnt >= 6 ? 4 : (c.cnt >= 4 ? 3 : (c.cnt >= 2 ? 2 : 1)));
    const cls = ['l0', 'l1', 'l2', 'l3', 'l4'][lvl];
    return `<div class="hc-cell ${cls} ${c.isToday ? 'today' : ''}" title="${c.key}：${c.cnt} 项"></div>`;
  }).join('');

  return `
    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--yellow-l)">🏅</span>我的荣誉</h3>
      <div class="honor-card big">
        <div class="hc-badge">${h.emoji}</div>
        <div class="hc-main">
          <div class="hc-top">
            <span class="hc-name">${h.name}</span>
            <span class="hc-streak">🔥 连续 ${state.streak} 天</span>
          </div>
          <div class="hc-desc">${h.desc}</div>
          <div class="hc-track"><i style="width:${pct}%"></i></div>
          <div class="hc-next">${nextTxt}</div>
        </div>
      </div>
      <div class="stat-row" style="margin-top:16px">
        <div class="stat-box"><div class="sv" style="color:#E8891F">${state.stars}</div><div class="sl">⭐ 总星星</div></div>
        <div class="stat-box"><div class="sv" style="color:#FF6F61">${state.streak}</div><div class="sl">🔥 当前连续</div></div>
        <div class="stat-box"><div class="sv" style="color:#8B4DEA">${state.bestStreak}</div><div class="sl">🚀 最长连续</div></div>
        <div class="stat-box"><div class="sv" style="color:#2FA5E8">${state.totalChecks}</div><div class="sl">✅ 累计打卡</div></div>
        <div class="stat-box"><div class="sv" style="color:#25A873">${state.perfectDays}</div><div class="sl">👑 全勤天数</div></div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--purple-l)">🪜</span>荣誉阶梯</h3>
      <p class="sec-hint">连续打卡天数越多，荣誉等级越高 —— 千万不要中断哦！</p>
      ${ladder}
    </div>

    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--blue-l)">🎖️</span>徽章墙
        <span style="margin-left:auto;font-size:14px;color:var(--ink-3)">${earnedBadges().length} / ${BADGES.length}</span>
      </h3>
      <div class="badge-wall">${badges}</div>
    </div>

    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--green-l)">📅</span>打卡日历（最近 30 天）</h3>
      <p class="sec-hint">颜色越深，当天完成的打卡项越多</p>
      <div class="hc-grid">${cal}</div>
      <div class="cal-legend">
        <span>少</span>
        <i class="hc-cell l0"></i><i class="hc-cell l1"></i><i class="hc-cell l2"></i><i class="hc-cell l3"></i><i class="hc-cell l4"></i>
        <span>多</span>
      </div>
    </div>

    ${backupCard()}
  `;
}

/* =======================================================
   数据备份 / 恢复
   ======================================================= */
const CODE_PREFIX = 'XXLY1-';
let backupCode = '';
let showBackup = false;

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* 打包需要备份的数据（历史只留最近 60 天，控制体积） */
function backupData() {
  return {
    app: 'learning-park', v: 2, time: new Date().toISOString(),
    stars: state.stars, streak: state.streak, bestStreak: state.bestStreak,
    lastDate: state.lastDate, perfectDays: state.perfectDays,
    totalChecks: state.totalChecks, honorLevel: state.honorLevel,
    sportGoal: state.sportGoal, mods: state.mods,
    today: state.today,
    history: state.history.slice(0, 60)
  };
}

function downloadBackup() {
  const json = JSON.stringify(backupData(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `学习乐园-备份-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  state.lastBackup = todayStr();
  save();
  toast('📤', '备份文件已导出', '文件已保存，建议发给自己或存到手机文件夹');
}

function makeCode() {
  backupCode = CODE_PREFIX + toB64(JSON.stringify(backupData()));
  showBackup = true;
  render();
  const ta = document.getElementById('codeArea');
  if (ta) { ta.focus(); ta.setSelectionRange(0, ta.value.length); }
  toast('🔑', '恢复码已生成', '已选中，长按可复制；也可直接粘贴恢复码覆盖这里');
}

function parseBackup(text) {
  let s = String(text || '').trim();
  if (!s) throw new Error('empty');
  if (s.indexOf(CODE_PREFIX) === 0) s = fromB64(s.slice(CODE_PREFIX.length));
  const obj = JSON.parse(s);
  if (typeof obj.stars !== 'number' || !obj.mods) throw new Error('bad');
  return obj;
}

function applyBackup(obj) {
  state.stars = obj.stars || 0;
  state.streak = obj.streak || 0;
  state.bestStreak = obj.bestStreak || 0;
  state.lastDate = obj.lastDate || '';
  state.perfectDays = obj.perfectDays || 0;
  state.totalChecks = obj.totalChecks || 0;
  state.honorLevel = obj.honorLevel || 0;
  state.sportGoal = Object.assign(state.sportGoal, obj.sportGoal || {});
  if (obj.mods) MODULES.forEach(m => {
    if (obj.mods[m.id]) state.mods[m.id] = Object.assign(emptyMod(), obj.mods[m.id]);
  });
  if (Array.isArray(obj.history)) state.history = obj.history.slice(0, 200);
  // 今日打卡：仅当备份是同一天时才恢复
  state.today = defaultState().today;
  state.today.date = todayStr();
  if (obj.today && obj.today.date === todayStr()) {
    state.today = Object.assign(state.today, obj.today);
    state.today.sportData = Object.assign(defaultState().today.sportData, obj.today.sportData || {});
  }
  save();
  render();
  toast('✅', '恢复成功！', `星星 ${state.stars} 颗 · 连续 ${state.streak} 天已找回`);
}

function restoreFromText(text) {
  let obj;
  try { obj = parseBackup(text); }
  catch (e) { toast('😵', '恢复码无法识别', '请检查是否复制完整，或改用备份文件恢复'); return; }
  if (!confirm(`确认用这份备份覆盖当前数据吗？\n\n备份时间：${(obj.time || '').slice(0, 10) || '未知'}\n星星：${obj.stars} 颗 · 连续 ${obj.streak} 天`)) return;
  applyBackup(obj);
}

function restoreFromFile(file) {
  const fr = new FileReader();
  fr.onload = function () {
    let obj;
    try { obj = parseBackup(fr.result); }
    catch (e) { toast('😵', '文件无法识别', '请选择本应用导出的备份 JSON 文件'); return; }
    if (!confirm(`确认用「${file.name}」覆盖当前数据吗？`)) return;
    applyBackup(obj);
  };
  fr.readAsText(file);
}

/* 备份卡片（荣誉页底部） */
function backupCard() {
  const last = state.lastBackup ? `上次备份：${cnDate(state.lastBackup)}` : '还没有备份过哦～';
  return `
    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--blue-l)">🛡️</span>数据备份</h3>
      <p class="sec-hint">数据只存在这台设备的浏览器里。清缓存、换手机前请先备份，星星和连续天数就不会丢啦！</p>
      <div class="ci-btns" style="justify-content:flex-start">
        <button class="btn btn-blue btn-sm" data-backup="file">📤 导出备份文件</button>
        <button class="btn btn-purple btn-sm" data-backup="code">🔑 生成恢复码</button>
        <button class="btn btn-ghost btn-sm" data-backup="toggle">📥 从备份恢复</button>
      </div>
      <div class="backup-last">${last}</div>
      ${showBackup ? `
        <div class="backup-box">
          <textarea class="code-area" id="codeArea" placeholder="这里会显示恢复码；也可以把之前保存的恢复码粘贴到这里">${backupCode}</textarea>
          <div class="ci-btns" style="justify-content:flex-start">
            <button class="btn btn-primary btn-sm" data-backup="confirm">✅ 确认恢复</button>
            <button class="btn btn-ghost btn-sm" data-backup="pickfile">📁 选择备份文件</button>
          </div>
          <input type="file" id="fileInput" accept="application/json,.json" style="display:none">
        </div>` : ''}
    </div>`;
}

/* =======================================================
   云账号与多设备同步
   ======================================================= */
let syncing = false, syncTimer = null, accMode = 'login', accBusy = false, accTip = '';

function scheduleSync() {
  if (syncing) return;
  if (typeof Cloud === 'undefined' || !Cloud.configured()) return;
  if (!state.user || !state.user.uid) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncNow(false); }, 1800);
}

function exportPayload() {
  const b = backupData();
  b.updatedAt = state.updatedAt;
  return b;
}

/* 用云端数据覆盖本地（静默，不弹提示） */
function applyRemote(p) {
  if (!p) return;
  state.stars = p.stars || 0;
  state.streak = p.streak || 0;
  state.bestStreak = p.bestStreak || 0;
  state.lastDate = p.lastDate || '';
  state.perfectDays = p.perfectDays || 0;
  state.totalChecks = p.totalChecks || 0;
  state.honorLevel = p.honorLevel || 0;
  state.sportGoal = Object.assign(state.sportGoal, p.sportGoal || {});
  if (p.mods) MODULES.forEach(m => {
    if (p.mods[m.id]) state.mods[m.id] = Object.assign(emptyMod(), p.mods[m.id]);
  });
  if (Array.isArray(p.history)) state.history = p.history.slice(0, 200);
  state.today = defaultState().today;
  state.today.date = todayStr();
  if (p.today && p.today.date === todayStr()) {
    state.today = Object.assign(state.today, p.today);
    state.today.sportData = Object.assign(defaultState().today.sportData, p.today.sportData || {});
  }
  state.updatedAt = p.updatedAt || Date.now();
  saveLocal();
}

/* 同步：云端比本地新 → 拉取；否则 → 上传本地 */
async function syncNow(manual) {
  if (typeof Cloud === 'undefined' || !Cloud.configured() || !state.user || !state.user.uid) return;
  if (syncing) return;
  syncing = true;
  try {
    const remote = await Cloud.pull(state.user.uid);
    const rTime = remote ? (remote.updatedAt || 0) : 0;
    const lTime = state.updatedAt || 0;
    // lTime 为 0 表示本机还没有任何实质数据（新设备）→ 无条件以云端为准
    if (remote && remote.payload && (lTime === 0 || rTime > lTime + 1500)) {
      applyRemote(Object.assign({}, remote.payload, { updatedAt: rTime }));
      if (manual) toast('☁️', '已从云端同步', '最新数据已同步到这台设备');
    } else {
      const ok = await Cloud.push(state.user.uid, exportPayload());
      if (manual) toast(ok ? '☁️' : '⚠️', ok ? '已备份到云端' : '同步失败', ok ? '星星和天数都安全保存啦' : '请检查网络，数据仍在本地');
    }
    state.user.lastSync = Date.now();
    saveLocal();
  } catch (e) {
    if (manual) toast('⚠️', '同步失败', '请检查网络，数据仍在本地');
  } finally {
    syncing = false;
    render();
  }
}

function friendlyErr(e) {
  const m = String((e && (e.message || e.errMsg || e)) || '');
  if (/already.*registered|User already/i.test(m)) return '这个邮箱已经注册过，去登录即可';
  if (/Email not confirmed/i.test(m)) return '请先到邮箱点击验证链接激活账号';
  if (/Invalid login|invalid.*credentials|Invalid.*password/i.test(m)) return '邮箱或密码不对，再试一次～';
  if (/Password should be at least/i.test(m)) return '密码至少 6 位';
  if (/rate limit|too many/i.test(m)) return '尝试太频繁，请稍后再试';
  if (/network|timeout|fetch/i.test(m)) return '网络不太顺畅，稍后再试';
  if (/Invalid email/i.test(m)) return '邮箱格式好像不对哦';
  return m.slice(0, 40) || '出了点小问题，请稍后再试';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readAcc() {
  return {
    email: ((document.getElementById('accEmail') || {}).value || '').trim(),
    pwd: (document.getElementById('accPwd') || {}).value || ''
  };
}

async function accLogin() {
  if (accBusy) return;
  const { email, pwd } = readAcc();
  if (!email || !pwd) { toast('✏️', '请填写完整', '邮箱和密码都要填哦'); return; }
  if (!EMAIL_RE.test(email)) { toast('✏️', '邮箱格式不对', '例如：parent@example.com'); return; }
  if (pwd.length < 6) { toast('🔒', '密码太短', '密码至少 6 位'); return; }
  accBusy = true;
  try {
    const u = await Cloud.login(email, pwd);
    if (u && u.uid) {
      state.user = { uid: u.uid, email: email, nick: u.nick || '', lastSync: 0 };
      saveLocal();
      toast('🎉', '登录成功', '正在同步数据…');
      await syncNow(false);
      go('home');
    } else { toast('😥', '登录失败', '请检查邮箱和密码'); }
  } catch (e) {
    toast('😥', '登录失败', friendlyErr(e));
  } finally { accBusy = false; }
}

async function accRegister() {
  if (accBusy) return;
  const { email, pwd } = readAcc();
  if (!email || !pwd) { toast('✏️', '请填写完整', '邮箱和密码都要填哦'); return; }
  if (!EMAIL_RE.test(email)) { toast('✏️', '邮箱格式不对', '例如：parent@example.com'); return; }
  if (pwd.length < 6) { toast('🔒', '密码太短', '密码至少 6 位'); return; }
  accBusy = true;
  try {
    const r = await Cloud.register(email, pwd);
    if (r && r.needVerify) {
      accMode = 'login';
      accTip = '注册成功！请到邮箱点击验证链接激活，然后回来登录 📬';
      render();
      toast('📧', '请到邮箱激活', '点开验证链接后即可登录');
      return;
    }
    const u = await Cloud.currentUser();
    if (u && u.uid) {
      state.user = { uid: u.uid, email: email, nick: u.nick || '', lastSync: 0 };
      saveLocal();
      toast('🎉', '注册成功', '正在同步数据…');
      await syncNow(false);
      go('home');
      return;
    }
    accMode = 'login';
    accTip = '注册成功！现在用这个邮箱和密码登录即可 🎉';
    render();
    toast('🎉', '注册成功', '请登录');
  } catch (e) {
    toast('😥', '注册失败', friendlyErr(e));
  } finally { accBusy = false; }
}

async function accLogout() {
  if (!confirm('退出登录后，这台设备上的数据仍会保留，但不再自动同步。确定退出吗？')) return;
  try { await Cloud.logout(); } catch (e) {}
  state.user = { uid: '', email: '', nick: '', lastSync: 0 };
  saveLocal();
  go('home');
}

/* 启动时恢复登录态并自动同步一次 */
async function initAccount() {
  if (typeof Cloud === 'undefined' || !Cloud.configured()) return;
  try {
    const u = await Cloud.currentUser();
    if (u && u.uid) {
      state.user = { uid: u.uid, email: u.email, nick: u.nick, lastSync: state.user.lastSync || 0 };
      saveLocal();
      render();
      syncNow(false);
    }
  } catch (e) { /* 忽略：保持本地模式 */ }
}

/* ---------- 账号页 ---------- */
function renderAccount() {
  const on = typeof Cloud !== 'undefined' && Cloud.configured();
  const logged = on && state.user && state.user.uid;

  if (!on) {
    return `
      <div class="card">
        <h3 class="card-title"><span class="c-emoji" style="background:var(--blue-l)">☁️</span>云同步未开启</h3>
        <p class="sec-hint">现在是<b>单机版</b>：数据保存在这台设备的浏览器里，换手机或清缓存会丢失。</p>
        <div class="acc-note">
          <b>给家长看的开通步骤（约 10 分钟）：</b><br>
          1. 打开 <b>tcb.cloud.tencent.com</b> 用微信/QQ 登录，免费开通云开发环境<br>
          2. 把云服务的 URL 和 anon key 填入配置文件并启用<br>
          3. 控制台「数据库」新建集合 <b>lp_users</b>，权限选<b>仅创建者可读写</b><br>
          4. 控制台「安全配置 → WEB 安全域名」加入本站域名<br>
          5. 把环境 ID 填进程序的配置文件，云同步即生效
        </div>
        <div class="ci-btns" style="justify-content:flex-start;margin-top:16px">
          <button class="btn btn-purple btn-sm" data-go="honor">🛡️ 用备份码保护数据</button>
        </div>
      </div>`;
  }

  if (logged) {
    const syncTxt = state.user.lastSync
      ? `上次同步：${new Date(state.user.lastSync).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '还没同步过';
    return `
      <div class="card">
        <h3 class="card-title"><span class="c-emoji" style="background:var(--green-l)">👤</span>我的账号</h3>
        <div class="acc-user">
          <div class="acc-avatar">🦁</div>
          <div class="acc-info">
            <div class="acc-mail">${state.user.email}</div>
            <div class="acc-sync">☁️ ${syncTxt}</div>
          </div>
        </div>
        <div class="acc-tip">登录后打卡记录会自动备份到云端，换手机、清缓存都不怕丢 ⭐</div>
        <div class="ci-btns" style="justify-content:flex-start">
          <button class="btn btn-primary btn-sm" data-acc="sync">🔄 立即同步</button>
          <button class="btn btn-ghost btn-sm" data-acc="logout">退出登录</button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title"><span class="c-emoji" style="background:var(--yellow-l)">💡</span>在其他设备上使用</h3>
        <p class="sec-hint">在新手机/电脑上打开同一个网址，用这个<b>邮箱和密码</b>登录，星星和连续天数就会自动同步过来。</p>
      </div>`;
  }

  const isReg = accMode === 'register';
  return `
    <div class="card">
      <h3 class="card-title"><span class="c-emoji" style="background:var(--blue-l)">🔐</span>${isReg ? '注册家长账号' : '登录'}</h3>
      <p class="sec-hint">${isReg
        ? '用家长邮箱注册一个账号（这是云端身份标识，孩子不要用），注册即用，不用收任何邮件。'
        : '登录后打卡数据会自动备份到云端，换设备也不丢。'}</p>
      <div class="acc-form">
        <input class="acc-input" id="accEmail" type="email" inputmode="email" autocomplete="username" placeholder="家长邮箱（如 parent@example.com）">
        <input class="acc-input" id="accPwd" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" placeholder="密码（至少 6 位）">
        <button class="btn ${isReg ? 'btn-purple' : 'btn-primary'} btn-lg" data-acc="${isReg ? 'register' : 'login'}">
          ${isReg ? '🎈 注册并登录' : '🚀 登录'}
        </button>
        <button class="btn btn-ghost btn-sm" data-acc="switch">
          ${isReg ? '已有账号？去登录' : '还没有账号？去注册'}
        </button>
      </div>
      ${accTip ? `<div class="acc-tip ok">${accTip}</div>` : ''}
      <div class="acc-note" style="margin-top:16px">
        我们只保存邮箱和密码，<b>不会收集孩子的真实姓名、学校、手机号等隐私信息</b> 🔒<br>
        <span style="opacity:.75">提示：账号/密码请家长记在备忘录里，忘记后用「Forgot password」通过邮件找回。</span>
      </div>
    </div>`;
}

/* =======================================================
   交互
   ======================================================= */
function toast(emoji, title, text) {
  document.getElementById('modalEmoji').textContent = emoji;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalMask').classList.add('show');
}
function closeModal() { document.getElementById('modalMask').classList.remove('show'); }

function flyStars(n) {
  const box = document.getElementById('starFall');
  for (let i = 0; i < Math.min(n * 3, 20); i++) {
    const el = document.createElement('div');
    el.className = 'fly-star';
    el.textContent = ['⭐', '🌟', '✨', '🎉'][i % 4];
    el.style.left = (Math.random() * 90 + 2) + '%';
    el.style.top = (Math.random() * 30 + 8) + '%';
    el.style.animationDelay = (Math.random() * .35) + 's';
    box.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

/* 打卡 */
function doCheck(id) {
  if (isDone(id)) return;
  const t = todayStr();
  state.today[id] = true;

  // 模块连续天数
  const md = state.mods[id];
  md.streak = (md.last === yesterdayStr()) ? md.streak + 1 : (md.last === t ? md.streak : 1);
  md.last = t;
  md.total += 1;

  // 全局连续天数
  if (state.lastDate !== t) {
    state.streak = (state.lastDate === yesterdayStr()) ? state.streak + 1 : 1;
    state.lastDate = t;
  }
  state.bestStreak = Math.max(state.bestStreak || 0, state.streak);

  state.stars += STAR_PER_TASK;
  state.totalChecks += 1;

  let bonus = 0;
  if (isPerfect()) { bonus = STAR_ALL_BONUS; state.stars += bonus; state.perfectDays += 1; }

  // 荣誉升级检测
  const newHonor = honorIndex(state.streak);
  const levelUp = newHonor > (state.honorLevel || 0);
  if (levelUp) state.honorLevel = newHonor;

  save();
  render();
  flyStars(STAR_PER_TASK + bonus);

  const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
  if (levelUp) {
    const hv = HONOR_LEVELS[newHonor];
    toast(hv.emoji, `荣誉升级：${hv.name}！`, `连续打卡 ${state.streak} 天 · ${hv.desc}`);
  } else if (bonus) {
    toast('👑', '六项全勤，太厉害啦！', `获得 ${TOTAL_TASKS + bonus} 颗星星！${praise}`);
  } else {
    toast('🎉', '打卡成功！', `获得 ${STAR_PER_TASK} 颗星星 · ${praise}`);
  }
}

/* 撤销 */
function doUndo(id) {
  if (!isDone(id)) return;
  state.today[id] = false;
  if (id === 'sport') { state.today.sportData.ropeDone = false; state.today.sportData.bbDone = false; }
  const md = state.mods[id];
  md.total = Math.max(0, md.total - 1);
  md.streak = Math.max(0, md.streak - 1);
  md.last = '';
  state.stars = Math.max(0, state.stars - STAR_PER_TASK);
  state.totalChecks = Math.max(0, state.totalChecks - 1);
  save();
  render();
}

/* 全局事件委托 */
document.addEventListener('click', function (e) {
  const t = e.target.closest('[data-go],[data-check],[data-undo],[data-sport],[data-goal],[data-backup],[data-acc]');
  if (!t) return;

  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.dataset.check) { doCheck(t.dataset.check); return; }
  if (t.dataset.undo) { doUndo(t.dataset.undo); return; }

  // 备份 / 恢复
  if (t.dataset.backup) {
    const act = t.dataset.backup;
    if (act === 'file') { downloadBackup(); return; }
    if (act === 'code') { makeCode(); return; }
    if (act === 'toggle') { showBackup = !showBackup; if (showBackup && !backupCode) backupCode = ''; render(); return; }
    if (act === 'confirm') {
      const ta = document.getElementById('codeArea');
      restoreFromText(ta ? ta.value : '');
      return;
    }
    if (act === 'pickfile') {
      const fi = document.getElementById('fileInput');
      if (fi) fi.click();
      return;
    }
  }

  // 账号：登录 / 注册 / 退出 / 同步 / 切换模式
  if (t.dataset.acc) {
    const act = t.dataset.acc;
    if (act === 'login') { accLogin(); return; }
    if (act === 'register') { accRegister(); return; }
    if (act === 'switch') { accMode = accMode === 'login' ? 'register' : 'login'; accTip = ''; render(); return; }
    if (act === 'logout') { accLogout(); return; }
    if (act === 'sync') { syncNow(true); return; }
  }

  if (t.dataset.goal) {
    const id = t.dataset.goal;
    const it = SPORT_ITEMS.find(x => x.id === id);
    const v = prompt(`设置「${it.name}」的每日目标（${it.unit}）`, state.sportGoal[id]);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0 && n <= 10000) { state.sportGoal[id] = n; save(); render(); }
    }
    return;
  }

  if (t.dataset.sport) {
    const id = t.dataset.sport;
    const input = document.getElementById('input-' + id);
    const val = parseInt(input.value, 10) || 0;
    const goal = state.sportGoal[id];
    state.today.sport[id] = val;
    if (val < goal) {
      save(); render();
      toast('💪', '还差一点点！', `已经完成 ${val} 个，再努力 ${goal - val} 个就达标啦！`);
      return;
    }
    if (id === 'rope') state.today.sportData.ropeDone = true; else state.today.sportData.bbDone = true;
    save();
    if (!isDone('sport') && state.today.sportData.ropeDone && state.today.sportData.bbDone) {
      doCheck('sport');
    } else {
      save(); render();
      toast('✅', '一项完成！', '另一项也要加油哦～');
    }
    return;
  }
});

document.addEventListener('change', function (e) {
  if (e.target.classList && e.target.classList.contains('sport-input')) {
    const id = e.target.id.replace('input-', '');
    state.today.sport[id] = parseInt(e.target.value, 10) || 0;
    save();
  }
});

/* 备份文件选择（事件委托到 document，兼容动态渲染的 input） */
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'fileInput' && e.target.files && e.target.files[0]) {
    restoreFromFile(e.target.files[0]);
    e.target.value = '';
  }
});

document.getElementById('modalBtn').addEventListener('click', closeModal);
document.getElementById('modalMask').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

/* 启动 */
load();
go('home');
initAccount();
