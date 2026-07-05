# Supabase 配置步骤

## 1. 新建项目

打开 Supabase，新建一个项目。项目创建完成后，进入这个项目的后台。

## 2. 创建数据表和权限

打开 `SQL Editor`，复制 `supabase-schema.sql` 的全部内容并运行。

这个 SQL 会创建 `concert_shows` 表，并开启 Row Level Security。每个登录用户只能读写自己的演出记录。

## 3. 复制前端配置

在 Supabase 项目后台找到：

- Project URL
- anon public key

然后填入 `config.js`：

```js
window.CONCERT_JOURNAL_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon public key",
};
```

不要使用 `service_role` key。`anon public key` 是给网页前端使用的公开 key，真正的数据隔离由 RLS 策略完成。

## 4. 登录设置

如果想让注册后立刻可登录，可以在 Supabase 的 Authentication 设置里关闭邮箱确认。

如果保留邮箱确认，用户注册后需要先打开邮箱里的确认链接，再回到网页登录。
