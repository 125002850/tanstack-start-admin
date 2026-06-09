# OpenAPI React Query API Client 设计

## 文档定位

这份文档是 **design spec**，负责定义基于 OpenAPI 3.0 文档生成 React Query API client 的架构边界、运行时约束和长期维护策略；它不是 implementation plan。

配套的可执行计划将在设计评审通过后单独编写。

这样分离的目的很直接：

- spec 负责说明“为什么这样设计、哪些约束必须成立”
- plan 负责说明“按什么顺序改哪些文件、如何验证和回滚”

## 背景

当前仓库已经形成稳定的数据访问模式：

- feature 内按 `service.ts -> queries.ts / mutations.ts -> route loader / component` 分层
- TanStack Router loader 使用 `queryClient.ensureQueryData(...)` 做预取
- 页面查询使用 `useSuspenseQuery(...)`
- 表单和写操作使用 `useMutation(...)`

当前本地 OpenAPI 文档来源于 `http://localhost:8080/v3/api-docs`，文档版本为 OpenAPI `3.0.1`。当前样本规模不大，但这次设计目标不是“只解决当前小文档”，而是为以下两类场景提供同一套通用方案：

- 单体后端导出一份巨石 OpenAPI 文档，需要按领域选择性生成多个 client
- 多个后端或多个 OpenAPI 文档，各自生成独立 client，并在前端统一消费

## 目标

这套方案必须同时满足以下目标：

- 基于 OpenAPI 3.0 文档生成可直接用于 TanStack React Query 的 client
- 生成范围不仅包含类型和原子请求函数，还包含 `queryOptions` 与 `mutationOptions`
- 保持与当前仓库既有模式兼容，不强迫页面层改用另一套数据获取架构
- 默认走本应用 `/api/**` 的 BFF 代理层，不让页面直接请求后端服务
- 统一把后端响应体 `{ code, msg, data }` 解包为 `data`
- 默认业务成功条件为 `HTTP 2xx + body.code === 200`
- 支持按领域选择性生成，而不是每次必须对整份文档全量生成
- 支持多个 OpenAPI 文档生成多个 client
- 生成目录必须可被重新覆盖，且不承载人工业务逻辑
- 方案在当前小文档可落地，在大型巨石项目中也不会因为文件膨胀和冲突失控

## 非目标

本次设计 **不** 包含以下范围：

- 不在本轮直接开发 codegen 脚本或生成器适配代码
- 不要求一次性迁移当前仓库所有手写 `service.ts`
- 不反向改造后端 OpenAPI 命名规范或响应体结构
- 不让业务页面直接消费生成器内部目录结构
- 不允许在 `generated/` 内手写业务逻辑
- 不把“生成产物是否提交远程仓库”简单固定为唯一策略；设计上需要同时支持小项目和巨石项目的不同治理策略

## 关键约束

### 1. React Query 生成粒度

用户已确认生成范围到 `queryOptions / mutationOptions`，而不是只停留在原子请求函数。

这意味着生成产物必须天然兼容：

- `queryClient.ensureQueryData(...)`
- `useSuspenseQuery(...)`
- `useMutation(...)`
- `queryClient.invalidateQueries(...)`

### 2. 业务成功判定

后端统一响应包裹体为：

```json
{
  "code": 200,
  "msg": "ok",
  "data": {}
}
```

前端统一成功判定为：

- HTTP 状态为 `2xx`
- 且响应体 `code === 200`

否则一律视为失败。

### 3. Query / Mutation 不能按 HTTP Method 粗暴推断

当前文档中多个“读语义接口”使用 `POST`，例如：

- 列表查询
- 按条件查询
- 临时地址获取

因此：

- `GET != Query` 不是强约束
- `POST != Mutation` 也不是强约束
- 生成时必须以“业务语义”而不是 HTTP method 划分 `query` 与 `mutation`

### 4. 生成必须支持“单文档切域”和“多文档多 client”

这套方案必须同时支持：

- 一个巨石 OpenAPI 文档中按 `tag` / `path` / `operationId` 选择性生成多个领域 client
- 多个 OpenAPI 文档分别生成多个 client

## 总体架构

我建议把 API client 架构拆成 5 层：

1. `spec source`
2. `codegen manifest`
3. `generated client`
4. `runtime core`
5. `domain adapter`

职责边界如下：

| 层级 | 作用 | 是否允许手写业务逻辑 |
|------|------|------------------|
| `spec source` | 存放本地 OpenAPI 快照或受控输入源 | 否 |
| `codegen manifest` | 描述每个 client 的输入源、筛选规则、输出位置、命名策略 | 是 |
| `generated client` | 生成 types、raw sdk、queryOptions、mutationOptions | 否 |
| `runtime core` | 统一 transport、响应解包、错误模型、multipart 处理、query key 标准化 | 是 |
| `domain adapter` | 处理生成层之外的领域定制、缓存联动、兼容旧页面导出 | 是 |

这 5 层的核心原则是：

- 契约变化来自 OpenAPI
- 生成边界来自 manifest
- 运行时一致性来自 core
- 业务差异收敛在 adapter

## 目录结构

建议目录结构如下：

```text
openapi/
  specs/
    java-demo.json
    iam.json
    billing.json
  snapshots/
    java-demo.2026-06-04.json

tools/
  codegen/
    config/
      clients.ts
    scripts/
      generate.ts
      fetch-spec.ts

src/lib/api/
  core/
    transport.ts
    response.ts
    errors.ts
    body.ts
    query-key.ts
  clients/
    dict/
      generated/
        types.ts
        sdk.ts
        queries.ts
        mutations.ts
        index.ts
      adapters/
        index.ts
      index.ts
    file-storage/
      generated/
      adapters/
      index.ts
```

### 目录边界约束

- `src/lib/api/core/**` 为手写公共基座
- `src/lib/api/clients/<domain>/generated/**` 为只读生成层
- `src/lib/api/clients/<domain>/adapters/**` 为生成层外的领域定制
- `src/lib/api/clients/<domain>/index.ts` 为业务方稳定入口
- `openapi/specs/**` 为当前受控 spec 输入
- `openapi/snapshots/**` 为可选的锁定快照，用于审计和回放

业务代码不应直接从 `generated/*.ts` 导入，而应只依赖 `clients/<domain>/index.ts` 暴露的稳定 API。

## Codegen 工具选型

这份 spec 不能只描述“我们想生成什么”，还必须约束“哪个生成器最接近这份设计”。否则 manifest 字段会脱离工具能力，最终在 plan 阶段返工。

基于当前已查证的官方文档，候选工具矩阵如下：

| 工具 | 已查证能力 | 与本设计的匹配度 | 结论 |
|------|-----------|----------------|------|
| `orval` | 支持 `react-query` client、`split / tags-split` 输出、operation override、`useSuspenseQuery`、`useInfinite`、mutation invalidation、custom mutator | 与“多领域拆分 + React Query 产物 + operation override”最接近 | 当前首选 |
| `@hey-api/openapi-ts` | 提供 `@tanstack/react-query` plugin，支持 `queryOptions`、mutation meta、`infiniteQueryKeys`、自定义 client 参数 | React Query 产物能力足够，但多 client / 多输出编排更依赖外层 orchestrator；这是基于当前文档示例的推断 | 观察项，不作为首选 |
| `openapi-generator` | 支持 `typescript-fetch` 等生成器，允许自定义模板目录 | 定制能力最强，但维护成本最高，React Query 产物需模板层自建 | 兜底方案 |
| `openapi-typescript` | 官方文档覆盖类型生成与 `openapi-fetch`，未覆盖 React Query `queryOptions / mutationOptions` 产物 | 可作为类型层工具，但不满足本设计的生成粒度 | 不作为主方案 |

这里有一个重要边界：

- 上表中的“匹配度”只基于当前官方文档所展示的能力
- 对 `@hey-api/openapi-ts` 的“多 client / 多输出能力需要外层编排”属于基于当前文档示例的工程推断，不是其官方文档的显式否定

### 工具选择结论

当前建议顺序是：

1. 以 `orval` 作为默认优先评估对象
2. 若 `orval` 在 manifest 语义映射上出现硬缺口，再评估 `openapi-generator + 自定义模板`
3. `@hey-api/openapi-ts` 继续观察，但不作为本轮主基座
4. `openapi-typescript` 只可作为类型层辅助手段，不可作为这套 React Query client 架构的主生成器

### Manifest 到 Orval 的映射示例

这段示例的目的不是提前锁死最终配置文件，而是暴露 manifest 设计与生成器配置之间的映射面。

假设 manifest entry 为：

```ts
const dictClient: ClientManifest = {
  name: 'dict',
  source: {
    kind: 'file',
    target: 'openapi/specs/java-demo.json'
  },
  includeTags: ['全局字典'],
  outputDir: 'src/lib/api/clients/dict/generated',
  queryKeyPrefix: ['dict'],
  responseProfile: {
    wrapper: 'data',
    successCode: 200
  },
  transportProfile: {
    viaBff: true,
    basePath: '/api'
  },
  overrides: {
    listGlobalTypes: {
      kind: 'query',
      suspense: true
    },
    createGlobalType: {
      kind: 'mutation',
      invalidate: [{ target: ['dict', 'global-types', 'list'], scope: 'prefix' }]
    }
  }
}
```

映射到 Orval 时，配置形态大致会是：

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  dict: {
    input: {
      target: './openapi/specs/java-demo.json'
    },
    output: {
      target: './src/lib/api/clients/dict/generated/sdk.ts',
      schemas: './src/lib/api/clients/dict/generated/model',
      mode: 'tags-split',
      client: 'react-query',
      override: {
        query: {
          useQuery: true,
          useSuspenseQuery: true,
          useMutation: true,
          shouldExportQueryKey: true,
          mutationInvalidates: [
            {
              onMutations: ['createGlobalType'],
              invalidates: ['listGlobalTypes']
            }
          ]
        },
        operations: {
          listGlobalTypes: {
            query: {
              useSuspenseQuery: true
            }
          }
        }
      }
    }
  }
});
```

这段映射也直接说明了一个设计事实：

- manifest 可以比 Orval config 更“语义化”
- 真正执行时需要一层 translator，把 manifest 翻译成生成器能消费的配置
- 这层 translator 是 codegen orchestration 的职责，不应污染业务目录

## Manifest 驱动的生成编排

这套方案不应把生成逻辑写死为“读取一份 spec，吐出一份总 client”。正确的做法是维护一份中心化 manifest。

manifest 的唯一真相源建议固定为：

- `tools/codegen/config/clients.ts`

运行时代码如果需要读取少量静态 client 元数据，应由 codegen 从该 manifest 派生生成只读 runtime 文件，而不是再维护第二份手写 manifest。

每个 client entry 至少声明以下字段：

- `name`
- `source`
- `includeTags`
- `includePaths`
- `includeOperationIds`
- `excludeTags`
- `excludePaths`
- `outputDir`
- `queryKeyPrefix`
- `transportProfile`
- `responseProfile`
- `overrides`

其中 `overrides` 必须支持对单个 operation 显式声明语义，例如：

- `kind: query | mutation`
- `invalidate`
- `multipart`
- `responseMode`

### Manifest 规范接口

manifest 不能只停留在字段清单，必须形成受 TypeScript 和 schema 双重约束的规范接口。

建议最小接口如下：

```ts
type QueryKind = 'query' | 'mutation';
type ResponseMode = 'json' | 'blob' | 'text';
type PaginationStyle = 'page' | 'offset' | 'cursor';
type InvalidationScope = 'exact' | 'prefix';
type InvalidationMode = 'invalidate' | 'reset';

interface SpecSource {
  kind: 'file' | 'url';
  target: string;
  snapshotTarget?: string;
}

interface TransportProfile {
  viaBff: boolean;
  basePath: string;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

interface ResponseProfile {
  wrapper: 'data' | 'raw';
  successCode: number;
  codePath?: string;
  messagePath?: string;
  dataPath?: string;
}

interface InvalidateRule {
  target: readonly string[];
  scope?: InvalidationScope;
  mode?: InvalidationMode;
  fromParams?: readonly string[];
}

interface PaginationConfig {
  style: PaginationStyle;
  pageParam?: string;
  pageSizeParam?: string;
  cursorParam?: string;
  nextCursorPath?: string;
  hasMorePath?: string;
}

interface OperationOverride {
  kind?: QueryKind;
  alias?: string;
  multipart?: boolean;
  responseMode?: ResponseMode;
  invalidate?: readonly InvalidateRule[];
  pagination?: PaginationConfig;
  suspense?: boolean;
  infinite?: boolean;
  excludeParamsFromQueryKey?: readonly string[];
}

interface ClientManifest {
  name: string;
  source: SpecSource;
  includeTags?: readonly string[];
  includePaths?: readonly string[];
  includeOperationIds?: readonly string[];
  excludeTags?: readonly string[];
  excludePaths?: readonly string[];
  excludeOperationIds?: readonly string[];
  outputDir: string;
  queryKeyPrefix: readonly [string, ...string[]];
  queryClientImport?: {
    from: string;
    name: string;
  };
  transportProfile: TransportProfile;
  responseProfile: ResponseProfile;
  overrides?: Record<string, OperationOverride>;
  recommendedMaxOperations?: number;
}
```

### Manifest 校验要求

除了 TypeScript 接口，本设计要求 manifest 还具备独立 schema 校验能力。原因很直接：

- TypeScript 只能约束写配置的人
- schema 校验可以约束运行时代码、CI、脚本输入和未来非 TS 工具链

manifest 校验必须至少覆盖：

- 字段拼写
- 枚举取值合法性
- `queryKeyPrefix` 非空
- `recommendedMaxOperations` 最小值
- `infinite === true` 时分页字段完整性
- `responseProfile.wrapper === 'data'` 时 `successCode` 必填

### Manifest 设计原则

1. 显式声明优先于自动推断
2. 支持一个 spec 对应多个 client
3. 支持多个 spec 对应多个 client
4. 支持按 client 单独生成
5. 支持全量重建所有 client

### 推荐命令模型

- `pnpm codegen`：生成全部 client
- `pnpm codegen --client dict`：仅生成单个 client
- `pnpm openapi:fetch --client dict`：拉取或刷新某个 client 关联 spec
- `pnpm codegen:check`：校验 generated 与当前 spec + manifest 是否一致

## 生成产物契约

每个领域 client 的生成产物建议拆成以下几类文件：

### 1. `types.ts`

生成所有 DTO、分页对象、响应模型、上传请求模型等纯类型定义。

该文件只承载类型，不承载运行时逻辑。

### 2. `sdk.ts`

生成最原子的请求函数。

建议区分两类导出：

- `xxxRaw(...)`：拿到未经业务解包的 transport 返回值，仅供底层桥接场景使用
- `xxx(...)`：返回统一解包后的 `data`

默认业务消费层只使用解包后的导出。

### 3. `queries.ts`

为“读语义 operation”生成 `queryOptions(...)` 工厂函数。

生成物必须适配：

- `useSuspenseQuery(...)`
- `useQuery(...)`
- `queryClient.ensureQueryData(...)`
- `queryClient.prefetchQuery(...)`

生成函数必须保留统一错误类型，而不是退化成裸 `Error`。推荐导出形态为：

- `xxxQueryKey(...)`
- `xxxQueryOptions(...)`
- 可选的 `xxxInfiniteQueryOptions(...)`

### 3.1 Infinite Query 规则

Infinite Query 不应默认对所有分页接口生成，而应满足以下条件后才生成：

- manifest 对 operation 显式声明 `pagination`
- 且 operation override 显式声明 `infinite: true`

这样做的原因是：

- 当前仓库主要消费的是页码式表格列表，不应为所有分页接口默认引入 infinite 心智负担
- `page`、`offset`、`cursor` 的 next-page 语义不同，不能靠猜

建议规则：

- `page` / `offset` / `cursor` 都允许生成 infinite helper
- `getNextPageParam` 的 derive 逻辑优先来自 manifest
- 生成器没有能力表达的复杂逻辑，由 adapter 补齐

### 3.2 条件查询与 Suspense 边界

generated 层只生成基础 `queryOptions(...)`，不负责统一抽象 `enabled` 与 suspense 的差异。

规则固定为：

- `useSuspenseQuery(...)` 路径：在进入 hook 前由路由或组件先做参数 guard
- `useQuery(...)` 路径：消费层使用 spread 方式覆盖 `enabled`

示例：

```ts
const options = getPetByIdQueryOptions({ path: { petId } });

useQuery({
  ...options,
  enabled: Boolean(petId)
});
```

generated 层不额外包一层“同时兼容 suspense 与 enabled”的统一 hook。

### 4. `mutations.ts`

为“写语义 operation”生成 `mutationOptions(...)` 工厂函数。

mutation 生成层只负责：

- 提供稳定 `mutationFn`
- 接受 manifest 声明的基础失效规则

mutation 不应在生成层内隐式耦合复杂跨域缓存更新。

### 4.1 Optimistic Update 边界

Optimistic update 不是 generated 层默认职责。

本设计明确要求：

- generated 层保证 `mutationFn` 入参和返回类型完整
- optimistic update helper 由 `adapter` 或 `core` 的组合工具提供
- 需要领域级回滚逻辑时，只能在 generated 外实现

这样做是为了避免：

- 把领域状态耦合进 codegen
- 把回滚协议写死到每个 mutation 模板
- 因 optimistic 策略差异导致 generated 不可重建

### 5. `index.ts`

作为 generated 层的汇总导出。

### 6. 外层 `clients/<domain>/index.ts`

作为业务稳定入口，负责：

- 屏蔽生成器内部文件名变化
- 暴露 adapter 包装后的最终出口
- 为旧页面或旧 service 风格保留兼容表面

## 运行时基座设计

运行时基座应集中于 `src/lib/api/core/**`，不允许各个 client 自己复制 fetch 封装。

### `transport.ts`

职责：

- 默认请求本应用 `/api/**`
- 注入统一 headers
- 注入 `credentials`
- 透传 `AbortSignal`
- 管理超时与取消
- 兼容 `application/json` 与 `multipart/form-data`

这层只负责 HTTP 传输，不负责解释业务成功失败。

### `response.ts`

职责：

- 识别 JSON 响应包裹体
- 校验 `body.code === 200`
- 成功时返回 `body.data`
- 失败时抛业务错误

这层负责把后端协议映射为前端稳定返回值。

### `errors.ts`

建议至少定义两类错误：

- `HttpError`
- `BizError`

可选再扩展：

- `TimeoutError`
- `DecodeError`
- `NetworkError`

要求每类错误都保留足够上下文，例如：

- status
- code
- msg
- request url
- request method
- response body

这样 React Query error boundary、toast 和页面级错误提示才有统一处理基础。

推荐再定义统一错误联合类型：

```ts
type ApiClientError =
  | HttpError
  | BizError
  | TimeoutError
  | DecodeError
  | NetworkError;
```

generated 的 `queryOptions(...)` 与 `mutationOptions(...)` 必须把这个联合类型传播到消费层，而不是退化为 `Error`。

### `body.ts`

职责：

- JSON body 序列化
- `FormData` 构建
- 上传请求的字段编码

上传场景不应在生成层每个函数里手写 `new FormData()`。

### `query-key.ts`

职责：

- 提供标准化 query key 生成辅助
- 提供参数归一化能力

这层是大型项目避免缓存键失控的关键基座。

## 成功响应与错误模型

默认约束如下：

- HTTP 非 `2xx`：抛 `HttpError`
- HTTP `2xx` 但响应不是预期 JSON：抛 `DecodeError`
- HTTP `2xx` 且 JSON 中 `code !== 200`：抛 `BizError`
- HTTP `2xx` 且 `code === 200`：返回 `data`

业务层不应再看到原始 `{ code, msg, data }` 包裹体，除非显式使用 `xxxRaw(...)` 低层导出。

这样带来的直接收益是：

- `queryFn` 返回值简单稳定
- 页面不需要每次手写 `if (res.code !== 200)`
- 错误展示、日志和统计口径统一

## Query Key 设计

不建议直接把 URL 字符串作为 query key，也不建议不经处理把整个 request body 原样塞进 query key。

推荐规则：

- 第一段固定为领域前缀，例如 `dict`、`file-storage`
- 第二段固定为资源语义，例如 `global-types`、`global-items`
- 第三段固定为操作语义，例如 `list`、`by-type`、`temp-url`
- 末段为归一化后的参数对象

示例：

```ts
['dict', 'global-types', 'list', normalizedReq]
['dict', 'global-items', 'by-type', normalizedReq]
['file-storage', 'temp-url', 'fetch', normalizedReq]
```

参数归一化必须至少做到：

- 移除值为 `undefined` 的字段
- 保持对象键顺序稳定
- 对不参与缓存语义的字段只允许通过 manifest 显式声明排除，不允许生成器私自猜测

这条规则必须写入 `core/query-key.ts`，而不是每个 client 自己重复实现。

## Query / Mutation 分类规则

这套方案不能把 Query / Mutation 分类建立在 HTTP method 上。

推荐使用两层规则：

### 第一层：显式声明

manifest 对 operation 显式声明：

- `kind: query`
- `kind: mutation`

这是唯一可靠来源。

### 第二层：自动推断兜底

只有在 manifest 未显式声明时，才允许按命名作保守推断，例如：

- `list/get/fetch/query/search` 偏向 `query`
- `create/update/delete/upload/submit` 偏向 `mutation`

自动推断只能用于减少配置噪音，不能作为最终真相源。

## Mutation 失效策略

Mutation 失效策略也不应完全依赖隐式魔法。

推荐原则：

- 生成层允许根据 manifest 声明注入基础失效规则
- 默认只做同领域、同资源级别的保守失效
- 跨领域缓存联动放到 `adapters/` 处理

例如：

- 创建字典类型后失效 `dict/global-types/list`
- 删除字典项后失效 `dict/global-items/by-type`

但如果某个 mutation 还会影响另一个页面的聚合数据，不应硬编码到 generated 层。

## 多文档 / 多领域策略

### 1. 单文档切多个领域

适用于巨石后端：

- 一个 `monolith.json`
- 通过 `tag` / `path` / `operationId` 生成多个 client
- 每个 client 单独输出到自己的目录

### 2. 多文档多 client

适用于多服务后端：

- `iam.json -> iam client`
- `billing.json -> billing client`
- `storage.json -> storage client`

### 3. 两种模式必须统一消费

不论 client 来源于：

- 同一份大 spec 的切片
- 多份独立 spec

前端消费方式必须一致，业务层不应感知“client 来自几个文档”。

## Generated 只读治理

这里的“只读”不是依赖文件系统权限，而是依赖工程约束。

建议采用 4 层治理：

### 1. 目录边界隔离

`generated/` 只放生成文件，所有人工逻辑一律放外层：

- `core/`
- `adapters/`
- `clients/<domain>/index.ts`

### 2. 文件头声明

每个生成文件都带统一头注释：

```ts
/**
 * AUTO-GENERATED FILE
 * DO NOT EDIT MANUALLY
 */
```

### 3. `codegen:check`

CI 和 pre-commit 必须提供可重建校验。

当仓库采用“提交 generated”策略时，校验形式可以是：

```bash
pnpm codegen
git diff --exit-code -- src/lib/api/clients
```

当仓库采用“只提交 spec + config”策略时，`pnpm codegen:check` 也必须存在，但校验目标应改为：

- 生成流程能成功执行
- 输出目录无报错
- 临时输出与当前分支配置一致

也就是说，`codegen:check` 始终存在，只是根据仓库治理模式切换校验方式。

一旦有人手改 generated，校验必须失败。

### 4. 不给手改留扩展点

任何特殊逻辑都必须能在 generated 外完成，包括：

- 缓存失效扩展
- query key 特例
- 上传二阶段流程封装
- 兼容旧页面导出
- 聚合型业务 hook

## 运行时与规模风险约束

### 1. Manifest 复杂度膨胀

manifest 不是越强越好，必须有治理边界。

建议约束：

- 单个 client 的 `recommendedMaxOperations` 默认建议不超过 `200`
- 超过该规模时，优先拆分领域，而不是继续堆 override
- manifest 必须通过 schema 校验

### 2. Core 接口 Breaking Change

`src/lib/api/core/**` 的导出面是 generated 层的基础契约。

因此：

- core 公开函数签名变化必须进入专门的变更说明
- 不能静默调整 `transport`、`response`、`query-key` 的参数协议
- codegen translator 与 core 必须以受控版本一起演进

### 3. 巨型文档性能

巨型文档默认不允许只提供“全量生成一个总 client”的唯一策略。

必须支持：

- 按领域切片
- 按 client 增量生成
- 按 spec 增量刷新

如果某个 client 已经接近 operation 软上限，应优先拆域，而不是继续扩大输出文件集。

## 远程仓库治理策略

这套方案必须兼容不同规模项目的仓库治理策略。

### 默认推荐策略

对中小规模或核心领域，推荐提交以下内容到远程仓库：

- OpenAPI spec 快照
- codegen manifest 与脚本
- generated 产物

原因：

- PR 中可以直接 review 类型和 client 变更
- 不依赖运行中的 `/v3/api-docs` 才能构建和测试
- 历史分支和回滚更可复现

### 巨石项目兜底策略

对特别大的文档或低频改动领域，允许采用更保守策略：

- 只提交 spec 快照和 codegen 配置
- generated 在 CI 或本地生成

但该策略只应用于明确超大领域，不应作为通用默认值。

### 冲突控制原则

不论是否提交 generated，都必须满足：

- 分域分目录输出
- `types / sdk / queries / mutations` 分文件
- 生成顺序稳定
- 避免单一超大文件

### Snapshot 命名建议

为避免纯日期命名无法区分内容真实变化，spec 快照建议使用：

- `spec-name.YYYY-MM-DD.sha256-8.json`

例如：

- `java-demo.2026-06-04.a1b2c3d4.json`

这样可以同时保留：

- 可读日期
- 内容唯一性
- review 时的快速比对能力

## 验证策略

验证建议分为 4 个关注面：

### 1. 契约层

验证 spec 文件是否更新为预期版本，确保接口变更先体现为 contract diff。

### 2. 生成层

验证 generated 是否能由当前 spec + manifest 完整复现。

### 3. 运行时层

对手写核心层补齐单测，重点覆盖：

- `response.ts` 成功与失败分支
- `transport.ts` 超时、signal、headers、multipart
- `query-key.ts` 归一化和稳定性
- 代表性 client 的 query / mutation 产物结构

### 4. 集成层

为了让这套架构在大项目中可维护，建议至少落地以下 3 条测试主线：

- 生成规则 snapshot test
- `core/**` 运行时基座 `vitest`
- 基于 MSW 的 client 集成测试

其中 MSW 集成测试至少要覆盖一个完整 happy path，用来证明：

- 后端返回的是 `{ code, msg, data }`
- generated queryOptions 发起请求
- 消费层最终拿到的是解包后的 `data`

最小骨架示例如下：

```ts
server.use(
  http.post('/api/mdm/dict/global/types/list', () =>
    HttpResponse.json({
      code: 200,
      msg: 'ok',
      data: { list: [{ id: 1, dictTypeCode: 'A', dictTypeName: 'Alpha' }], total: 1 }
    })
  )
);

const data = await queryClient.fetchQuery(
  listGlobalTypesQueryOptions({ keyword: '', pageNo: 1, pageSize: 20 })
);

expect(data.list[0].dictTypeCode).toBe('A');
```

生成代码本身不追求逐行手写式单测，重点应放在“生成规则”和“运行时基座”的正确性。

## 迁移与落地策略

这套方案不建议一次性替换所有 feature 的手写 service。

推荐两步走：

### 第一步：新增领域先接入 generated client

- 为单个或少量领域生成 client
- 让其先跑通 `ensureQueryData + useSuspenseQuery + useMutation` 现有模式

### 第二步：旧 feature 渐进迁移

- 用外层 adapter 对齐旧 `service.ts` 语义
- 按页面或按领域逐步替换
- 不一次性重写全仓库数据访问层

### 手写 `service.ts` 到 generated client 的迁移对照

当前仓库 `src/features/products/api/service.ts` 是典型的手写 data access 层。迁移时应避免让页面层直接感知 generated 目录。

迁移前：

```ts
export async function getProducts(filters: ProductFilters): Promise<ProductsResponse> {
  return fakeProducts.getProducts(filters);
}
```

迁移后，建议通过 adapter 暴露稳定语义：

```ts
import { listProductsQueryOptions } from '@/lib/api/clients/products';

export function productsQueryOptions(filters: ProductFilters) {
  return listProductsQueryOptions({
    keyword: filters.keyword,
    pageNo: filters.page,
    pageSize: filters.perPage
  });
}
```

如果旧 feature 仍依赖 `service.ts` 风格，也应只让 `service.ts` 变成 generated client 的薄包装，而不是继续承载 fetch、解包和错误处理。

这样能把回归风险和 review 成本控制在可接受范围内。

## 当前仓库的首轮适配建议

虽然这套方案面向通用项目，但结合当前仓库和当前 spec，首轮建议聚焦两个领域：

- `dict`
- `file-storage`

原因：

- 当前文档天然按 tag 划分为“全局字典”和“文件存储”
- 这两个领域足以验证：
  - 查询语义 POST
  - 普通写操作
  - multipart 上传
  - 响应解包
  - 失效策略
  - 多 client 边界

首轮验证通过后，再把 manifest 扩展到更多领域或更多 spec。

## 验收标准

以下结果必须同时成立，才算本设计被正确实现：

1. 前端能够基于一个或多个 OpenAPI 文档生成多个领域 client，而不是只能生成单一总 client。
2. 生成产物至少包含 `types`、原子请求函数、`queryOptions`、`mutationOptions`。
3. 页面层可以继续沿用当前仓库 `ensureQueryData + useSuspenseQuery + useMutation` 的使用方式。
4. 所有普通 JSON 接口默认通过统一响应解包返回 `data`，成功条件固定为 `HTTP 2xx + code === 200`。
5. 查询与写操作的分类优先由 manifest 显式声明，不能仅按 HTTP method 推断。
6. 生成目录不承载人工业务逻辑，且存在可重建校验机制防止手改。
7. 方案既支持当前小文档，也支持大型巨石项目按领域选择性生成，且支持多个 OpenAPI 文档分别生成多个 client。
8. 生成产物的目录结构、命名策略和稳定出口足以支撑后续更换生成器实现，而不迫使业务层整体重写。

### Update (2026-06-04)

- 实现状态：
  - 已新增 `openapi/specs/java-demo.json` 与 `openapi/snapshots/java-demo.2026-06-04.a35098f7.json`，并提供 `pnpm openapi:fetch` 拉取/刷新流程。
  - 已落地 `tools/codegen/config/clients.ts` + `schema.ts` + `fetch-spec.ts` + `generate.ts`，由 manifest 驱动 `dict` 与 `file-storage` 两个 client 的过滤、Orval 原子 SDK 生成和稳定导出层生成。
  - 已在 manifest 增加 `queryClientImport` 配置；生成的 `mutations.ts` 不再硬编码 `@/lib/query-client`，而是按 client 配置注入 query client accessor。
  - 已新增 `src/lib/api/core/{transport,response,errors,body,query-key}.ts`，统一承载 HTTP 传输、响应解包、错误模型和 query key 归一化。
  - `transport.ts` 已补齐轻量 middleware 管线，支持请求改写、响应包裹与错误恢复重试；`customInstance` 对手写调用默认返回 `TransportResult<T>`，对 Orval raw caller 仍兼容原始响应形状。
  - 已生成 `src/lib/api/clients/dict/**` 与 `src/lib/api/clients/file-storage/**`，产物包含 `types`、`raw sdk`、`sdk`、`queryOptions`、`mutationOptions`、稳定根入口与 adapter 占位层。
  - 已补齐 core 单测、manifest/filter 单测，以及 generated query happy path、mutation invalidation 和 manifest-import 注入回归测试。
- 依赖关系：
  - 新增 devDependency：`orval@8.15.0`。
  - 当前 codegen 运行链路依赖本地 Node 对 `node --experimental-strip-types` 的支持，并默认从受控本地 spec 文件生成客户端。

### Update (2026-06-05)

- 实现状态：
  - 远程仓库治理默认策略已调整为“`generated` 不入库”。`src/lib/api/clients/*/generated/**` 视为可重建构建产物，不再作为默认受控内容提交到远程仓库。
  - 默认应提交的内容包括：`openapi/specs/**`、`openapi/snapshots/**`、`tools/codegen/**`、`src/lib/api/core/**`、`src/lib/api/clients/*/adapters/**`、client 稳定根入口以及 manifest 配置。
  - 默认不提交的内容包括：`src/lib/api/clients/*/generated/**`。这些文件的存在目的是支撑本地开发、类型检查、测试和构建，而不是成为第二份真相源。
  - 本更新覆盖本文前文“远程仓库治理策略”里“generated 产物默认推荐提交”的立场；如果未来某个项目确有例外，也必须显式声明为项目级特例，而不是再把 generated 入库作为通用默认。
  - `codegen:check` 的目标也应随之调整为“验证当前 `spec + manifest + generator` 可以完整生成客户端”，而不是依赖 `git diff generated` 作为一致性判据。
- 依赖关系：
  - CI 应把 codegen 作为前置步骤，在干净工作区中先验证可重建性，再继续类型检查和测试。对当前仓库，等价命令可以是 `pnpm codegen && pnpm exec tsc --noEmit && pnpm test:unit`。
  - 如果后续仓库补充 `pnpm typecheck` 脚本，则 CI 可以收敛为 `pnpm codegen && pnpm typecheck && pnpm test:unit`。
  - 任何 lint / test / build 流程如果依赖 `generated/**`，都必须以前置 codegen 为前提，不能再假设这些产物已经随分支提交到远程仓库。
