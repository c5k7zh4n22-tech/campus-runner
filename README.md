# Campus Runner

面向校园内部的互助跑腿和闲置交易平台。当前版本已移除 Supabase 运行依赖，使用普通 PostgreSQL、应用内邮箱密码登录、cookie session 和本地文件存储，便于部署到中国大陆云服务器。

## 技术栈

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL
- 应用内 Auth：`app_users` + HMAC signed cookie
- 本地文件存储：`public/uploads`
- Docker / Docker Compose
- Vitest

## 本地运行

```bash
cp .env.example .env.local
npm install
npm run dev
```

必需环境变量：

```env
DATABASE_URL=postgresql://campus_runner:campus_runner_password@localhost:5432/campus_runner
AUTH_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_SITE_URL=http://localhost:3000
APP_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
```

手机通过局域网 HTTP 访问本机服务时，把 `NEXT_PUBLIC_SITE_URL` 和 `APP_URL` 改成实际访问地址，例如 `http://192.168.1.20:3000`，并保持 `AUTH_COOKIE_SECURE=false`。正式 HTTPS 部署时删除该值或设为 `true`。

初始化数据库：

```bash
psql "$DATABASE_URL" -f migrations/0001_postgres_app.sql
```

## Docker 运行

```bash
cp .env.example .env.local
docker compose up --build -d
curl http://127.0.0.1:3000/api/health
```

Compose 会启动 PostgreSQL，并在首次初始化时执行 `migrations/0001_postgres_app.sql`。

## 管理员

先在网站注册账号，然后执行：

```bash
npm run admin:promote -- your-email@example.com
```

Docker 环境：

```bash
docker compose exec campus-runner node scripts/promote-admin-postgres.mjs your-email@example.com
```

## 测试

```bash
npm run lint
npm test
npm run build
```

## 生产说明

- 当前微信登录禁用，邮箱密码登录可用。
- 短信服务仍是抽象占位，需要接入国内短信厂商。
- 本地文件存储适合单机部署；生产建议替换为 COS/OSS。
- PostgreSQL 权限由服务端 action 校验，不再依赖 Supabase RLS。
- Debian 12 部署细节见 [POSTGRES_DEPLOYMENT.md](./POSTGRES_DEPLOYMENT.md)。
- 当前迁移状态见 [MIGRATION_READINESS.md](./MIGRATION_READINESS.md)。
