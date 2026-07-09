# AI Playwright SSO 登录 SOP

## 目标

为本地 AI 测试稳定生成 SSO 登录态，并让测试访问 `http://localhost:3000`。

## 本地凭据

凭据放在本地忽略文件：

```text
playwright/.auth/sso-ai-login.local.json
```

如果该文件不存在，且没有同时设置 `PLAYWRIGHT_SSO_ACCOUNT` 与 `PLAYWRIGHT_SSO_PASSWORD`，有两种合法路径：

1. 用户直接运行 `scripts/auth-sso-local.sh`：脚本会在终端交互询问账号和密码，并生成本地凭据文件。
2. agent 代办：先询问用户账号和密码，然后生成：

```json
{
  "account": "<用户提供的账号>",
  "password": "<用户提供的密码>"
}
```

创建要求：

1. 先执行 `mkdir -p playwright/.auth`。
2. agent 手动创建时用 `apply_patch` 创建或更新 `playwright/.auth/sso-ai-login.local.json`。
3. 创建后执行 `git status --short --ignored playwright/.auth`，确认输出显示 `!! playwright/.auth/` 或该文件处于 ignored 状态。
4. 不要在最终回复、日志摘要、Skill 或 tracked 文档中复述密码。

也可以用环境变量覆盖：

```bash
PLAYWRIGHT_SSO_ACCOUNT=... PLAYWRIGHT_SSO_PASSWORD=... bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
```

不要打印凭据、`ticket` 或 `token`。

## 刷新登录态

```bash
bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
```

脚本行为：

1. 复用已有 `http://localhost:3000` 服务；如果不存在则启动 `pnpm run dev -- --host 127.0.0.1 --port 3000 --strictPort`。
2. 打开测试 SSO 入口 `https://caweb-auth-master.ksout.oigit.com/sso/logout?clientId=2064249343121747970`。
3. 将 SSO 的异常跳转统一修正到 `https://caweb-auth-master.ksout.oigit.com/login/loginView`。
4. 自动填账号密码登录。
5. 将测试环境回跳地址 `http://192.168.186.148:30227/track-bench-admin/...` 改写为 `http://localhost:3000/...`。
6. 保存登录态到 `playwright/.auth/user.json`。

默认使用 headless 浏览器；需要观察登录过程时执行：

```bash
PLAYWRIGHT_HEADLESS=0 bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
```

## 运行 AI E2E

```bash
bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh
```

该命令会先执行 Skill 内置 `auth-sso-local.sh` 刷新登录态，然后使用 Skill 内置 `playwright.ai.config.ts` 访问 `http://localhost:3000` 并加载 `playwright/.auth/user.json`。默认只运行 `@ai-sso` 烟测，用于确认登录态和本地 3000 访问链路稳定。

## 常用覆盖项

```bash
PLAYWRIGHT_SSO_APP_URL=http://localhost:3000/dashboard/overview bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
PLAYWRIGHT_AI_BASE_URL=http://localhost:3000 bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh
PLAYWRIGHT_AI_GREP='@workspace-v2' bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh
PLAYWRIGHT_SSO_ENTRY_URL=https://caweb-auth-master.ksout.oigit.com/login/loginView?clientId=2064249343121747970 bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
```
