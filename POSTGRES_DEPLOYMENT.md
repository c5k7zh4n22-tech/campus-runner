# PostgreSQL 部署说明

当前应用运行路径已从 Supabase 切换为普通 PostgreSQL + 应用层 cookie session + 本地文件存储。

## 必需环境变量

参考 `.env.example`：

```env
DATABASE_URL=postgresql://campus_runner:campus_runner_password@postgres:5432/campus_runner
AUTH_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_SITE_URL=https://your-domain.example
APP_URL=https://your-domain.example
AUTH_COOKIE_SECURE=true
SERVER_ACTION_ALLOWED_ORIGINS=your-domain.example
LOCAL_STORAGE_ROOT=/app/public/uploads
NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL=/uploads
```

`AUTH_SECRET` 必须至少 32 位，并且生产环境不能更换；更换后已有登录 cookie 会失效。

`SERVER_ACTION_ALLOWED_ORIGINS` 填域名即可，不需要 `https://`。应用也会自动从 `APP_URL` 和 `NEXT_PUBLIC_SITE_URL` 提取域名加入白名单；保留该变量是为了兼容反向代理或多域名访问。

## 初始化数据库

Docker Compose 会在首次创建 PostgreSQL 数据目录时自动执行：

```text
migrations/0001_postgres_app.sql
migrations/0002_messages.sql
```

如果使用宿主机已有 PostgreSQL：

```bash
npm run db:migrate
```

升级已有 Docker 数据库时，在新镜像启动后执行 `docker compose exec campus-runner node scripts/migrate.mjs`。消息中心依赖 `0002_messages.sql` 中的表、索引和通知触发器；该命令记录已执行迁移，可重复运行。

## 启动

```bash
cp .env.example .env.local
# 修改 .env.local 中的域名、数据库密码和 AUTH_SECRET
docker compose up --build -d
curl http://127.0.0.1:3000/api/health
```

## 反向代理

### Vercel 性能配置

`vercel.json` 的函数区域设为 `iad1`，对应目前 Neon 连接地址中的 AWS `us-east-1`。函数应靠近数据库，避免每条 SQL 在新加坡和美国东部之间往返。如果后续迁移数据库区域，应同步调整该配置；修改在重新部署后生效。

Vercel 每个函数实例默认最多使用 3 个 PostgreSQL 连接，允许页面并行查询和消息请求同时执行。可通过 `DATABASE_POOL_MAX` 覆盖，原有值为 `1` 时仍会串行排队；总连接数应结合实例数和数据库限制控制。连接等待超时为 10 秒，空闲连接保留 30 秒。当前应用使用 Neon pooler 连接地址。

消息已读请求按会话合并，通知已读请求按分类合并；聊天增量接口同时返回已读位置，不再额外读取一页历史。此性能更新不新增数据库迁移。

如果通过 Nginx、宝塔或面板反代到 Node.js，必须保留原始域名和协议，否则 Next.js Server Actions 会拒绝登录表单提交，或者回调跳转到错误地址：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

修改后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 创建管理员

先注册一个普通账号，然后执行：

```bash
docker compose exec campus-runner node scripts/promote-admin-postgres.mjs admin@example.com
```

## 当前存储

上传文件默认写入容器内 `/app/public/uploads`，Compose 已挂载为 `uploads` volume。生产环境建议迁移为 COS/OSS，只需要替换 `src/lib/services/storage.ts` 的实现或新增 provider。

## 微信和短信

当前微信登录被显式禁用，邮箱密码登录可用。短信服务仍是抽象占位，未来接入阿里云或腾讯云短信时实现 `SmsService` 即可。
