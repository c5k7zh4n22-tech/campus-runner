# 国内 PostgreSQL 部署状态

项目运行路径已从 Vercel + Supabase 迁移为标准 Next.js + PostgreSQL：

- Next.js App Router + TypeScript 保持不变
- 数据库使用普通 PostgreSQL，入口为 `DATABASE_URL`
- 认证使用应用内邮箱密码登录和 HMAC 签名 cookie session
- 文件上传默认写入本地 `public/uploads`
- Docker Compose 可同时启动应用和 PostgreSQL
- Supabase SDK 不再是应用运行依赖

## 当前运行边界

- 数据库连接：`src/lib/db.ts`
- 认证服务：`src/lib/services/auth/postgres-auth-service.ts`
- 数据读取：`src/lib/data.ts`、`src/lib/marketplace.ts`
- 服务端写入和权限校验：`src/actions/*.ts`
- 文件存储：`src/lib/services/storage.ts`
- PostgreSQL 初始化 SQL：`migrations/0001_postgres_app.sql`
- Debian/Docker 部署说明：`POSTGRES_DEPLOYMENT.md`

## 不再使用 Supabase 的部分

- Supabase Auth 已替换为 `app_users` + signed cookie
- Supabase PostgREST 查询已替换为 SQL 查询
- Supabase RPC 权限逻辑已迁移到 server actions 和事务内校验
- Supabase Storage 已替换为本地存储 provider
- Supabase service role key 不再需要

## 当前仍需生产化的部分

- `package-lock.json` 需要在有 npm 的环境执行一次 `npm install` 同步 `pg` 依赖
- 本地文件存储适合单机部署；生产建议替换为 COS/OSS
- 微信登录当前禁用，需要新增 `auth_identities` 表和 provider 绑定逻辑
- 短信服务仍是 disabled provider，需要接入国内短信厂商
- 应用层权限已替代 Supabase RLS，后续应补充端到端权限测试
- Debian 生产需要 Nginx/Caddy HTTPS、备份、监控、日志、WAF/限流

## 启动摘要

```bash
cp .env.example .env.local
docker compose up --build -d
curl http://127.0.0.1:3000/api/health
```

创建管理员：

```bash
docker compose exec campus-runner node scripts/promote-admin-postgres.mjs admin@example.com
```
