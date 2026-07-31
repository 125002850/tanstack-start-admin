# Task 02：Adapter Registry、Codec 与 DSL Gate

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

**Depends On:** Task 01

**Blocks:** Task 03

**Type:** architecture

## Goal

建立 column-bound codec、`EditableTypeAdapterRegistry` 和 public capability gate，把 `editableField()` 从分散分支迁移到 registry 分发，同时保持当前 public editable type 和行为不变。

## Files

- Create: `src/components/data-table/columns/data-table-edit-codecs.ts`
- Create: `src/components/data-table/columns/data-table-edit-codecs.test.ts`
- Create: `src/components/data-table/columns/data-table-edit-adapters.ts`
- Create: `src/components/data-table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/data-table/columns/data-table-column-builders.tsx`
- Modify: `src/components/data-table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`

## Invariants

- adapter 以 column `type` 为 key，保存 factory，不保存跨列共享的 codec 实例。
- `columnDef.meta.editableCell` 持有已解析、绑定具体列的 codec 和 editor meta。
- planned type 的内部 options/overload 骨架可以建立，但 public DSL 只能暴露已经可执行的 legacy type。
- 缺失 adapter 或 codec 时 fail closed，禁止回退成 text editor。
- builder 只做配置合并、registry 查找和 meta 写入，不堆叠每个 type 的 editor 分支。
- 不改变展示 type registry 和服务端筛选 DSL。

## Required Contracts

- `DataTableEditParseResult<TValue>`
- `DataTableEditCodec<TData, TValue>`
- `DataTableEditableTypeAdapter<TData, ...>`
- `DataTableResolvedEditableCell<TData, TValue>`
- `PlannedEditableType`
- 从 enabled adapter keys 推导的 `SupportedEditableType`
- legacy text / choice identity codec
- switch typed candidate adapter

## Out of Scope

- 不迁移 active session 数据结构。
- 不实现 numeric、date、dateTime 或 textarea UI。
- 不公开 planned-but-disabled type。
- 不实现 paste 或 programmatic write。

## Acceptance Criteria

- [x] 同一 type 的不同列产生独立 bound codec。
- [x] codec 使用合并后的列级配置，配置不会跨列污染。
- [x] text、enum、select、remoteSelect 和 switch 的现有 DSL 编译结果保持兼容。
- [x] planned-but-disabled type 在 public `editableField()` 调用处产生 TypeScript 错误。
- [x] 缺失 adapter/codec 的列不产生可编辑 meta。
- [x] `data-table-column-builders.tsx` 不再通过平行的 type/editor 条件链分发 legacy editor。
- [x] 没有新增依赖。

## Verification Profile

```bash
pnpm exec vitest run src/components/data-table/columns/data-table-edit-codecs.test.ts src/components/data-table/columns/data-table-edit-adapters.test.ts src/components/data-table/columns/data-table-column-factory.test.tsx
pnpm typecheck
pnpm lint
```

## Execution Recipe

1. 先补 codec、adapter 和 capability gate 的失败测试。
2. 建立纯 codec 类型和 legacy identity factory。
3. 建立 registry，并把现有 editor meta 迁移为 resolved editable-cell meta。
4. 修改 builder 使用 registry 分发。
5. 加入 planned type 内部骨架和 public gate 类型测试。
6. 运行本 task 验证，不开始 session 迁移。
7. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 新增纯 `DataTableEditCodec` factory，固定 text / choice identity 行为、空值校验、
  `maxSelected` 和 switch typed candidate 校验。
- 新增 `EditableTypeAdapterRegistry` 与 enabled adapter capability gate；public type 仍仅为
  `text`、`enum`、`select`、`remoteSelect`，planned type 只建立内部类型骨架。
- `editableField()` 已改为 registry 分发，builder 只负责配置拆分、展示默认值、meta 写入和
  renderer 调用，不再维护 text / choice / switch 平行分支。
- `columnDef.meta.editableCell` 现在持有 column-bound codec、editor、commit mode 与
  invalid behavior；choice 兼容字段 `editableChoice` 继续指向同一个 resolved meta。
- 为适配显式 editor 判别字段，局部更新 legacy 空值判断和 hook 测试夹具；未迁移 active
  session、paste 或 programmatic write。
- 未修改服务端筛选 DSL，未新增或升级依赖。

### 阻塞项或未预期的技术债务

- 无阻塞项。
- `editableChoice` 仍作为兼容读取路径存在；在现有 choice label resolution 和业务测试迁移
  完成前不能删除，Task 03 只迁移 session，不顺带移除此兼容字段。
- codec 已绑定到列 meta，但 Task 02 按范围尚未进入 runtime parse / validate；当前 legacy
  runtime 仍执行原有空值校验，Task 03 必须一次性切换，避免形成双重真相源。

### 后续行动项（Action Items）

- TODO (P0)：Task 03 将 active session 迁移为 draft / parseState / candidate，并在 session
  启动时固化本 task 生成的 resolved editable meta。
- TODO (P0)：Task 03 迁移后继续运行 Task 01 characterization 与 Task 02 codec/adapter
  测试，证明 legacy 行为等价。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 新增类型化 `DataTableMessageCatalog` 与默认 `zh-CN` 消息目录，long text、numeric、
  date、dateTime、choice、switch codec 的用户可见 parse / validate 错误不再散落英文
  字面量。
- 为保持向后兼容，本次未改变 codec 的 `string[]` 错误契约，也未把 locale 参数扩散到
  column DSL；消息目录作为后续 I18N 的过渡边界。
- 仓库扫描同时中文化了文件上传器和 Demo Form 的用户可见英文校验提示；React Context、
  adapter 非法配置等开发者断言继续保留英文诊断。

### 验证结果

- codec、adapter、编辑器、matrix、fill 与 editing runtime 定向 Vitest：9 个文件、
  117 个测试通过。
- 日期完整文本输入移除后的 DataTable / Date / DateTime 回归：3 个文件、112 个测试
  通过；全仓 unit 为 92 / 94 个文件、854 / 856 个测试通过。
- `pnpm typecheck`、`pnpm lint`、目标文件格式检查和 `git diff --check` 通过。

### 阻塞项或未预期的技术债务

- 无本次交付阻塞；全仓 unit 仍有两个既有基线失败：
  `management-toolbar-contract.test.ts` 的 department tableActions contract，以及
  `dictionary-management-page.test.tsx` 的字典项状态切换确认文案查找。
- 当前 catalog 仍在领域层生成最终字符串，尚不是完整的运行时 locale 注入方案。

### 后续行动项（Action Items）

- `TODO (P1)`：正式接入 I18N 时将 codec 错误升级为稳定 error code + params，并在 UI
  边界翻译；在此之前保持现有 `string[]` API，禁止业务列重新散落文案。
- `TODO (P2)`：服务端错误需要以后端错误码映射翻译，不对任意 `Error.message` 做字符串
  替换。
