/* =======================================================
   学习乐园 · 云端配置（Supabase）
   -------------------------------------------------------
   已配置：
   - 环境：pgchqpeittrecsgmwpff.ap-southeast-1.supabase.co
   - key 类型：sb_publishable（新版 2026 推荐 key，权限等同 anon key）
   - 数据库：lp_users 已建表 + 行级安全策略
   - 邮箱验证：已关闭
   ------------------------------------------------------- */
const CLOUD_CONFIG = {
  enabled: true,                     // ★ 云同步已开启
  url: 'https://pgchqpeittrecsgmwpff.supabase.co',
  anonKey: 'sb_publishable_uZKZ2zEgaYrXLGVqqCrW7w_kaZt0mjP',
  table: 'lp_users'
};
