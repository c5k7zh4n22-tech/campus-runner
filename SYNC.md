# 双电脑同步说明

## 仓库

私有 GitHub 仓库：

```text
https://github.com/c5k7zh4n22-tech/campus-runner
```

当前项目使用普通 PostgreSQL，不依赖 Supabase 云端项目。两台电脑只需要同步代码和各自的 `.env.local`。

## 第二台电脑首次配置

```powershell
cd C:\dev
git clone https://github.com/c5k7zh4n22-tech/campus-runner.git
cd campus-runner
npm install
copy .env.example .env.local
```

按本机 PostgreSQL 修改 `.env.local` 中的 `DATABASE_URL` 和 `AUTH_SECRET`。

初始化数据库：

```powershell
psql "$env:DATABASE_URL" -f migrations/0001_postgres_app.sql
```

启动开发环境：

```powershell
npm run dev
```

## 日常同步流程

```powershell
git switch main
git pull --rebase
npm install
npm run dev
```

## 数据库迁移

修改数据库时只新增 `migrations/*.sql` 文件，不修改已经应用到生产库的迁移。另一台电脑拉取后手动执行新增迁移。

## 常用检查

```powershell
npm run lint
npm test
npm run build
```
