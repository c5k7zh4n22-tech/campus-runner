# 国内生产环境迁移就绪说明

本项目当前仍正常部署在 Vercel + Supabase，不要求立即迁移。本文档说明迁移到中国大陆云服务器、PostgreSQL、COS/OSS 和国内短信服务时需要替换的边界。

## 保持不变的架构

- Next.js App Router
- TypeScript strict mode
- PostgreSQL / SQL
- 服务端权限和 RLS 思维
- GitHub 双电脑同步
- 数据集中的服务端数据访问

项目没有 SQLite 依赖。

## 已完成的抽象

### Auth Service

位置：`src/lib/services/auth`

业务层通过以下接口访问认证：

- `authService.getCurrentUser()`
- `authService.signInWithPassword()`
- `authService.signUpWithPassword()`
- `authService.signOut()`
- `authService.exchangeCodeForSession()`

当前实现：`SupabaseAuthService`

迁移时只需新增新的 AuthService 实现，业务 actions 和页面不需要改为直接操作新厂商 SDK。

### Auth Admin Service

位置：`src/lib/services/auth/supabase-auth-admin-service.ts`

将以下服务端密钥操作集中管理：

- 创建已确认用户
- 查找用户
- 更新用户元数据
- 生成 Magic Link token

Service Role Key 只在 `src/lib/services/admin-client.ts` 中读取，带 `server-only`，不会进入浏览器 bundle。

### Storage Service

位置：`src/lib/services/storage.ts`

统一文件操作：

- 上传文件
- 删除文件
- 获取公开 URL

当前支持 `avatars` 和 `marketplace` bucket。迁移 COS/OSS 时实现相同接口即可。

### SMS Service

位置：`src/lib/services/sms.ts`

统一短信能力：

- `sendVerificationCode(phone)`
- `verifyCode(phone, code)`

当前默认是 disabled provider；也可以通过 `SMS_PROVIDER=supabase` 使用 Supabase Phone Auth。未来可以接阿里云、腾讯云短信。

### WeChat Provider

位置：`src/lib/services/auth/wechat-provider.ts`

微信 OAuth 已抽象为：

- `getAuthorizationUrl(state)`
- `exchangeCode(code)`
- `isConfigured()`

当前实现是基于微信公众号网页授权的 “微信内一键授权”，不再使用网站应用扫码登录。

### Runtime Provider 配置

位置：`src/lib/services/runtime-config.ts`

环境变量控制：

- `AUTH_PROVIDER`
- `DATABASE_PROVIDER`
- `STORAGE_PROVIDER`
- `SMS_PROVIDER`
- `WECHAT_PROVIDER`

健康检查会报告 Provider 配置状态，但不会返回密钥。

## 仍然存在的 Supabase 依赖

这些是下一步迁移到普通 PostgreSQL 时需要重点处理的部分：

1. `src/lib/data.ts`
   - 使用 Supabase PostgREST 查询订单、用户、评价和举报。
2. `src/lib/marketplace.ts`
   - 使用 Supabase PostgREST 查询闲置商品和购买申请。
3. 数据库 RPC
   - 原子接单、状态转换、认证审核、闲置购买等逻辑目前是 PostgreSQL 函数，仍然兼容普通 PostgreSQL。
4. Supabase Auth Cookie
   - `src/lib/supabase/server.ts`
   - `src/lib/supabase/middleware.ts`
   - 迁移到国内认证时需要替换为 JWT Session / Cookie Session。
5. Supabase Storage 具体实现
   - `src/lib/services/storage.ts`
   - 业务层已不直接调用 Supabase Storage，迁移时只需实现 COS/OSS provider。
6. Supabase SQL 文件
   - `supabase/migrations/*.sql`
   - SQL 可迁移到普通 PostgreSQL，但需要将 Supabase Auth/RLS 相关部分改写为应用角色和权限模型。

## Vercel-only 与 Supabase-only 检查

### Vercel-only

- `vercel.json`：仅用于当前 Vercel 新加坡区域，不是运行时代码依赖。
- GitHub 自动部署配置：Vercel 平台配置，不影响 Docker。
- 项目代码不再依赖 `VERCEL_PROJECT_PRODUCTION_URL`。

### Supabase-only

- Auth SDK 和 Cookie 管理。
- Storage SDK。
- PostgREST 查询语法。
- Supabase RLS 的 `auth.uid()` 体系。
- Supabase 内置 Phone Auth。

### SQLite-only

未发现 SQLite、better-sqlite3 或本地数据库文件依赖。

## Docker

构建镜像：

```bash
docker build -t campus-runner:latest .
```

使用环境文件启动：

```bash
docker compose up --build -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

停止：

```bash
docker compose down
```

## 普通 Node.js 运行

```bash
npm ci
npm run build
npm start
```

生产环境默认通过 `PORT` 读取端口。Docker 使用 Next.js standalone output，不依赖 Vercel Runtime。

## 中国大陆正式上线前仍缺少

- 已备案的正式域名和 ICP 备案主体
- 中国大陆或合规香港云服务器
- 国内 PostgreSQL 实例和备份策略
- COS/OSS bucket、CDN 和上传签名服务
- 国内短信服务商、签名和模板审核
- 微信公众号服务号网页授权域名配置
- 自建或替换 Supabase Auth 的 Session/JWT 方案
- 日志、监控、报警、WAF、限流和审计
- 数据合规、隐私政策和用户协议
- 生产密钥管理服务
