/* =======================================================
   学习乐园 · 云端账号与同步层（Supabase）
   -------------------------------------------------------
   设计原则：本地优先（localStorage 永远可用），云端做备份与多设备同步。
   云未配置 / 未登录 / 请求失败时，应用完全等同单机版，不影响使用。
   ======================================================= */
const Cloud = (function () {
  let sb = null, inited = false, ready = false;

  function configured() {
    return typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.enabled
      && !!CLOUD_CONFIG.url && !!CLOUD_CONFIG.anonKey;
  }

  function init() {
    if (inited) return ready;
    inited = true;
    if (!configured()) return false;
    if (typeof supabase === 'undefined') { console.warn('[Cloud] SDK 未加载'); return false; }
    try {
      sb = supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.anonKey);
      ready = true;
      return true;
    } catch (e) { console.warn('[Cloud] 初始化失败', e); return false; }
  }

  async function currentUser() {
    if (!init()) return null;
    try {
      const { data, error } = await sb.auth.getUser();
      if (error || !data || !data.user) return null;
      const u = data.user;
      const meta = u.user_metadata || {};
      return {
        uid: u.id,
        email: u.email || '',
        nick: meta.nick || (u.email ? u.email.split('@')[0] : '')
      };
    } catch (e) { return null; }
  }

  /* 注册（邮箱+密码）。若 Supabase 已关闭 Confirm email，signUp 后直接建立 session；
     若未关闭，session 为空，需提示用户去邮箱点链接。 */
  async function register(email, pwd) {
    if (!init()) throw new Error('云端未配置');
    const { data, error } = await sb.auth.signUp({
      email: email,
      password: pwd,
      options: { data: { nick: email.split('@')[0] } }
    });
    if (error) throw error;
    return { needVerify: !data.session };
  }

  async function login(email, pwd) {
    if (!init()) throw new Error('云端未配置');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    return currentUser();
  }

  async function logout() {
    if (!init()) return;
    try { await sb.auth.signOut(); } catch (e) {}
  }

  /* 拉取本用户记录（payload + updatedAt） */
  async function pull(uid) {
    if (!init()) return null;
    try {
      const { data, error } = await sb.from(CLOUD_CONFIG.table)
        .select('payload,updated_at').eq('uid', uid).maybeSingle();
      if (error || !data) return null;
      return { uid, updatedAt: data.updated_at, payload: data.payload };
    } catch (e) { return null; }
  }

  /* 写入本用户记录（upsert：存在则覆盖，不存在则创建） */
  async function push(uid, payload) {
    if (!init()) return false;
    try {
      const { error } = await sb.from(CLOUD_CONFIG.table)
        .upsert({ uid, payload, updated_at: Date.now() });
      if (error) { console.warn('[Cloud] 上传失败', error); return false; }
      return true;
    } catch (e) { return false; }
  }

  return {
    configured, init, currentUser, register, login, logout, pull, push,
    get ready() { return ready; }
  };
})();
