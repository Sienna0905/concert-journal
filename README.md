# Concert Journal

一个用于记录演出、演唱会和音乐节的静态网页小工具。

## 功能

- 记录演出名称、艺人、日期、城市、场馆、评分、同行人、备注和歌单
- 搜索、排序、编辑和删除记录
- 从备忘录文本粘贴导入
- 导出和导入 JSON 备份
- 可选 Supabase 登录和跨设备同步

## 本地使用

直接打开 `index.html` 即可使用。本地模式的数据保存在当前浏览器里。

## Supabase 配置

复制 Supabase 项目的 Project URL 和 anon public key，填入 `config.js`：

```js
window.CONCERT_JOURNAL_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon public key",
};
```

不要把 service role key 放进前端代码。

数据库建表和权限设置见 `SUPABASE_SETUP.md` 和 `supabase-schema.sql`。
