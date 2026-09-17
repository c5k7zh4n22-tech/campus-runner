# 双电脑同步说明

## 仓库

私有 GitHub 仓库：

```text
https://github.com/c5k7zh4n22-tech/campus-runner
```

Supabase 和 Vercel 都是共享云端项目，不需要在两台电脑上分别创建。

## 第二台电脑首次配置

```powershell
cd C:\dev
git clone https://github.com/c5k7zh4n22-tech/campus-runner.git
cd campus-runner
npm install
```

创建 `.env.local`，内容从当前电脑的 `.env.local` 安全复制，或从 Supabase/Vercel 仪表盘重新获取。`.env.local` 不会通过 Git 同步。

启动开发环境：

```powershell
npm run dev
```

连接 Supabase CLI：

```powershell
npx supabase login
npx supabase link --project-ref adsxzvmcsztqkxcbogyd
```

Vercel 已连接 GitHub。正常开发只需要推送 Git，不再需要每台电脑手动部署。

## 日常同步流程

开始工作前：

```powershell
git switch main
git pull --rebase
```

开发新功能时创建分支：

```powershell
git switch -c feature/功能名称
```

提交代码：

```powershell
git add .
git commit -m "feat: 功能说明"
git push -u origin feature/功能名称
```

在 GitHub 创建 Pull Request，合并到 `main` 后，Vercel 会自动部署 Production。

另一台电脑同步已合并的代码：

```powershell
git switch main
git pull --rebase
npm install
npm run dev
```

## 同时开发规则

- 两台电脑尽量不要直接同时修改 `main`。
- 每台电脑使用独立功能分支。
- 开始工作前先执行 `git pull --rebase`。
- 修改数据库时只新增 migration 文件，不修改已经应用的 migration。
- 同一时间只允许其中一个分支包含同一个 migration。
- 不要提交 `.env.local`、`.vercel`、`.vercel-config`、`.next` 或 `node_modules`。
- 密钥只保存在本机环境变量或密码管理器中。

## 常用检查

```powershell
npm run lint
npm test
npm run build
```

## 数据库迁移

新增 migration 后：

```powershell
npx supabase db push --linked --include-all
```

然后将 migration 文件提交到 Git。另一台电脑执行 `git pull --rebase` 后即可获得同一份迁移历史。
