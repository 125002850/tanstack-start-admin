# 前端本地 IAM 架构改造 PRD

## 1. 文档信息

| 项目 | 内容 |
|------|------|
| 文档状态 | Draft |
| 编写日期 | 2026-07-08 |
| 目标仓库 | `tanstack-start-admin` |
| 配套后端 | `java-demo` `main` 分支本地 IAM |
| 后端 PRD | `/Users/youdingte/studys/java-demo/docs/prd/2026-07-08-main-local-iam-prd.md` |
| 前端形态 | 纯 SPA 管理后台，TanStack Router + React Query + Shadcn UI |

## 2. 背景

当前前端仓库已经具备后台基础框架能力：

- TanStack Router 文件路由。
- Dashboard shell、侧边栏、顶部栏、工作区页签、命令面板。
- route metadata 派生导航、面包屑和 workspace tab。
- SSO 会话边界：`src/lib/api/sso/session.ts`、`bootstrap.ts`、`queries.ts`。
- SSO `menuData` 驱动的可选菜单权限过滤。
- 字典管理、导出中心和 DataTable DSL 查询能力。
- 统一 API transport 和 OpenAPI 生成客户端。

后端 `main` 分支将改造为本地 IAM 版管理后台底座，不再依赖 SSO。前端需要同步从“SSO 重定向登录 + `menuData` 菜单过滤”改为“本地登录 + JWT/refresh token + RBAC 菜单/按钮权限 + 受保护路由”。

## 3. 产品目标

1. 建立商用级本地 IAM 前端架构，完整承接后端登录、员工、部门、角色、菜单、权限、日志能力。
2. 将现有 SSO 会话模型替换为本地 IAM 会话模型，但保留现有 transport、路由元数据、导航派生、DataTable 和页面基础设施优势。
3. 支持后端接口级权限校验的前端配套能力：路由权限、菜单权限、按钮权限、403 页面、未登录跳转。
4. 提供稳定的 token 刷新、并发请求收口、401/403 处理、强制改密和登出体验。
5. 输出前端可落地的页面范围、API contract、状态管理、缓存策略和验收标准。

## 4. 非目标

本期不做以下能力：

- 不做 SSO、OAuth2、OIDC、CAS、LDAP 或第三方登录。
- 不做多租户前端切换。
- 不做手机号、邮箱、扫码、MFA 或验证码登录。若后端后续启用验证码，本 PRD 只预留扩展点。
- 不做权限策略编辑器、ABAC 规则编辑器或审批流。
- 不做登录设备管理页。refresh token 表有设备信息，但第一版不提供前端会话管理。
- 不做操作日志实时推送。
- 不做前端单独的数据权限计算。数据权限由后端执行，前端只展示角色数据范围配置。
- 不做 Cookie session 或服务端 CSRF token。第一版使用 Bearer token。
- 不把按钮隐藏作为安全边界。前端按钮权限只改善体验，最终授权以后端 403 为准。

## 5. 现状判断

### 5.1 可复用资产

| 能力 | 现状 | 改造策略 |
|------|------|----------|
| API transport | `src/lib/api/transport.ts` 统一注入 auth header 和处理 401 | 保留 middleware 形态，替换为 IAM session |
| Session 边界 | `src/lib/api/sso/session.ts` 管 token、logoutUrl、URL hydrate | 重命名/迁移为 `src/lib/api/iam/session.ts` |
| Protected shell | `/dashboard` route loader 调用 `ensureSsoLoginInfo` | 改为 `ensureIamMe` |
| 导航派生 | route metadata -> `buildNavGroupsFromRoutes` | 保留，补充 menuKey/menuCode 匹配与 requiredPermission 校验 |
| 菜单过滤 | `useFilteredNavGroups` 基于 SSO `menuData.code` | 改为基于 IAM menu tree / permission set |
| 错误页 | `DefaultErrorPage` 支持 403/404/500 | 保留，用于 401 跳转、403 展示、500 重试 |
| DataTable | 支持 DSL 查询、列持久化、分页 | 复用到员工、角色、日志列表 |
| OpenAPI 客户端 | `@oig/react-query-generator` | 继续通过后端 OpenAPI 生成 typed API |

### 5.2 必须替换的 SSO 假设

以下 SSO 假设在 `main` 本地 IAM 版中必须退出：

- URL query `token` 登录回调。
- `/api/getLoginInfo`。
- `sso_token`、`sso_logout_url`、`sso_user_id` localStorage key。
- `VITE_APP_SSO_CLIENT_ID`、`VITE_APP_SSO_SERVICE_ID`、`VITE_APP_SSO_SERVICE_CODE` 作为默认必需配置。
- 请求头 `X-User-Id` 由前端注入。
- SSO `menuData` 类型和 `hiddenFlag` 菜单语义。
- SSO logoutUrl 跳转。

### 5.3 命名约束

本地 IAM 统一使用 `iam` 和 `staff` 术语：

- API 模块：`src/lib/api/iam/*`。
- 查询 key：`['iam', ...]`。
- 员工页面、类型、表格字段使用 `staff`。
- 不再用 `user` 表示本地员工，除非是 UI 文案中的“当前用户”。
- SSO 代码如果保留，只能作为历史兼容或分支特性，不能参与 main 默认运行链路。

### 5.4 分阶段范围

P0 只做本地 IAM 的运行时闭环：

- 登录、refresh、logout、`auth/me`。
- accessToken 内存态、refreshToken 本地持久化与多 tab 同步。
- `/dashboard` 登录守卫、semi-protected 强制改密页、页面权限守卫。
- 动态菜单、按钮权限、401/403 处理。
- SSO 默认链路清理与 sanity check。

P1 做 IAM 管理页：

- 员工、部门、角色、菜单。
- 角色菜单权限、数据权限配置。
- 相关 DataTable、表单、树选择和确认操作。

P2 做增强能力：

- 登录日志、操作日志、个人中心。
- workspace tabs 权限变更后的强一致失权处理。
- 更高安全等级下的 httpOnly refresh cookie 方案评估。

P0 接受 workspace 最终一致：前端不实时关闭 tab、不实时替换 403、不做 `permissionFingerprint` 驱动的 keepalive 清理；安全边界由后端每次接口权限校验和 403 保证。

## 6. 总体架构决策

### 6.1 会话架构

采用本地 IAM session 边界，替换 SSO session。

建议文件：

```text
src/lib/api/iam/
├── session.ts
├── session.test.ts
├── transport-auth.ts
├── transport-auth.test.ts
├── queries.ts
├── queries.test.ts
├── permissions.ts
├── permissions.test.ts
└── types.ts
```

职责：

- `session.ts`：token 读写、当前会话清理、登录后写入、登出、刷新锁。
- `transport-auth.ts`：为 API transport 注入 `Authorization: Bearer <accessToken>`，处理 401/403。
- `queries.ts`：封装 `auth/me`、当前用户 query options、权限 query key。
- `permissions.ts`：权限码、菜单过滤、按钮权限判断。
- `types.ts`：前端稳定 IAM 类型，隔离后端 DTO 细节。

### 6.2 Token 存储策略

后端第一版采用 Bearer token，非 Cookie session。前端采用以下策略：

| Token | 存储 | 用途 |
|------|------|------|
| accessToken | 仅内存 | API 请求 |
| refreshToken | localStorage | 页面刷新后换取新 token |
| tokenExpiresAt | localStorage | 刷新时机判断 |
| tokenVersion | localStorage | 多标签页防旧响应覆盖 |

规则：

1. 所有 token 存储只允许通过 `iam/session.ts`。
2. localStorage key 使用 `iam_refresh_token`、`iam_access_token_expires_at`、`iam_token_version`。
3. 退出登录、401 refresh 失败、员工被禁用或删除时必须清理所有 IAM token 和当前用户 query cache。
4. token 不写入 URL，不从 URL hydrate。
5. token 不写入日志、toast、错误页、操作日志参数。
6. 如果后端未来改为 httpOnly refresh cookie，前端 PRD 需要重新修订 CSRF 和刷新策略。
7. accessToken 不持久化到 localStorage；页面刷新后必须先用 refreshToken 换取新的 accessToken，再进入受保护页面。
8. 如果实现阶段因后端限制必须持久化 accessToken，必须补充启动过期清理、CSP 验收和安全例外说明，不得静默降级。
9. accessToken TTL 以后端为准，建议 15 到 30 分钟；前端不得假设 2 小时长会话。
10. `accessToken` 内存 + `refreshToken` localStorage 是 SPA Bearer token 折中方案；若安全等级提升，优先迁移到后端 httpOnly refresh cookie。

### 6.3 Refresh 策略

前端必须支持静默刷新。

规则：

1. 普通 API 请求前，如果 accessToken 即将过期，先 refresh，再发起原请求。
2. 普通 API 请求返回 401 时，尝试一次 refresh 并重放原请求。
3. 同一时间只允许一个 refresh 请求在飞行，其他请求等待同一个 Promise。
4. refresh 成功后，更新 accessToken、refreshToken、expiresAt，并恢复等待队列。
5. refresh 失败后，清理会话并跳转 `/auth/sign-in`，携带 `redirect`。
6. login、refresh、logout 接口不参与 401 自动重试，避免递归。
7. refresh token 重放或过期时展示“登录已过期，请重新登录”。
8. refresh 请求必须通过 `skipAuthRefresh` 标记或 raw fetch client 绕开普通 401 refresh middleware。
9. 每个 request context 最多重放一次，使用 `_retry=true` 或等效标记防止无限循环。
10. 只自动重放 JSON/可重放请求；文件上传、流式 body、FormData 大文件请求遇到 401 时不自动重放，提示用户重试。
11. mutation 请求只有在请求体可重放且后端幂等语义明确时才允许自动重放；高风险 mutation 默认不自动重放。

### 6.4 多标签页会话同步

必须支持同浏览器多标签页的 token 与登出同步。

事件通道：

- 首选 `BroadcastChannel('iam-session')`。
- 不支持 BroadcastChannel 时回退到 `storage` event。

事件类型：

- `refresh:start`
- `refresh:success`
- `refresh:failure`
- `logout`

规则：

1. 任一标签页开始 refresh 时广播 `refresh:start`，其他标签页避免并发 refresh。
2. refresh 成功时广播 `refresh:success`，携带新的 refreshToken、expiresAt、tokenVersion 或 issuedAt。
3. refresh 失败时广播 `refresh:failure`，所有标签页清理 session 并跳转登录页。
4. logout 时广播 `logout`，所有标签页清理 session、query cache 和 workspace 敏感状态。
5. 写入 token 时必须比较 tokenVersion 或 issuedAt，旧响应不得覆盖新 token。
6. 多标签页场景必须有单元测试或 Playwright smoke 覆盖。

### 6.5 Query Cache 策略

关键 query key：

```ts
['iam', 'me']
['iam', 'menus']
['iam', 'permissions']
['iam', 'staff', ...]
['iam', 'dept', ...]
['iam', 'role', ...]
['iam', 'menu', ...]
['iam', 'log', 'login', ...]
['iam', 'log', 'operation', ...]
```

规则：

1. `auth/me` 是当前登录态唯一事实源。
2. `auth/me` 默认 `staleTime` 不超过 60 秒。
3. 登录、刷新、改密、权限变更后需要 invalidate `['iam', 'me']`。
4. 员工角色分配、角色菜单分配、菜单状态变更后，必须 invalidate 菜单和权限相关 query。
5. 退出登录必须 `queryClient.clear()` 或精确清理 IAM/业务敏感 query。
6. 不允许组件直接读写 localStorage 来判断登录态。

## 7. 路由与权限设计

### 7.1 路由分层

目标路由：

```text
/auth
  /sign-in
  /password/change-required

/dashboard
  /overview
  /iam/staff
  /iam/dept
  /iam/role
  /iam/menu
  /iam/log/login
  /iam/log/operation
  /account/profile
  /account/password
  /system-management/dictionaries
  /system-management/export-center
```

规则：

1. `/auth/sign-in` 是公开路由。
2. `/auth/password/change-required` 是 semi-protected 路由，只允许存在有效 token 且 `me.mustChangePassword = true` 的员工访问。
3. 刷新强制改密页时，如果内存中没有 accessToken 但存在 refreshToken，必须先 refresh，再拉取 `auth/me` 判断是否允许进入改密页。
4. `/dashboard` 是受保护 shell，loader 负责 `ensureIamMe(queryClient)`。
5. `/dashboard` 子路由默认继承登录保护，但页面权限必须由统一路由权限守卫检查。
6. 每个业务路由通过 route metadata 声明菜单、页面、权限和 workspace 信息。
7. 未登录进入 dashboard 子路由时，跳转 `/auth/sign-in?redirect=<current>`.
8. 已登录访问 `/auth/sign-in` 时，跳转 dashboard 默认首页。
9. `mustChangePassword = true` 时，只允许访问强制改密、退出登录、当前用户信息相关路由。
10. `redirect` 只能是同源内部路径，禁止外链、协议相对 URL 和跨 origin URL。

### 7.2 统一路由权限守卫

子路由权限检查必须集中在统一 helper 中，不得散落到页面组件。

建议接口：

```ts
ensureDashboardAccess({
  queryClient,
  location,
  routeMeta
}: {
  queryClient: QueryClient;
  location: ParsedLocation;
  routeMeta: AppRouteStaticData;
}): Promise<IamMe>
```

职责：

1. 确保当前员工已登录，未登录抛 `AuthRequiredError`。
2. 确保 `auth/me` 已加载。
3. 如果 `mustChangePassword = true` 且目标不是允许名单，抛 `PasswordChangeRequiredError`。
4. 根据 `routeMeta.requiredPermission` / `requiredAnyPermissions` 判断页面权限。
5. 无页面权限时抛 `PermissionDeniedError`。
6. 返回当前 `IamMe` 供 loader 或页面使用。

落地方式：

1. 优先通过 dashboard 子路由 `beforeLoad` / `loader` 或统一 route factory 调用。
2. 禁止在页面组件内部自行决定是否渲染 403 作为唯一权限保护。
3. 404、401、403、强制改密必须使用不同 error class，路由错误边界据此渲染或跳转。
4. `AuthRequiredError` 跳转登录页。
5. `PermissionDeniedError` 渲染 403。
6. `PasswordChangeRequiredError` 跳转 `/auth/password/change-required`。

路由类型：

```text
/auth/sign-in                  public
/auth/password/change-required semi-protected
/dashboard/**                  protected + permission guarded
```

### 7.3 Route Metadata 扩展

现有 `defineRouteMeta()` 需要扩展权限字段。

建议模型：

```ts
interface AppNavStaticData {
  visible: boolean;
  group: AppNavGroupKey;
  order: number;
  menuKey?: string;
  kind?: 'container';
  parentId?: string;
  icon?: keyof typeof Icons;
  shortcut?: [string, string];
  linkable?: boolean;
}

interface AppRouteStaticData {
  label: string;
  title?: string;
  nav?: AppNavStaticData;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
  page?: AppPageData;
  workspace?: AppRouteWorkspaceData;
}
```

规则：

1. `nav.menuKey` 是前端稳定导航 key，只用于前端 route 与后端 menu tree 的菜单匹配。
2. `nav.menuKey` 必须对应后端菜单节点的稳定 `menuCode`，如果后端最终只返回 `routePath`，则实现层需要先归一化为 `menuKey` 再进入导航过滤。
3. `requiredPermission` / `requiredAnyPermissions` 只用于页面访问权限，不参与菜单树匹配。
4. 禁止再引入 `backendMenuCode`、`nav.permissionCode` 等第三套 key。
5. 没有权限字段的 dashboard 路由默认只要求登录，但商用业务页面必须声明权限字段，禁止新增裸 dashboard 页面。
6. 新增 IAM 一级导航分组 `iam`，显示名称为“权限管理”，排序位于 `overview` 之后、`systemManagement` 之前；账号相关页面继续归入 `account`。

### 7.4 动态菜单渲染

设计原则：保留前端 route metadata 作为路由注册表，后端 menu tree 作为授权数据源。

数据流：

```text
auth/me
  -> menuTree + permissionCodes
  -> buildAuthorizedNavGroups(routesById, iamMenus, permissions)
  -> AppSidebar / KBar / Workspace tabs
```

规则：

1. 前端只渲染本地已注册的路由，后端菜单不能注入任意未知 route。
2. 后端菜单树控制“用户可见哪些 route metadata 菜单”。
3. 新增统一 `buildAuthorizedNavGroups(routesById, iamMenus, permissions)`，在一个函数内完成 route 匹配、权限过滤、后端菜单排序和未知菜单诊断。
4. 后端禁用或隐藏菜单不进入侧边栏、KBar、workspace 新开入口。
5. P0 已打开的 workspace tab 不因远端权限变化主动关闭；后续接口返回 403 时再展示无权限反馈。
6. 菜单过滤函数必须有单元测试覆盖目录、菜单、按钮、隐藏节点和未知节点。
7. 未知后端菜单只记录诊断信息，不渲染、不动态注册路由。
8. Sidebar、KBar、workspace 入口必须复用同一个授权导航结果，禁止各自实现过滤和排序。

### 7.5 Workspace 权限失效处理

P0 采用最终一致策略，P2 再实现强一致失权。

P0 规则：

1. 不实时扫描已打开 tab 是否失权。
2. 不因远端权限变更主动关闭 tab。
3. 不因远端权限变更主动替换 tab 为 403。
4. 旧 UI 继续展示不构成授权，任何接口调用以后端 403 为准。
5. mutation 返回 403 时不清 session，只 toast 或在当前页面展示无权限状态。
6. logout、refresh 失败、不可恢复 401 时，必须清 token、query cache 和 workspace 本地状态。
7. 本端执行角色/菜单/权限相关 mutation 成功后，必须 invalidate `iam/me` 和导航权限数据。

P2 强一致增强：

1. `auth/me` 响应包含 `permissionFingerprint` 或 `version`，用于识别权限快照变化。
2. 如果后端没有显式字段，前端可以用 permissions + menu keys 计算本地 fingerprint，但实现前应优先推动后端补字段。
3. fingerprint 变化时，重新计算所有已打开 tab 的授权状态。
4. 失权 tab 关闭或替换为 403 内容。
5. fingerprint 变化时 reset workspace page registry 中失权页面 descriptor。
6. fingerprint 变化时 invalidate 失权页面相关 query，避免 keepalive 页面继续持有敏感数据。
7. 当前激活 tab 失权时展示 403，并提供返回工作台操作。

### 7.6 按钮权限

新增权限判断能力：

```ts
usePermission(code: string): boolean
useAnyPermission(codes: string[]): boolean
useAllPermissions(codes: string[]): boolean
<PermissionGate code='iam:staff:create'>...</PermissionGate>
```

规则：

1. 按钮、批量操作、行操作必须通过 `PermissionGate` 或权限 hook 控制可见性/可用性。
2. 删除、重置密码、分配角色等高风险操作必须同时依赖后端 403。
3. 前端隐藏按钮不代表安全授权。
4. 没有权限时优先隐藏操作；对用户已经进入的页面级操作，可禁用并显示 tooltip。
5. 权限码以后端为源，前端集中常量化，禁止散落魔法字符串。
6. 必须有测试校验 route metadata、PermissionGate 和权限常量不漂移。

## 8. API Contract

### 8.1 认证接口

前端需要对接：

| 接口 | 前端行为 |
|------|----------|
| `POST /api/iam/auth/login` | 登录，保存 token，拉取 me，跳转 redirect |
| `POST /api/iam/auth/refresh` | 静默刷新，更新 token |
| `POST /api/iam/auth/logout` | 调用后清理本地 session，跳转登录页 |
| `POST /api/iam/auth/me` | 获取当前员工、角色、权限、菜单树、mustChangePassword |
| `POST /api/iam/auth/password/change` | 修改本人密码，保存后端返回的新 token |

登录响应建议前端稳定类型：

```ts
interface IamLoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  tokenType: 'Bearer';
  staff: IamCurrentStaff;
  mustChangePassword: boolean;
}
```

`me` 响应建议前端稳定类型：

```ts
interface IamMe {
  staff: IamCurrentStaff;
  dept?: IamDeptSummary;
  roles: IamRoleSummary[];
  permissions: string[];
  menus: IamMenuNode[];
  dataScope: IamDataScopeSummary;
  mustChangePassword: boolean;
  permissionFingerprint?: string;
}
```

前端稳定类型是 adapter contract：

1. 页面、组件、hooks 只消费 `src/lib/api/iam/types.ts` 中的稳定 IAM 类型。
2. generated DTO 只允许在 API adapter 层出现。
3. adapter 负责字段归一化、枚举归一化和缺省值处理。
4. 后端 OpenAPI 字段变更时，优先修改 adapter 和测试，不把 generated DTO 扩散到页面。

认证 DTO 硬约束：

```ts
interface IamLoginReq {
  username: string;
  password: string;
}

interface IamRefreshReq {
  refreshToken: string;
}

interface IamRefreshRsp {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  tokenType: 'Bearer';
}

interface IamLogoutReq {
  refreshToken?: string;
}

interface IamPasswordChangeReq {
  oldPassword: string;
  newPassword: string;
}

interface IamPasswordChangeRsp extends IamRefreshRsp {
  mustChangePassword: false;
}
```

枚举硬约束：

```ts
type EnableStatus = 'ENABLED' | 'DISABLED';
type MenuType = 'DIR' | 'MENU' | 'BUTTON';
type DataScopeType = 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';
type LoginLogResult = 'SUCCESS' | 'FAIL';
type OperationLogResult = 'SUCCESS' | 'FAIL';
```

菜单节点硬约束：

```ts
interface IamMenuNode {
  menuId: number | string;
  parentId?: number | string | null;
  menuCode: string;
  menuName: string;
  menuType: MenuType;
  routePath?: string | null;
  componentPath?: string | null;
  icon?: string | null;
  sortOrder: number;
  hidden: boolean;
  cached: boolean;
  status: EnableStatus;
  permissionCode?: string | null;
  children?: IamMenuNode[];
}
```

分页与 DSL 约束：

1. IAM 分页接口统一使用 `pageNo`、`pageSize`、`condition`、`sort`。
2. `condition` 复用现有 DSL 节点结构。
3. `sort` 字段必须使用后端场景白名单，前端列 ID 需要映射到后端字段 key。
4. 员工、角色、登录日志、操作日志列表必须声明各自允许筛选字段和排序字段。
5. 前端不得把任意表格 column id 原样传给后端，必须通过 column DSL 配置映射。

### 8.2 管理接口

前端页面按后端 OpenAPI 生成客户端对接：

- 员工：`staff/page`、`detail`、`create`、`update`、`delete`、`status/update`、`password/reset`、`roles/assign`。
- 部门：`dept/tree`、`detail`、`create`、`update`、`delete`、`status/update`。
- 角色：`role/page`、`detail`、`create`、`update`、`delete`、`status/update`、`menus/assign`、`data-scope/assign`。
- 菜单：`menu/tree`、`detail`、`create`、`update`、`delete`、`status/update`。
- 登录日志：`log/login/page`、`detail`。
- 操作日志：`log/operation/page`、`detail`。

规则：

1. 所有表格分页优先复用 `useDslDataTable()`。
2. 树结构选择优先复用统一 TreeSelect/Combobox 组件；如无现成组件，本期新增通用受控树选择组件。
3. 删除、禁用、重置密码必须使用确认弹窗。
4. 批量操作如果后端第一版不支持，前端不先做批量 UI。

### 8.3 响应与错误

后端统一响应：

```json
{ "code": 200, "msg": "ok", "data": {} }
```

前端规则：

1. code 不是 200 时按业务错误处理。
2. HTTP 401：未登录、accessToken 不可用或 refresh 不可恢复；前端尝试 refresh，refresh 失败跳登录。
3. HTTP 403：已登录但无权限、强制改密限制或数据权限不允许；前端展示 403 页面或 toast，不能无限跳登录。
4. HTTP 400/422：展示表单错误或 toast。
5. HTTP 429：展示限流提示，不自动重试 mutation。
6. 5xx：展示重试或错误页。

## 9. 页面需求

### 9.1 登录页

路径：`/auth/sign-in`

需求：

1. 使用用户名和密码登录。
2. 支持 `redirect` 参数，登录成功后跳回原访问路径。
3. 登录按钮有 loading、失败提示和防重复提交。
4. 密码输入支持显示/隐藏。
5. 登录失败使用统一错误提示，不展示系统堆栈。
6. 已登录访问登录页自动跳转 dashboard。
7. 移除 Sign Up、GitHub 登录和示例邮箱文案。
8. 视觉上作为管理后台登录，不保留模板化营销文案。

### 9.2 强制改密页

路径：`/auth/password/change-required`

需求：

1. 当 `mustChangePassword = true` 时，进入 dashboard 前强制跳转此页。
2. 表单字段：旧密码、新密码、确认新密码。
3. 密码规则展示与校验：8-32 位，大小写、数字、特殊字符。
4. 修改成功后保存后端返回的新 token，刷新 `iam/me`，跳转 dashboard。
5. 支持退出登录。

### 9.3 个人中心

路径：

- `/dashboard/account/profile`
- `/dashboard/account/password`

需求：

1. 展示当前员工基础资料、部门、角色、数据权限摘要。
2. 支持本人修改密码。
3. 头像上传如果后端可用，复用现有文件上传能力。
4. 不允许本人编辑角色、状态、部门等管理字段。

### 9.4 员工管理

路径：`/dashboard/iam/staff`

需求：

1. DataTable 分页列表。
2. 筛选：员工工号、用户名、员工姓名、部门、状态、创建时间。
3. 操作：新增、编辑、删除、启用/禁用、重置密码、分配角色、查看详情。
4. 新增/编辑使用 Sheet 或 Dialog，符合当前表单规范。
5. 部门选择使用树选择。
6. 分配角色支持多选、角色状态展示。
7. 删除 `SUPER_ADMIN` 员工时，如果后端拒绝，前端展示明确业务错误。
8. 行操作按权限码控制。

### 9.5 部门管理

路径：`/dashboard/iam/dept`

需求：

1. 左侧或主区展示部门树。
2. 支持新增同级、新增子级、编辑、删除、启用/禁用。
3. 禁用部门在员工选择中不可选。
4. 删除存在子部门或员工的部门时展示后端错误。
5. 部门排序可编辑。

### 9.6 角色管理

路径：`/dashboard/iam/role`

需求：

1. DataTable 分页列表。
2. 支持新增、编辑、删除、启用/禁用。
3. 支持分配菜单权限：树形菜单 + 勾选按钮权限。
4. 支持配置数据权限：全部、本部门及子部门、本部门、仅本人、自定义部门。
5. 自定义部门使用部门树多选。
6. `SUPER_ADMIN` 角色不可删除、不可禁用、不可收窄数据权限，前端 UI 应禁用对应操作并显示原因。

### 9.7 菜单管理

路径：`/dashboard/iam/menu`

需求：

1. 树表展示目录、菜单、按钮。
2. 支持新增目录、菜单、按钮。
3. 支持编辑、删除、启用/禁用、排序。
4. 菜单字段：名称、类型、父级、路由路径、组件路径、图标、排序、隐藏、缓存、权限标识。
5. 按钮字段：名称、权限标识、排序、状态。
6. 权限标识唯一性错误需要清晰展示。
7. 菜单图标从 `Icons` 统一选择，禁止自由输入任意图标 import。

### 9.8 登录日志

路径：`/dashboard/iam/log/login`

需求：

1. DataTable 分页列表。
2. 筛选：用户名、员工姓名、结果、IP、时间范围。
3. 展示登录成功、失败、refresh、logout 等安全事件。
4. 详情抽屉展示 User-Agent、失败原因、时间等。
5. 不展示 token 明文。

### 9.9 操作日志

路径：`/dashboard/iam/log/operation`

需求：

1. DataTable 分页列表。
2. 筛选：操作人、模块、动作、成功/失败、路径、时间范围。
3. 详情抽屉展示请求参数摘要、响应摘要、错误信息、耗时、IP、User-Agent。
4. 敏感字段必须已经由后端脱敏；前端仍不得提供复制 token/password 的便捷入口。

## 10. 交互与异常场景

### 10.1 401

规则：

1. 普通请求 401 先尝试 refresh。
2. refresh 成功后重放原请求。
3. refresh 失败后清理 session，跳转 `/auth/sign-in?redirect=<current>`.
4. 如果当前就在登录页，不重复跳转。
5. 多个并发 401 只触发一次 refresh。

### 10.2 403

规则：

1. 路由 loader 发现无页面权限时展示 403。
2. mutation 返回 403 时展示 toast，并保留当前页面。
3. 普通业务接口返回 403 时不登出，不清 token，不清全局 query cache。
4. 403 不触发 logout。
5. P0 不要求远端权限变更后主动扫描并关闭已打开 workspace tab。
6. 如果当前页面下一次查询或 mutation 返回 403，页面可以展示局部无权限状态或整页 403。

### 10.3 权限变更

触发点：

- 员工角色分配。
- 角色菜单分配。
- 角色数据权限分配。
- 菜单状态变更。
- 当前员工改密或状态变化。

前端处理：

1. 相关 mutation 成功后 invalidate `iam/me`、导航、权限 query。
2. 如果变更影响当前登录员工，刷新后重新计算侧边栏、KBar、按钮权限。
3. P0 不做远端权限变更的实时推送和 workspace 强一致清理。
4. 当前页面后续接口返回 403 时展示无权限反馈。
5. P2 再通过 `permissionFingerprint` / `version` 做 tab 授权重算、失权 tab 关闭或替换 403、失权 query 清理。

### 10.4 网络与弱网

规则：

1. 查询请求沿用 React Query retry 策略。
2. mutation 默认不重试。
3. 登录、refresh、改密失败不自动重试。
4. 表格查询显示骨架或空状态，不闪烁整页。
5. 保存类操作必须防重复提交。

## 11. 安全要求

1. 不在 URL 中传递 token。
2. 不在日志、toast、错误页、localStorage 调试输出中展示 token 或密码。
3. token 读写只允许通过 `iam/session.ts`。
4. 所有受保护页面都必须经过 `/dashboard` loader 或等效 protected route。
5. 前端权限只做体验控制，后端 403 是最终授权结果。
6. 删除、禁用、重置密码、分配权限等高风险操作必须确认。
7. 登录表单不暴露“用户名不存在”与“密码错误”的区别。
8. 前端不实现 CSRF token，因为本期不使用 Cookie session。
9. localStorage 存 token 的 XSS 风险通过 CSP、依赖治理和禁止 dangerouslySetInnerHTML 扩散来降低；若安全等级提升，应改为后端 httpOnly refresh cookie 方案。

## 12. 前端模块结构建议

```text
src/features/iam/
├── auth/
│   ├── components/
│   └── schemas/
├── staff/
│   ├── components/
│   ├── columns.tsx
│   └── schemas.ts
├── dept/
├── role/
├── menu/
└── logs/

src/lib/api/iam/
src/lib/permissions/
src/hooks/use-permission.ts
src/components/permission-gate.tsx
```

约束：

1. 页面组件不直接调用 `fetch`。
2. 页面组件优先使用生成的 query/mutation options。
3. 表单 schema 与 DTO 转换在 feature 内部集中维护。
4. 权限码常量集中维护，例如 `src/constants/permissions.ts`。
5. 新增 dashboard route 必须写 route metadata、权限字段和测试。

## 13. 迁移范围

### 13.1 需要废弃或迁移

- `src/lib/api/sso/*` 默认运行链路。
- `ensureSsoLoginInfo`。
- `LoginUserData.menuData`。
- SSO 环境变量。
- URL token hydrate。
- SSO logoutUrl 跳转。
- `X-User-Id` 前端注入。

运行时代码清理验收：

```bash
rg -n "src/lib/api/sso|X-User-Id|/api/getLoginInfo|sso_token|sso_logout_url|VITE_APP_SSO" src
```

预期：

- `main` 默认运行时代码不得命中上述 SSO 语义。
- 历史文档、测试迁移说明或 `feature/sso` 专用代码允许保留，但必须明确不进入 `main` 默认链路。
- `hydrateFromUrl` 不得在本地 IAM 默认启动链路中执行。
- transport 不得注入 SSO service/client headers。

### 13.2 需要保留并改造

- `src/lib/api/transport.ts`。
- `src/routes/dashboard.tsx` protected shell。
- `src/hooks/use-nav.ts`。
- `src/lib/router/nav-permissions.ts`。
- `src/lib/router/app-route-meta.ts`。
- `AppSidebar` 用户信息、导航、logout 入口。
- `DefaultErrorPage`。
- `DataTable` 和 DSL 查询。
- OpenAPI codegen 机制。

## 14. 验收标准

### 14.1 功能验收

1. 未登录访问 `/dashboard/**` 跳转登录页并保留 redirect。
2. 登录成功保存 token，拉取 `auth/me`，进入 redirect 或默认首页。
3. accessToken 过期时可静默 refresh，并重放原请求。
4. refresh 失败后清理登录态并跳转登录页。
5. 403 不触发登出，展示无权限页面或操作提示。
6. `mustChangePassword = true` 时强制进入改密页。
7. 改密成功后保存新 token 并恢复正常访问。
8. 侧边栏、KBar、workspace 新建入口按当前菜单权限过滤。
9. 按钮和行操作按权限码显示或禁用。
10. 员工、部门、角色、菜单、登录日志、操作日志页面可用。
11. 权限变更后当前登录员工的菜单和按钮权限能刷新。
12. 退出登录调用后端 logout，清理 token 和 query cache。

### 14.2 工程验收

1. `pnpm typecheck` 通过。
2. `pnpm lint` 通过。
3. `pnpm test:unit` 通过。
4. `pnpm check` 通过。
5. IAM session 单测覆盖 token 存储、refresh 锁、logout、401。
6. transport 单测覆盖请求头注入、refresh 成功重放、refresh 失败跳登录、403 不登出。
7. 路由 loader 单测覆盖未登录、已登录、强制改密、无权限。
8. 权限过滤单测覆盖菜单树、权限码、隐藏节点、未知后端菜单。
9. 页面测试覆盖员工、部门、角色、菜单、日志的关键交互。
10. Playwright smoke 覆盖登录、侧边栏权限、403、退出登录。
11. `format:check` 对触碰文件通过；如果全仓已有格式债，必须列明与本次无关。
12. SSO 残留 sanity check 通过。

### 14.3 Playwright 竞争场景

商用级 smoke 必须覆盖以下场景：

1. accessToken 过期后触发多个并发 API 请求，只发生一次 refresh。
2. refresh 成功后所有等待请求使用新 accessToken 继续完成。
3. 两个浏览器 tab 中任一 tab logout，另一个 tab 同步清理 session 并跳转登录页。
4. 当前员工角色被管理员移除后，下一次业务接口返回 403，前端不清 session，只展示无权限反馈。
5. `mustChangePassword = true` 员工不能进入任意 dashboard 子路由。
6. 强制改密成功后使用新 token 进入 redirect 目标页。
7. mutation 返回 403 时不清 session，只展示无权限反馈。
8. 文件上传或不可重放请求遇到 401 时不自动重放，提示用户重新提交。
9. refresh 失败不会进入无限跳转或无限请求循环。
10. P2 再增加 workspace 失权 tab 关闭/替换 403 和敏感 query 清理 smoke。

## 15. 商用级风险清单

1. refresh 并发未收口会导致 token 轮换后旧 token 重放失败。
2. 401 和 403 混用会造成用户被错误登出。
3. 只隐藏菜单但不保护路由，会导致用户手输 URL 访问失权页面。
4. 只做前端按钮权限会形成虚假安全感，必须以后端 403 为准。
5. 后端菜单动态注入未知 route 会绕过前端路由注册表，必须禁止。
6. token localStorage 存储存在 XSS 风险，必须限制 token 访问面。
7. P0 接受 workspace tab 在远端权限变更后的 UI 最终一致；安全边界依赖后端实时接口权限校验，P2 再做权限快照监听和强一致清理。
8. 权限码散落字符串会导致审计困难，必须集中常量化。
9. 登录态 query cache 未清理会导致退出后残留敏感数据。
10. 前后端术语混用 `user` / `staff` 会造成 DTO 和页面语义漂移。

## 16. 开放问题

1. 后端登录接口是否返回 `accessTokenExpiresAt` 还是 `expiresIn`。
2. refreshToken 是否每次 refresh 都轮换并返回新值。
3. `auth/me` 的菜单树字段是否包含前端 route path、component path、permissionCode 和 icon。
4. 菜单排序以后端为准还是前端 route metadata 为准。
5. 创建员工时初始密码由管理员输入还是后端生成一次性返回。
6. 后端是否提供批量删除、批量启停；若没有，前端不做批量 UI。
7. 操作日志参数摘要的最大长度和字段结构。

## 17. 与后端 PRD 的一致性要求

前端实现前必须确认：

1. 后端 OpenAPI 已包含 `/api/iam/**`。
2. `R.ok` / `R.fail` 响应模型被 codegen 正确识别。
3. 401、403、429、500 的 HTTP 状态与业务 code 约定稳定。
4. `auth/me` 是权限快照事实源。
5. `staff` 命名在后端 DTO、前端类型和页面文案中一致。
6. `SUPER_ADMIN` 角色不可删除、不可禁用、不可收窄数据权限的错误码稳定。
