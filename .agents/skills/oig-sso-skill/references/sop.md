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
3. 创建后执行 `git status --short --ignored playwright/.auth`，确认输出显示 `!! playwright/.auth/` 或该文件处于 ignored 状态；如果没有忽略规则，先补到 `.gitignore` 再继续。
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

1. 复用已有 `http://localhost:3000` 服务；如果不存在则启动 `pnpm run dev --host 127.0.0.1 --port 3000 --strictPort`。
2. 从当前工作树环境配置读取 clientId，打开配置的 SSO 入口。
3. 将 SSO 的异常跳转统一修正到 `https://caweb-auth-master.ksout.oigit.com/login/loginView`。
4. 自动填账号密码登录。
5. 将远端业务系统回跳地址改写为 `http://localhost:3000/...`。
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
PLAYWRIGHT_SSO_ENTRY_URL=https://<SSO主机>/login/loginView?clientId=<当前应用ID> bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
```

## 服务隔离存储

录制脚本通过 `scripts/sso-storage-key.mjs` 从本工作树环境配置读取 serviceCode，写入 `sso:<serviceCode>:token`。停止使用旧公共 token key；调整 serviceCode 后必须重新录制登录态。测试、开发和生产构建必须使用对应环境的 serviceCode，禁止跨系统复用存储文件。

## 真实本地会话与 HTTP 登录

在本地 ignored 环境配置中启用 `DEV_MOCK_SSO=true`，指定 `DEV_SSO_SESSION_FILE=playwright/.auth/dev-sso-session.local.json`，并配置当前应用的 clientId、serviceId、serviceCode 和测试网关 `PROXY_URL`。这些值不从其他业务系统复制。

```bash
PLAYWRIGHT_SSO_SESSION_ONLY=1 bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh
pnpm dev
```

该模式通过 SSO 的 HTTPS 登录页和 RSA 公钥协议登录，再向配置的测试网关验证 token、用户和菜单，不需要浏览器。未设置 session-only 时保留浏览器录制流程。脚本不打印密码或 token；会话文件限制在 `playwright/.auth/`，以 0600 权限原子写入，并校验应用和并发版本。

开发服务器只在 serve 且启用上述配置时读取会话。会话错误、过期或校验失败时关闭访问，绝不回退为静态 mock 用户；静态 mock 仅供显式未配置真实会话的开发模式。会话查询每分钟复核并在回到页面时刷新，生产构建关闭此能力。登录失败按凭据错误、锁定、验证码或权限错误分类，后几类不自动重复提交。
