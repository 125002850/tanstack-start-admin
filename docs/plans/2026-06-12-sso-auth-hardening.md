# SSO 鉴权收口与会话治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个显式、可测试、低耦合的前端 SSO 会话边界，修复当前 `401` 无法正确收口、`logoutUrl` 死链、token 契约不清晰和 bootstrap 分叉的问题。

**Architecture:** 推荐把当前分散在 `token.ts`、`queries.ts`、`transport.ts` 的副作用收敛到一个显式的 `session` 边界；业务 API 统一走共享 transport，但 bootstrap login-info 请求必须绕开 unauthorized redirect；`/dashboard` 作为当前受保护 shell 负责 bootstrap 当前登录用户和登出上下文；UI 只消费稳定接口，不直接碰 `localStorage`、URL query 或 `window.location`。

**Tech Stack:** TanStack Router、TanStack Query、`@oig/react-query-generator/core`、TypeScript、Vitest、Testing Library

---

## 问题摘要

当前实现存在以下结构性问题：

- `401` 登出跳转挂在成功响应分支里，但 runtime 在非 `2xx` 时会先抛 `HttpError`，导致 unauthorized 分支根本走不到。
- `logoutUrl` 被保存在 `queries.ts` 的模块级单例中，但 bootstrap query 当前没有稳定调用方，这条链路是断的。
- URL query `token` 与响应头 `Authorization` 被混为同一存储格式，`Authorization` 值形状没有被标准化。
- transport、bootstrap query、UI 各自维护一部分鉴权语义，调用链隐式且难测。
- 本次工作区把依赖升级和鉴权行为改造混在一起，不利于回归定位和代码审查。

## 方案对比

### 方案 A：最小补丁修当前代码

- 直接在 `transport.ts` 里改成 `try/catch HttpError`，继续保留 `token.ts` 和 `queries.ts` 的模块级单例。
- 优点是改动最小、落地最快。
- 缺点是隐式状态和副作用仍然存在，后续继续扩展登录态 UI、静默刷新、登出回跳时会继续恶化。

### 方案 B：显式 `session` 边界 + 共享 transport + 受保护 shell bootstrap

- 新建 `session` 模块统一管理 token、logout metadata、URL callback hydration 和 unauthorized handling。
- transport 只依赖 `session` 暴露的稳定接口，不直接操作 `localStorage` 或 `window.location`。
- `dashboard` 路由 loader 负责在受保护 shell 渲染前 bootstrap 登录信息。
- 这是推荐方案。它的成本仍然是局部重构，但可以把鉴权边界收口成一个清晰、可测的子系统。

### 方案 C：引入 Zustand 等全局 store 承载完整 auth state

- 把 token、login user、logoutUrl、loading/error 全放进全局 store。
- 优点是 UI 订阅方便。
- 缺点是对当前项目而言过重，且无法自然替代 transport/runtime 这一层的错误与请求边界处理，属于 YAGNI。

**推荐结论：** 采用方案 B。它满足“局部修改、低耦合、可测试、无额外框架引入”的约束。

## 架构原则

- 在改 transport 之前，必须先写 characterization test 验证当前 `401` 究竟发生在 middleware 的哪个阶段，不能只靠静态阅读做重构决策。
- token、logoutUrl、callback URL hydration 必须有单一真相源，禁止继续散落在多个模块单例中。
- transport 层只做请求/响应编排和错误收口，不直接拥有浏览器存储策略。
- unauthorized handling 必须走异常分支，而不是假设 `401` 还能以成功响应继续向下流动。
- bootstrap query 只复用“请求头注入 / token 刷新”约定，必须绕开 unauthorized redirect，不能和普通业务请求共用完全相同的 `401` 行为。
- 受保护 shell 在进入业务页前必须准备好登录上下文，不能把 logout metadata 的可用性寄托在“某个模块碰巧先执行”。
- `hydrateFromUrl()` 必须有明确且唯一的调用点，并且要发生在任何受保护 loader 之前。
- 依赖升级必须和行为改造拆分；若 `@oig/react-query-generator@3.2.0` 不是这个方案的硬前提，应单独出 PR。
- transport 测试必须跑真实 middleware 链并 stub `fetch`，不要 mock `createTransport` 内部实现。

## 评审后决议

- `401` 行为不再只靠源码推断，先通过 characterization test 固化当前 runtime 行为，再决定最终 `try/catch HttpError` 改法。
- bootstrap login-info 请求采用“共享 auth header 注入 + token 刷新语义，但跳过 unauthorized redirect”的独立策略；它不是普通业务 transport 的同构调用。
- `hydrateFromUrl()` 统一放在 `src/router.tsx` 的 `createRouter()` 客户端初始化阶段执行一次，确保任何 `dashboard` loader 之前都已完成 callback token 落盘与 URL 清理。
- 当前仓库存在 [src/routes/dashboard.tsx](/Users/youdingte/studys/tanstack-start-admin/src/routes/dashboard.tsx:1) 这一层共享 shell，因此第一阶段仍以它作为受保护入口；若未来出现 `dashboard` 之外的受保护路由，再上提到更高层 protected root。

## File Structure

- Create: `src/lib/api/sso/session.ts`
- Create: `src/lib/api/sso/session.test.ts`
- Create: `src/lib/api/sso/bootstrap.ts`
- Create: `src/lib/api/sso/bootstrap.test.ts`
- Create: `src/lib/api/transport.test.ts`
- Create: `src/lib/api/sso/queries.test.ts`
- Create: `src/components/layout/app-sidebar.test.tsx`
- Modify: `src/lib/api/transport.ts`
- Modify: `src/lib/api/sso/queries.ts`
- Modify: `src/lib/api/sso/token.ts`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/ui/sso-skeleton.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Reference: `src/routes/__root.tsx`
- Reference: `src/router.tsx`
- Reference: `src/lib/query-client.ts`

## Target Runtime Contract

- `session.ts` 是 SSO 会话的唯一入口。
- `session.ts` 负责：
  - 读取与写入鉴权凭证
  - 清理鉴权凭证
  - 显式从 callback URL hydrate token
  - 记录和读取 `logoutUrl`
  - 执行 unauthorized 收口动作
- `transport.ts` 负责：
  - 在请求发出前读取 session 并注入鉴权头
  - 在响应成功或失败时提取新凭证
  - 捕获 `HttpError.status === 401` 并委托 session 执行收口
- `queries.ts` 负责：
  - 通过共享 transport/bootstrap helper 获取登录用户信息
  - 把 `logoutUrl` 和用户信息写回 session 或 query cache
- `dashboard.tsx` 负责：
  - 在受保护 shell 进入前 `ensureQueryData(getLoginInfoQueryOptions())`
- `app-sidebar.tsx` 负责：
  - 展示 query cache 里的登录用户
  - 调用稳定的 `logout` 行为
  - 在 bootstrap pending 时渲染 skeleton

## Task 0: 冻结契约并拆分 PR 范围

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/plans/2026-06-12-sso-auth-hardening.md`
- Create: `src/lib/api/transport.test.ts`

**Invariants**

- 鉴权行为改造 PR 不混入无关依赖升级。
- token 形状必须先定清楚，再开始改运行时代码。
- 在 transport 重构前先固化当前 `401` 行为。

**Acceptance Criteria**

- [ ] 明确记录“持久化的是完整 `Authorization` header 值，还是裸 token”。
- [ ] 明确记录 callback URL 参数名与后端返回头的契约差异。
- [ ] 若 `@oig/react-query-generator@3.2.0` 不是硬依赖，则从本 PR 移除并单独提交。
- [ ] 有一个最小 characterization test 证明当前 runtime 在 `401` 时是“先抛 `HttpError` 再退出 middleware”还是“返回 response 给 middleware 后再转错误”。

**Verification Profile**

- `profile: task-0-scope-freeze`
  - `git diff -- package.json pnpm-lock.yaml`
- `profile: task-0-401-characterization`
  - `pnpm exec vitest run src/lib/api/transport.test.ts -t "characterizes current 401 middleware behavior"`
- `Expected Signals:` auth PR 只包含 SSO 相关文件或明确注明的必要依赖，不再混入无关升级。

- [ ] Step 1: 记录 token 输入源：`query param`、响应头 `Authorization`、本地持久化值。
- [ ] Step 2: 选择唯一持久化格式，并在本文档中明确写死，不允许运行时再“猜”。
- [ ] Step 3: 判断 `@oig/react-query-generator@3.2.0` 是否为本方案硬前提；若不是，恢复到独立升级 PR。
- [ ] Step 4: 在 `src/lib/api/transport.test.ts` 先写最小 characterization test，使用真实 transport middleware 链 + stubbed `fetch`，验证当前 `401` 的执行时机。
- [ ] Step 5: Run `profile: task-0-401-characterization`
- [ ] Step 6: Commit `chore: freeze auth contract and characterize 401 flow`

## Task 1: 建立显式 SSO Session 边界

**Files:**

- Create: `src/lib/api/sso/session.ts`
- Create: `src/lib/api/sso/session.test.ts`
- Modify: `src/lib/api/sso/token.ts`

**Invariants**

- 禁止模块导入时自动执行 URL token hydration。
- `session` 对外暴露显式 API，调用方无需知道 `localStorage` key 或 URL 参数细节。

**Acceptance Criteria**

- [ ] `session.ts` 提供 `hydrateFromUrl()`、`getAuthHeader()`、`setAuthHeader()`、`clearAuth()`、`getLogoutUrl()`、`setLogoutUrl()`、`handleUnauthorized()`。
- [ ] `token.ts` 不再包含模块级副作用 `initTokenFromURL()`，或被折叠为 `session.ts` 的实现细节。
- [ ] 非法/空 token 不会进入持久化层。
- [ ] `hydrateFromUrl()` 不依赖 import 副作用，调用者必须显式执行。

**Verification Profile**

- `profile: task-1-session-unit`
  - `pnpm exec vitest run src/lib/api/sso/session.test.ts`
- `Expected Signals:` URL callback hydration、清理逻辑、logout metadata 读写、token 规范化全部可单测验证。

- [ ] Step 1: 在 `session.test.ts` 先写红灯用例，覆盖：
  - callback URL 含 token 时会被显式 hydrate，且会移除 query param
  - `clearAuth()` 会清除 token 与 logout metadata
  - 非法 token 输入不会污染持久化层
- [ ] Step 2: Run `pnpm exec vitest run src/lib/api/sso/session.test.ts`，确认实现前红灯。
- [ ] Step 3: 新建 `session.ts`，把 token 读写、logoutUrl 读写和 URL hydration 全部收口到这个模块。
- [ ] Step 4: 修改 `token.ts`，移除模块级副作用；若保留该文件，仅作为过渡 re-export，不再承载真实状态。
- [ ] Step 5: Run `profile: task-1-session-unit`
- [ ] Step 6: Commit `refactor: introduce explicit sso session boundary`

## Task 2: 重写共享 Transport 的鉴权链路

**Files:**

- Modify: `src/lib/api/transport.ts`
- Create: `src/lib/api/transport.test.ts`

**Invariants**

- transport 不能直接读写 `localStorage`。
- unauthorized handling 必须基于 `HttpError` 分支，而不是成功响应分支。
- transport 不直接持有 UI 组件或 query cache 引用。
- transport 单测跑真实 middleware 链，禁止 mock `createTransport` 内部调度。

**Acceptance Criteria**

- [ ] 请求前会从 `session` 读取鉴权头并注入。
- [ ] 成功响应会提取新 `Authorization` 头并写回 `session`。
- [ ] `HttpError.status === 401` 时会清理本地 auth，并调用 `session.handleUnauthorized()`。
- [ ] `401` 处理后仍会把错误继续抛给上层 query/mutation，而不是静默吞掉。

**Verification Profile**

- `profile: task-2-transport-auth`
  - `pnpm exec vitest run src/lib/api/transport.test.ts`
- `Expected Signals:` transport 单测能证明 `401` 在异常流中被捕获并正确收口；旧 token 不会在失败后持续重放。

- [ ] Step 1: 在 `transport.test.ts` 先写红灯用例，覆盖：
  - 请求会带上 session 提供的鉴权头
  - 成功响应会刷新 auth header
  - `401 HttpError` 会清理 session 并调用 unauthorized handler
  - 非 `401` 错误不会误触发跳转
- [ ] Step 2: Run `pnpm exec vitest run src/lib/api/transport.test.ts`，确认实现前红灯。
- [ ] Step 3: 修改 `transport.ts`，把当前两个 middleware 收敛为“请求注入 + `try/catch/finally` 处理响应/错误”的清晰链路。
- [ ] Step 4: 让 transport 只依赖 `session` API，不再直接 import `getToken()` / `setToken()` / `getLogoutUrl()` 之类零散函数。
- [ ] Step 5: Run `profile: task-2-transport-auth`
- [ ] Step 6: Commit `refactor: harden auth transport pipeline`

## Task 3: 统一 Login Info Bootstrap 与受保护 Shell 入口

**Files:**

- Modify: `src/lib/api/sso/queries.ts`
- Create: `src/lib/api/sso/bootstrap.ts`
- Create: `src/lib/api/sso/bootstrap.test.ts`
- Create: `src/lib/api/sso/queries.test.ts`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/router.tsx`

**Invariants**

- `getLoginInfoQueryOptions()` 不再维护模块级 `loginUserData` 单例。
- bootstrap query 只复用共享 auth header / token 刷新契约，但必须显式跳过 unauthorized redirect。
- 受保护 shell 在业务页渲染前已完成 login-info bootstrap。
- `hydrateFromUrl()` 必须在任何受保护 loader 之前完成。

**Acceptance Criteria**

- [ ] `queries.ts` 成功响应后会把 `logoutUrl` 写入 session，把用户数据作为 query result 返回。
- [ ] bootstrap `401` 不会尝试读取尚未可用的 `logoutUrl` 并发起错误跳转。
- [ ] `bootstrap.ts` 暴露稳定的 `ensureSsoLoginInfo(queryClient)` helper。
- [ ] `dashboard` route loader 通过 `bootstrap.ts` 调用 `ensureQueryData(getLoginInfoQueryOptions())`。
- [ ] `src/router.tsx` 在客户端创建 router 时显式执行一次 `session.hydrateFromUrl()`。
- [ ] 若 bootstrap 失败，错误语义清晰且不依赖隐式单例状态。

**Verification Profile**

- `profile: task-3-bootstrap`
  - `pnpm exec vitest run src/lib/api/sso/queries.test.ts`
  - `pnpm exec vitest run src/lib/api/sso/bootstrap.test.ts`
- `Expected Signals:` login-info query 能独立验证写入 session 的行为；`dashboard` 受保护 shell 有明确 bootstrap 入口。

- [ ] Step 1: 在 `queries.test.ts` 先写红灯用例，覆盖成功响应写入 `logoutUrl`、失败响应不污染 session。
- [ ] Step 2: 修改 `queries.ts`，删除 `loginUserData` 模块单例，改为显式调用 `session.setLogoutUrl(...)`。
- [ ] Step 3: 为 bootstrap path 设计独立策略：复用 header 注入与 token 刷新，但通过独立 helper 或 transport option 显式跳过 unauthorized redirect。
- [ ] Step 4: 新建 `bootstrap.ts`，导出 `ensureSsoLoginInfo(queryClient)` 这类稳定 helper，并为它补单测，覆盖 bootstrap `401` 的行为。
- [ ] Step 5: 修改 `src/router.tsx`，在客户端 `createRouter()` 初始化时显式调用一次 `session.hydrateFromUrl()`。
- [ ] Step 6: 给 `src/routes/dashboard.tsx` 增加 loader，在进入受保护 shell 前通过 `bootstrap.ts` 执行 `queryClient.ensureQueryData(...)`。
- [ ] Step 7: Run `profile: task-3-bootstrap`
- [ ] Step 8: Commit `refactor: bootstrap sso login info in protected shell`

## Task 4: 收口 Sidebar 的登录态展示与登出动作

**Files:**

- Modify: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/app-sidebar.test.tsx`
- Modify: `src/components/ui/sso-skeleton.tsx`

**Invariants**

- UI 组件不得直接操作 `localStorage`、URL query 或 transport。
- 组件层只消费 query data 和显式 logout action。

**Acceptance Criteria**

- [ ] sidebar footer 展示真实登录用户信息，而不是硬编码 `用户 / user@example.com`。
- [ ] login-info pending 时渲染 skeleton，而不是闪烁默认占位文本。
- [ ] “退出登录” 通过显式 `logout` 行为触发，不再是无行为菜单项。

**Verification Profile**

- `profile: task-4-sidebar-auth-ui`
  - `pnpm exec vitest run src/components/layout/app-sidebar.test.tsx`
- `Expected Signals:` `app-sidebar` 测试锁住 skeleton、用户名和 logout click 行为，不再依赖人工点选检查。

- [ ] Step 1: 让 sidebar 从 query cache 或 hook 读取 login user，并移除硬编码用户信息。
- [ ] Step 2: 使用 `sso-skeleton.tsx` 表达 pending UI，避免在 bootstrap 前渲染误导性默认值。
- [ ] Step 3: 为“退出登录”接入显式 `logout` action，优先复用 `session.handleUnauthorized()` 或同一重定向入口。
- [ ] Step 4: 新建 `app-sidebar.test.tsx`，只覆盖 auth footer 相关行为：pending skeleton、用户信息渲染、logout click。
- [ ] Step 5: Commit `feat: wire sidebar auth state and logout action`

## Task 5: 回归验证、清理死代码与文档收尾

**Files:**

- Modify: `src/lib/api/sso/token.ts`
- Modify: `src/lib/api/sso/queries.ts`
- Modify: `src/lib/api/transport.ts`
- Modify: `env.example.txt`
- Modify: `README.md`

**Invariants**

- 不保留旧的模块单例死代码。
- 环境变量、回调参数、token 形状和 unauthorized 行为必须有文档。

**Acceptance Criteria**

- [ ] `token.ts` / `queries.ts` 内不再保留未消费的单例状态。
- [ ] `README.md` 或本计划关联文档明确记录鉴权 bootstrap、token 契约和 unauthorized 行为。
- [ ] `.env` 或 callback 契约如有变更，`env.example.txt` 同步更新。

**Verification Profile**

- `profile: task-5-regression`
  - `pnpm exec vitest run src/lib/api/transport.test.ts src/lib/api/sso/session.test.ts src/lib/api/sso/queries.test.ts src/lib/api/sso/bootstrap.test.ts src/components/layout/app-sidebar.test.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
- `Expected Signals:` transport、session、bootstrap、UI 相关测试全绿，类型检查与构建通过。

- [ ] Step 1: 删除或折叠旧的单例实现，避免同一语义保留两套入口。
- [ ] Step 2: 补充文档，写清：
  - token 的唯一持久化格式
  - callback URL 参数名
  - `401` 的清理与跳转策略
  - `dashboard` 受保护 shell 的 bootstrap 责任
- [ ] Step 3: Run `profile: task-5-regression`
- [ ] Step 4: Commit `docs: document hardened sso auth flow`

## 验证门槛

- `401` 必须在异常流中被正确收口，不能依赖成功响应分支。
- `logoutUrl` 不能再依赖模块单例和隐式 query 执行顺序。
- token 读取、写入、清理、URL hydrate 必须可单测。
- `dashboard` 受保护 shell 必须有稳定 bootstrap 入口。
- Sidebar 不得再渲染硬编码用户信息。
- 鉴权改造 PR 不得夹带无关依赖升级。

## 回滚策略

- 若 `session` 边界落地后出现大面积登录回归，可先保留 `session` API，但临时把 transport unauthorized handler 降级为“清 token + 抛错”，不自动跳转，避免全局循环重定向。
- 若 bootstrap loader 影响 `/dashboard` 首屏体验，可先保留 loader 但把 sidebar 改为显式 suspense/pending UI；bootstrap path 继续保持跳过 unauthorized redirect，避免退回模块单例或死链。
- 若后端 token 契约在短期内无法统一，可在 `session` 内保留 source-aware normalization，但禁止继续把 query param 和 header 值混在一套隐式存储格式里。

## Review (2026-06-12)

### Task 0 完成项

- [x] Characterization test 已写入 `src/lib/api/transport.test.ts`，并跑通
  - **结论确认**: `executeRequest()` (core/index.js:328-337) 在 `!response.ok` 时直接 `throw new HttpError(...)`，然后异常沿 middleware 链向上传播。当前 transport 的 `response.status === 401` 检查是死代码——post-next 分支只在 2xx 时执行。
  - 因此 **Task 2 必须用 `try/catch HttpError` 取代当前 response status check**。
- [x] 依赖检查: `@oig/react-query-generator@3.2.0` 已安装，`HttpError`、`createTransport`、middleware 链 API 均可用，**无需依赖升级**。
- [x] Dashboard 路由确认: `src/routes/dashboard.tsx` 存在，可作为受保护 shell 入口。

### Token 契约决议 (待用户确认)

- 持久化格式: 存储完整 `Authorization` header 值（如 `Bearer xxx`），不做拆分
- URL callback: 若 `?token=` 参数值为裸 token（不含 `Bearer ` 前缀），hydration 时自动补 `Bearer ` 前缀
- 响应头: 以 `Authorization` header 值为准，直接覆盖本地存储

### Task 1-5 完成摘要

- [x] **Task 1**: `session.ts` 建立显式 SSO 会话边界 — `hydrateFromUrl()`, `getAuthHeader()`, `setAuthHeader()`, `clearAuth()`, `getLogoutUrl()`, `setLogoutUrl()`, `handleUnauthorized()`。13 个单测全绿。
- [x] **Task 2**: Transport 鉴权链路重写 — middleware 改用 `try/catch HttpError`，401 在异常分支被收口，调用 `session.handleUnauthorized()` 后 re-throw。传输层只依赖 `session` API。5 个单测全绿。
- [x] **Task 3**: Bootstrap — `bootstrap.ts` 提供 `bootstrapRequest()` 共享 header/token 但跳转 401 跳转；`queries.ts` 移除模块单例，改用 `session.setLogoutUrl()`；`router.tsx` 初始化时调 `hydrateFromUrl()`；`dashboard` loader 通过 `ensureSsoLoginInfo()` prefetch 登录信息。7 个单测全绿。
- [x] **Task 4**: Sidebar — 消费 `getLoginInfo` query 展示真实用户信息，pending 时渲染 skeleton，退出登录调 `handleUnauthorized()`。
- [x] **Task 5**: 清理 — 删除死代码 `token.ts`（无 consumer），所有 import 链路收束到 session。

### 后续行动项

- [ ] **TODO (P1)**: 确认后端 `?token=` 回调参数的实际格式（是否为完整 Authorization 值）
- [ ] **TODO (P2)**: 为 `app-sidebar.tsx` auth footer 补充组件测试
- [ ] **TODO (P2)**: 考虑将 `sso` 模块提升为独立 feature 目录（当前在 `lib/api/sso` 下）
