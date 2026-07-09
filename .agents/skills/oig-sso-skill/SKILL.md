---
name: oig-sso-skill
description: 本仓库 AI Playwright 测试 SSO 登录态 SOP。处理本地 localhost:3000、playwright/.auth、Skill 内置 auth-sso-local/run-ai-e2e 脚本、SSO wildcard 跳转、测试环境回跳改写或登录态失效时必须使用。
---

# OIG SSO Skill

## 使用边界

用于本仓库 `/Users/youdingte/work/track-bench-admin` 的 AI E2E 登录态准备和验证。它不替代通用代码规范；如果需要修改代码，仍必须同时使用 `oig-tanstack-admin` 并按任务路由读取相关 reference。

不要把账号、密码、ticket、token 写入 Skill、文档、提交信息或控制台汇报。凭据只允许来自本地 ignored 文件或环境变量。

## 标准流程

1. 检查 `playwright/.auth/sso-ai-login.local.json` 是否存在，或确认调用方设置了 `PLAYWRIGHT_SSO_ACCOUNT` 与 `PLAYWRIGHT_SSO_PASSWORD`。只报告“存在/缺失”，不要打印内容。
2. 如果本地凭据文件缺失且环境变量也缺失，必须先询问用户账号和密码；拿到后创建 `playwright/.auth/sso-ai-login.local.json`，内容只包含 `account` 和 `password`。创建后确认 `playwright/.auth/` 仍被 `.gitignore` 忽略。
3. 运行 `bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh` 刷新 `playwright/.auth/user.json`。
4. 运行 `bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh` 验证本地 `http://localhost:3000` 可用且已加载 SSO 登录态。
5. 若只需要验证已有登录态，可直接运行 `NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost pnpm exec playwright test --config=.agents/skills/oig-sso-skill/scripts/playwright.ai.config.ts`。

## 诊断规则

- 看到 `OIG统一登录认证平台`：登录态未加载或已失效，先跑 `bash .agents/skills/oig-sso-skill/scripts/auth-sso-local.sh`。
- URL 停在 `http://192.168.186.148:30227/track-bench-admin/...`：远端回跳没有被替换到 localhost，检查 `scripts/record-auth.mjs` 的回调改写逻辑。
- URL 含 `https://*.ksout.oigit.com/login/loginView` 或 `http://caweb-auth-master.../login/loginView`：SSO 跳转修正失效，检查 `e2e/support/sso-login-redirect-patch.*`。
- 页面显示 404 但侧栏已显示登录用户：这不是 SSO 失败，通常是测试访问了当前真实路由中不存在的旧路径。
- `run-ai-e2e.sh` 默认只跑 `@ai-sso`；如需跑其他用例，用 `PLAYWRIGHT_AI_GREP='@workspace-v2' bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh`。
- `auth-sso-local.sh` 报缺少 SSO credentials：按标准流程询问用户账号密码并生成本地凭据文件，不要把凭据写到 tracked 文件。

## 参考

需要完整命令、变量和脚本行为时读取 `references/sop.md`。
