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
npm run db:migrate
```

## Docker 运行

```bash
cp .env.example .env.local
docker compose up --build -d
curl http://127.0.0.1:3000/api/health
```

Compose 会启动 PostgreSQL，并在首次初始化时按顺序执行 `migrations` 中的 SQL 文件。

## 管理员

先在网站注册账号，然后执行：

```bash
npm run admin:promote -- your-email@example.com
```

Docker 环境：

```bash
docker compose exec campus-runner node scripts/promote-admin-postgres.mjs your-email@example.com
```

## 消息中心

新增 `/messages` 手机消息中心、会话详情、订单通知和系统通知。订单双方可从订单详情发起聊天，同校用户可从在售闲置详情咨询卖家。管理员在 `/admin/announcements` 发布平台公告。

部署前运行 `npm run db:migrate`，按顺序执行 `migrations/0001_postgres_app.sql`、`0002_messages.sql`。迁移会记录已执行文件；已有数据库也可使用。Docker 的初始化脚本仅在首次创建数据卷时运行，已有数据卷必须手动迁移。

消息页在上次请求结束后间隔 5 秒刷新，底部未读数每 30 秒刷新；发送或读取消息后主动更新。标签页隐藏时暂停，重新聚焦后刷新，失败时逐步延长重试间隔至 60 秒；并非浏览器推送通知。通知从迁移后的订单状态变化和认证审核结果开始记录，不补造历史通知。读取标记只更新当前用户收到且已展示的消息，“全部已读”只影响提交时已有的消息。

已有 Docker 数据库的升级命令：`docker compose exec campus-runner node scripts/migrate.mjs`。

## 闲置交易方式

发布闲置时可选择“平台交易”或“线下自行交易”。两种交易方式的价格都允许填写 0 元；线下自行交易可挂金额，成交后卖家可直接完成订单，不产生金额扣费。平台交易有金额时需买家完成平台支付后才能完成订单，成交后向卖家收取商品金额 1% 的基础软件服务费；零元平台交易不收费，可直接完成。当前版本先记录交易方式并展示费用规则，有金额的平台交易完成动作会被服务端拦截，真实支付、扣款、担保交易和结算需要接入微信支付后才会生效。

上线前执行迁移 `0008_marketplace_trade_mode.sql`，给已有闲置商品补充默认交易方式“线下自行交易”。

## 校园拼车（组队打车）

同行性别要求支持“不限 / 仅男生 / 仅女生”，发布时默认不限，发布后不提供修改以免影响已有成员。大厅可按要求筛选，卡片和详情展示标签。账号没有核验性别字段，因此限制行程以用户主动声明为依据：发起人确认本人及已有同行符合要求，申请人确认本次全部同行符合要求；服务端在创建、申请及批准时校验声明，不从学号、姓名或头像推断性别。上线需追加执行 `0007_carpool_gender.sql`，旧行程默认不限。此功能不代表平台提供性别真实性保证。

首页“发布任务”快捷卡片改为“校园拼车 / 找同路，一起出发”，底部跑腿发布入口保留。`/carpool` 提供同校行程列表及路线、北京时间筛选；`/carpool/new` 发布；`/carpool/mine` 查看本人发起/申请过的行程；详情页处理报名、更新集合说明、退出、取消、出发及完成。平台不提供司机、车辆、车费报价或车费代收，也不生成跑腿/闲置订单或邀请奖励。发布和申请免费；发起人确认申请后，申请人需支付 0.09 元基础软件服务费才正式占位、进入群聊和查看集合说明。支付后视为平台撮合服务开始，退出、未成行或发起人取消的退款需按规则通过客服审核处理；车辆出发时间超过 2 小时且已有正式占位成员时，系统会自动结束行程并进入结算语义，真实扣费需接入支付和结算后才会生效。

上线前执行迁移 `0006_carpool.sql`（依赖消息与售后基础表）、`0009_carpool_payment_pending.sql`，再部署应用。发布和筛选均支持手动输入地点；出发地快捷项为东区校门口、中区校门口、西区校门口，目的地快捷项为莆田站、涵江站。发布时自定义名称去除首尾空白并在事务内解析到本校地点，禁止起终点相同和使用已停用地点。管理员仍可在 `/admin/carpool` 管理地点。筛选按名称包含匹配，留空表示不限，同时保留原地点 ID 筛选接口兼容性。车辆出发时间限未来 30 天，计划人数 2～6 人（含已有同行）。满员和过期由服务端实时计算；车辆出发时间超过 2 小时且已有正式占位成员时，会在下一次访问时自动转为已结束。车辆出发时间后禁止报名和审核；发起人可在车辆出发时间前确认出发并停止招募，出发后才能结束。

发布和申请须校园认证，确认申请时再次检查申请人资格。待确认不占人数，批准/退出/状态变更及群聊操作锁定同一行程，防止并发超员和退出后继续取消息。每个账号每行程只能申请一次，拒绝或退出后不再重复申请；发起人取消整条行程而不能单独退出。群聊只向确认成员开放，加入前消息不提供，退出后立即禁止接口访问；取消、过期或结束后群聊只读。成员代表多人同行时，由申请人代为沟通，仅该账号具有群聊权限。界面昵称脱敏，不提供电话、学号等资料。

报名结果、退出、集合变化及行程状态生成系统通知；独立群聊在消息中心展示并计入未读总数，全部已读同时处理群聊水位。群聊定时增量刷新，隐藏页面暂停；离开成员下一次请求返回无权访问，界面隐藏缓存消息。行程问题/举报使用客服工单的独立 `trip_id` 字段，允许同校用户举报，申请人和管理员可查看工单，其他同行成员不可查看举报详情。

本地 PostgreSQL 集成测试覆盖并发最后名额、重复申请、过期、跨校隔离、退出后群聊拒绝、加入前历史隔离、消息分页与未读、通知及售后独立关联。设置 `MESSAGE_TEST_DATABASE_URL` 后运行 `npm test`。

## 客服售后使用说明

用户从 `/support`、“我的”、消息中心或本人订单详情进入客服售后。支持订单问题、退款与费用、账号与认证及意见反馈；订单/退款问题必须关联本人发布或接取的跑腿订单。申请和用户/客服补充回复支持截图证明，不提供自动退款。

截图每次最多 3 张，支持 JPG/PNG/WebP，前端接收每张不超过 5MB 的原图，自动压缩至 800KB 内；请求总量限制 3MB。服务端校验实际图片内容、限制像素数并重新编码为 WebP，移除元数据。截图与回复在同一事务中写入 `support_attachments`，重复请求不重复保存，列表仅返回图片编号。图片通过 `/api/support/attachments/[id]` 鉴权读取，仅申请人和正常状态管理员可查看，禁止公共缓存。已提交截图保留为处理证据，不能自行移除。

上线前需迁移 `0005_support_attachments.sql`。当前为兼容 Vercel 且无需新增存储密钥，压缩截图存入 PostgreSQL，不依赖服务器临时磁盘。数据库备份也包括截图；正式规模运营时需监测数据库存储增长，后续可迁移到私有对象存储，仍保留鉴权访问。

管理员从 `/admin/support` 查看、筛选和受理工单，回复后进入“待补充”，用户补充后进入“处理中”。客服可以标记解决并填写处理说明；用户可确认关闭、撤回，或重新打开已解决/关闭的工单。用户补充与客服处理会通过现有系统通知提醒相关人员。工单状态不改变订单状态，也不表示资金已经退回。

部署前执行 `node scripts/migrate.mjs` 应用 `0004_support.sql`，并确认已有 `0002_messages.sql`。列表每 30 秒、详情每 15 秒刷新，隐藏页面暂停轮询。每用户每小时最多创建 5 个工单，同一工单每分钟最多 10 条回复；关键写入使用事务、幂等标识和版本校验。只允许申请人及正常状态的管理员查看详情。

集成测试使用 `MESSAGE_TEST_DATABASE_URL` 指向独立测试库，覆盖工单隔离、关联订单权限、幂等、状态并发、通知、分页及请求来源校验。

## 运行测试

PostgreSQL 集成测试使用独立 schema，结束后删除该测试 schema。请将 `MESSAGE_TEST_DATABASE_URL` 指向专用测试数据库，再运行 `npm test`。未设置时跳过集成测试，仍运行输入校验和原有单元测试。覆盖账号隔离、幂等发送、未读水位、通知事务、搜索、分页和管理员权限。

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
