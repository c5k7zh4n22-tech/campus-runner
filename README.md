# Campus Runner

面向莆田学院校园内部的互助跑腿平台 MVP。用户使用 12 位学号和手机号完成校园认证，发布订单后由其他认证用户接单，订单通过受约束的状态机流转，完成后双方可以评价。

## 当前生产环境

- Production: https://campus-runner-smoky.vercel.app
- Campus: 莆田学院（当前唯一开放学校）
- Verification: 12 位数字学号 + 有效手机号
- Login: 微信内网页授权为主，邮箱密码为备用方式
- Database: Supabase PostgreSQL（Singapore / `ap-southeast-1`）
- Hosting: Vercel Production
- Storage: Supabase Storage `avatars` bucket

## 技术栈

- Next.js 16 App Router
- React 19 + TypeScript strict
- Tailwind CSS 4
- Supabase PostgreSQL / Auth / Storage
- Zod server-side validation
- Vitest unit tests
- Vercel Production

## 本地运行

```bash
cp .env.example .env.local
npm install
npm run dev
```

必需环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` 只允许在本地运维脚本或可信服务器环境中使用，绝不能暴露到浏览器，也不要设置为 `NEXT_PUBLIC_*`。

## 测试

```bash
npm run lint
npm test
npm run build
```

生产端到端测试需要 service role key：

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="ANON_KEY"
$env:SUPABASE_SERVICE_ROLE_KEY="SERVICE_ROLE_KEY"
npm run test:e2e
```

测试覆盖注册用户、登录、12 位学号和手机号认证、发布订单、非法金额、过去截止时间、原子接单、重复接单、自己接自己的订单、合法状态流转、评价、重复评价、举报、管理员操作和多用户数据隔离。

## 数据库

迁移位于 `supabase/migrations`：

- `202609180001_campus_runner.sql`
- `202609180002_fix_profile_rating_trigger.sql`
- `202609180003_putian_12_digit_verification.sql`
- `202609180004_require_phone_for_verification.sql`
- `202609180005_enforce_verified_phone.sql`

部署迁移：

```bash
npx supabase link --project-ref PROJECT_REF
npx supabase db push --linked --include-all
```

RLS 已覆盖 `profiles`、`orders`、`reviews`、`reports`、`campuses` 和 Storage。订单接单与状态转换通过带权限校验的 PostgreSQL 函数完成，前端按钮不是权限边界。

## 微信一键授权配置

微信一键授权只能在微信内置浏览器中使用，不使用开放平台网站应用扫码登录。服务端回调位于：

```text
https://campus-runner-smoky.vercel.app/api/auth/wechat/callback
```

在微信公众平台创建或打开已认证服务号后配置：

1. 进入“设置与开发 → 基本配置”，获取公众号 AppID 和 AppSecret
2. 进入“公众号设置 → 功能设置 → 网页授权域名”，填写 `campus-runner-smoky.vercel.app`
3. 将微信提供的 `MP_verify_*.txt` 放`public/`目录并重新部署
4. 在 Vercel Production 环境变量添加：
   - `WECHAT_OFFICIAL_ACCOUNT_APP_ID`
   - `WECHAT_OFFICIAL_ACCOUNT_APP_SECRET`
   - `WECHAT_REDIRECT_URI=https://campus-runner-smoky.vercel.app/api/auth/wechat/callback`
5. 重新部署后，在微信内打开网站即可一键授权

微信用户会创建独立的 Supabase Auth 身份，并自动关联到莆田学院。原有邮箱密码用户、profiles 数据和 RLS 策略不受影响。

## 第一个管理员

先在网站注册并完成邮箱验证，然后在项目根目录运行：

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SERVICE_ROLE_KEY"
npm run admin:promote -- your-email@example.com
```

也可以使用 Supabase Dashboard 的 SQL Editor 执行：

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```

## 部署

```bash
npx vercel --prod --yes
```

当前生产变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://campus-runner-smoky.vercel.app`
- `SUPABASE_SERVICE_ROLE_KEY`（仅服务端 Secret）
- `WECHAT_REDIRECT_URI`
- `WECHAT_OFFICIAL_ACCOUNT_APP_ID`（待配置）
- `WECHAT_OFFICIAL_ACCOUNT_APP_SECRET`（待配置）

## 生产注意事项

- 微信一键授权仅能在微信内打开的网页中使用。
- 外部浏览器继续使用邮箱密码登录。
- 正式大规模注册前应在 Supabase Auth 中接入自有 SMTP。
- MVP 不包含在线支付，跑腿费由用户线下自行结算。
- 图片上传仅用于头像，限制 JPG/PNG/WebP、最大 2MB。
- 公开订单不会展示手机号。只有接单后的订单参与者可以查询对方联系方式。
- 管理员权限同时在服务端和 PostgreSQL RLS/函数中校验。
