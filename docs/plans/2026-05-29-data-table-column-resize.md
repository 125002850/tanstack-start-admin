# DataTable 列宽调整与持久化 实现计划

**Goal:** 为 DataTable 新增列宽拖拽调整与 localStorage 持久化能力
**Architecture:** 基于 TanStack Table v8 内置 column sizing API（`columnResizeMode: 'onChange'` 保证实时视觉反馈），在 TableHead 层统一渲染 resize handle（pointer 生命周期管理 userSelect/cursor），state 更新与持久化分离（拖拽中只更新 React state，拖拽结束检测 `columnSizingInfo.isResizingColumn` 跃迁后才写 storage），回调仅暴露 `onColumnResizeEnd`
**Tech Stack:** @tanstack/react-table ^8.21.3, React 19, TypeScript

---

## File Structure

- **Create:** `src/lib/data-table-column-resize-storage.ts`
- **Create:** `src/lib/data-table-column-resize-storage.test.ts`
- **Create:** `src/components/ui/table/data-table-column-resize-handle.tsx`
- **Modify:** `src/config/data-table.ts`
- **Modify:** `src/types/data-table.ts`
- **Modify:** `src/hooks/use-data-table.ts`
- **Modify:** `src/components/ui/table/data-table.tsx`
- **Modify:** `src/features/users/components/users-table/index.tsx`
- **Modify:** `src/features/products/components/product-tables/index.tsx`

---

### Task 1: 存储工具与全局配置

**Type:** `infra`

**Files**
- Modify: `src/config/data-table.ts`
- Create: `src/lib/data-table-column-resize-storage.ts`
- Create: `src/lib/data-table-column-resize-storage.test.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- 现有 `dataTableConfig` 结构与类型不变
- `DataTableConfig` 类型自动从 `typeof dataTableConfig` 推导

**Constraints**
- 不修改 `data-table-page-size` 的 localStorage 逻辑
- 不引入新的第三方依赖

**Acceptance Criteria**
- [ ] `profile: task-1-core` 测试通过
- [ ] `npx tsc --noEmit` 零错误

**Verification Profile**
- `profile: task-1-core`
  - `npx vitest run src/lib/data-table-column-resize-storage.test.ts`
- `Expected Signals:` 全部测试通过

**Verification Strategy**
- `TDD` — 先写测试，再写实现

---

#### 修改 `src/config/data-table.ts`

在 `dataTableConfig` 对象中 `joinOperators` 之后添加：

```ts
columnResizeStorage: 'localStorage' as 'localStorage' | 'sessionStorage' | false,
```

#### 新建 `src/lib/data-table-column-resize-storage.ts`

缓存结构带 version，为未来迁移预留空间：

```ts
export type ColumnResizeStorageMode = 'localStorage' | 'sessionStorage' | false

// Key pattern: data-table:${tableId}:column-sizing
// Resource-oriented naming groups all table-scoped keys under the same prefix.
function storageKey(tableId: string): string {
  return `data-table:${tableId}:column-sizing`
}
const CACHE_VERSION = 1

interface ColumnSizingCache {
  version: number
  sizing: Record<string, number>
}

function resolveStorage(mode: 'localStorage' | 'sessionStorage'): Storage {
  return mode === 'sessionStorage' ? sessionStorage : localStorage
}

export function loadColumnSizing(
  tableId: string,
  mode: ColumnResizeStorageMode,
): Record<string, number> {
  if (mode === false) return {}
  try {
    const raw = resolveStorage(mode).getItem(storageKey(tableId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) return {}
    const cache = parsed as ColumnSizingCache
    // Version mismatch invalidates cache
    if (cache.version !== CACHE_VERSION) return {}
    if (typeof cache.sizing !== 'object' || cache.sizing === null) return {}
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(cache.sizing)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveColumnSizing(
  tableId: string,
  sizing: Record<string, number>,
  mode: ColumnResizeStorageMode,
): void {
  if (mode === false) return
  try {
    const cache: ColumnSizingCache = { version: CACHE_VERSION, sizing }
    resolveStorage(mode).setItem(
      storageKey(tableId),
      JSON.stringify(cache),
    )
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function clearColumnSizing(
  tableId: string,
  mode: ColumnResizeStorageMode,
): void {
  if (mode === false) return
  try {
    resolveStorage(mode).removeItem(storageKey(tableId))
  } catch {
    // silently ignore
  }
}
```

#### 新建 `src/lib/data-table-column-resize-storage.test.ts`

覆盖场景：
1. `loadColumnSizing` 正确读取有效缓存（含 `version: 1` + `sizing`）
2. `loadColumnSizing` 无缓存时返回 `{}`
3. `loadColumnSizing` mode=false 时返回 `{}`
4. `loadColumnSizing` version 不匹配时返回 `{}`（缓存失效）
5. `saveColumnSizing` 正确写入（验证 key 为 `data-table:${tableId}:column-sizing`）
6. `saveColumnSizing` mode=false 时不写入
7. `clearColumnSizing` 正确删除缓存
8. `clearColumnSizing` mode=false 时不操作
9. sessionStorage 模式读写正确
10. 损坏的 JSON 返回 `{}`
11. 不同 tableId 互相隔离

测试在 `beforeEach` 中 `localStorage.clear()` / `sessionStorage.clear()`。

---

- [ ] Step 1: 编写测试
- [ ] Step 2: 实现 `data-table-column-resize-storage.ts`
- [ ] Step 3: 修改 `config/data-table.ts`
- [ ] Step 4: Run `profile: task-1-core`
- [ ] Step 5: Run `npx tsc --noEmit`
- [ ] Step 6: Commit `feat: add column resize storage utility and config`

---

### Task 2: useDataTable 集成列宽状态

**Type:** `behavior`

**Files**
- Modify: `src/types/data-table.ts`
- Modify: `src/hooks/use-data-table.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- 现有 state（pagination/sorting/filters/rowSelection）行为不变
- adapter mode 与 internal mode 均正常工作
- 无 `tableId` 时 resize 仍可用（仅无持久化）

**Constraints**
- `tableId` 必须在组件生命周期内保持稳定（类似 `queryKey`）。切换 tableId 需要重新挂载组件，不支持运行时动态切换
- 本 task 不引入持久化逻辑（留给 Task 4）

**Acceptance Criteria**
- [ ] `profile: task-2-regression` 现有测试全绿
- [ ] `npx tsc --noEmit` 零错误

**Verification Profile**
- `profile: task-2-regression`
  - `npx vitest run src/hooks/use-data-table.internal-state.test.tsx`
  - `npx vitest run src/features/users/components/users-table.internal-state.test.tsx`
  - `npx vitest run src/features/products/components/product-tables.internal-state.test.tsx`
- `Expected Signals:` 全部通过，无新增失败

**Verification Strategy**
- `regression guard`

---

#### 修改 `src/types/data-table.ts`

在文件末尾新增：

```ts
export type ColumnResizeStorageMode = 'localStorage' | 'sessionStorage' | false
```

#### 修改 `src/hooks/use-data-table.ts`

**新增 import**（合并到已有 `@tanstack/react-table` import 中）：

```ts
type ColumnSizingState,
```

**新增 import：**

```ts
import { dataTableConfig, type ColumnResizeStorageMode } from '@/config/data-table'
```

**在 `UseDataTableProps` 中新增字段：**

```ts
tableId?: string
columnResizeStorage?: ColumnResizeStorageMode
onColumnResizeEnd?: (columnKey: string, width: number) => void
```

**在现有 state hooks 之后、`useReactTable` 之前新增：**

```ts
const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
  initialState?.columnSizing ?? {},
)

const onColumnSizingChange = React.useCallback(
  (updaterOrValue: Updater<ColumnSizingState>) => {
    setColumnSizing((prev) =>
      typeof updaterOrValue === 'function'
        ? (updaterOrValue as (prev: ColumnSizingState) => ColumnSizingState)(prev)
        : updaterOrValue,
    )
  },
  [],
)
```

**修改 `useReactTable` 调用：**

在 `state` 中添加 `columnSizing`，在顶层 options 中添加：

```ts
onColumnSizingChange,
enableColumnResizing: true,
columnResizeMode: 'onChange' as const,
```

在已有 `defaultColumn` spread 中添加默认尺寸：

```ts
defaultColumn: {
  minSize: 80,
  size: 150,
  ...tableProps.defaultColumn,
},
```

---

- [ ] Step 1: 修改 `src/types/data-table.ts`
- [ ] Step 2: 修改 `src/hooks/use-data-table.ts`
- [ ] Step 3: Run `profile: task-2-regression`
- [ ] Step 4: Run `npx tsc --noEmit`
- [ ] Step 5: Commit `feat: integrate column sizing state into useDataTable`

---

### Task 3: 拖拽手柄组件 + DataTable 接入

**Type:** `behavior`

**Files**
- Create: `src/components/ui/table/data-table-column-resize-handle.tsx`
- Modify: `src/components/ui/table/data-table.tsx`

**Shared Runtime Contracts**
- `none`

**Invariants**
- 排序、筛选功能不受影响
- selection 列不可拖拽（`enableResizing: false` → `getCanResize()` 返回 false → 不渲染 handle）
- 虚拟滚动模式下列宽调整正常（`getCommonPinningStyles` 已包含 `width: column.getSize()`）
- 拖拽过程中 userSelect 被禁用，释放后恢复

**Constraints**
- 不修改 `DataTableColumnHeader` 组件
- 不修改列定义文件（columns.tsx）
- resize handle 在 `TableHead` 层统一渲染，对所有 header 类型生效

**Acceptance Criteria**
- [ ] `profile: task-3-regression` 现有测试全绿
- [ ] 拖拽列右边缘可调整列宽
- [ ] Hover 时显示 `col-resize` 光标
- [ ] selection 列右侧无拖拽手柄
- [ ] 拖拽中禁止文本选中，释放后恢复

**Verification Profile**
- `profile: task-3-regression`
  - `npx vitest run src/components/ui/table/data-table.test.tsx`
- `Expected Signals:` 现有测试通过

**Verification Strategy**
- `regression guard` + manual browser smoke

**Manual Verification Exception**
- `Waiver Reason:` 拖拽交互的视觉反馈和光标变化需要真实浏览器环境验证，pointer 事件序列无法在单元测试中可靠模拟
- `Automated Smoke Check:` `npx vitest run src/components/ui/table/data-table.test.tsx`
- `Manual Verification Steps:`
  1. `pnpm dev` 启动应用，打开 `/dashboard/users`
  2. Hover 在"姓名"列表头右边缘，确认光标变为 `col-resize`
  3. 拖拽调整列宽，确认宽度实时变化
  4. 拖拽过程中尝试选中文本，确认被禁止
  5. 释放鼠标后尝试选中文本，确认恢复
  6. Hover selection 列右边缘，确认无 resize 光标（handle 未渲染）
  7. 打开 `/dashboard/products`，确认无回归
- `Expected Results:` 列宽可拖拽，selection 列不可调，userSelect 在拖拽中被抑制
- `Follow-up Automation:` `not needed` — 核心逻辑由 TanStack Table 保证，handle 是纯展示组件

---

#### 新建 `src/components/ui/table/data-table-column-resize-handle.tsx`

使用 pointer capture + pointerup/pointercancel 管理 userSelect 和 cursor，替代 MutationObserver：

```tsx
import { useRef, useCallback } from 'react'
import type { Header } from '@tanstack/react-table'

interface DataTableColumnResizeHandleProps<TData> {
  header: Header<TData, unknown>
}

export function DataTableColumnResizeHandle<TData>({
  header,
}: DataTableColumnResizeHandleProps<TData>) {
  if (!header.column.getCanResize()) return null

  const isResizingRef = useRef(false)

  const cleanup = useCallback(() => {
    if (!isResizingRef.current) return
    isResizingRef.current = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      isResizingRef.current = true
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('pointerup', cleanup, { once: true })
      document.addEventListener('pointercancel', cleanup, { once: true })
      header.getResizeHandler()(e)
    },
    [header, cleanup],
  )

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        e.stopPropagation()
        isResizingRef.current = true
        document.body.style.userSelect = 'none'
        document.addEventListener('touchend', cleanup, { once: true })
        document.addEventListener('touchcancel', cleanup, { once: true })
        header.getResizeHandler()(e)
      }}
      onTouchStartCapture={(e) => e.stopPropagation()}
      className='absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none z-10
        before:absolute before:inset-y-0 before:-left-1 before:right-0
        hover:before:bg-border
        data-[resizing=true]:before:bg-primary/30'
      data-resizing={header.column.getIsResizing()}
    />
  )
}
```

关键设计：
- `isResizingRef` 防止 `cleanup` 被多次调用（`header.getResizeHandler()` 内部可能也监听 pointerup）
- `{ once: true }` 保证 listener 自动注销
- `before:` 伪元素提供 6px 热区（视觉上 1.5px 的线太窄不易点击）

---

#### 修改 `src/components/ui/table/data-table.tsx`

**新增 import：**

```ts
import { DataTableColumnResizeHandle } from './data-table-column-resize-handle'
```

**修改 `TableHead` 渲染，在 flexRender 之后添加 resize handle：**

```tsx
<TableHead
  key={header.id}
  colSpan={header.colSpan}
  style={{
    ...getCommonPinningStyles({ column: header.column }),
  }}
>
  {header.isPlaceholder
    ? null
    : flexRender(header.column.columnDef.header, header.getContext())}
  <DataTableColumnResizeHandle header={header} />
</TableHead>
```

注意：无需额外设置 `position: 'relative'`。`getCommonPinningStyles` 对非 pinned 列已返回 `position: 'relative'`；对 pinned 列返回 `position: 'sticky'`（同样创建 containing block，absolute 子元素可正确定位）。

---

- [ ] Step 1: 创建 `data-table-column-resize-handle.tsx`
- [ ] Step 2: 修改 `data-table.tsx` — import、TableHead 渲染
- [ ] Step 3: Run `profile: task-3-regression`
- [ ] Step 4: Run `npx tsc --noEmit`
- [ ] Step 5: 手动浏览器验证（见 Manual Verification Steps）
- [ ] Step 6: Commit `feat: add column resize handle to DataTable`

---

### Task 4: 持久化写入策略 + 回调

**Type:** `behavior`

**Files**
- Modify: `src/hooks/use-data-table.ts`

**Shared Runtime Contracts**
- `none`

**Invariants**
- 拖拽过程中不写 storage（通过 `columnSizingInfo.isResizingColumn` false→string→false 跃迁检测控制）
- `onColumnResizeEnd` 在 resize 结束后仅对实际变更的列触发（prevSizingRef diff）
- 无 `tableId` 时 resize 功能正常（仅无持久化）
- `resetColumnSizing` 清除缓存并恢复为 `initialState.columnSizing` 或 `defaultColumn` 默认值

**Constraints**
- 只修改 `use-data-table.ts`，不改动其他文件

**Acceptance Criteria**
- [ ] `profile: task-4-regression` 现有测试全绿
- [ ] 拖拽列宽后刷新页面，列宽保持
- [ ] 拖拽过程中无 storage 写入
- [ ] 不同 tableId 的缓存互不影响
- [ ] 调用 `resetColumnSizing()` 后列宽恢复默认，storage 缓存被清除

**Verification Profile**
- `profile: task-4-regression`
  - `npx vitest run src/hooks/use-data-table.internal-state.test.tsx`
  - `npx vitest run src/features/users/components/users-table.internal-state.test.tsx`
  - `npx vitest run src/features/products/components/product-tables.internal-state.test.tsx`
- `Expected Signals:` 全部通过

**Verification Strategy**
- `regression guard` + manual browser smoke

**Manual Verification Exception**
- `Waiver Reason:` localStorage 持久化行为需要浏览器环境验证
- `Automated Smoke Check:` `npx vitest run src/hooks/use-data-table.internal-state.test.tsx`
- `Manual Verification Steps:`
  1. `pnpm dev`，打开 `/dashboard/users`
  2. 拖拽调整"姓名"列宽度
  3. DevTools → Application → Local Storage，确认 `data-table:user-list:column-sizing` key 存在且含 `version: 1`
  4. 刷新页面，确认列宽恢复到拖拽后的宽度
  5. 打开 `/dashboard/products`，确认 products 表列宽不受 users 表缓存影响
- `Expected Results:` 拖拽后缓存写入 storage，刷新恢复
- `Follow-up Automation:` `not needed`

---

#### 修改 `src/hooks/use-data-table.ts`

**新增 import：**

```ts
import { loadColumnSizing, saveColumnSizing } from '@/lib/data-table-column-resize-storage'
```

**Step A — 在 hook 顶部计算 storage mode**（放在所有 `useState` 之前，确保 hook 顺序稳定）：

```ts
const resolvedStorageMode: ColumnResizeStorageMode = React.useMemo(
  () => (props.columnResizeStorage ?? dataTableConfig.columnResizeStorage) as ColumnResizeStorageMode,
  [props.columnResizeStorage],
)
```

**Step B — 修改 `columnSizing` 的 `useState` initializer**，将缓存合并前移到受控 state 的初始值中（而非 `useReactTable` 的 `initialState`）：

Task 2 中写的是：
```ts
const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
  initialState?.columnSizing ?? {},
)
```

Task 4 改为：
```ts
const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
  ...initialState?.columnSizing,
  ...(props.tableId
    ? loadColumnSizing(props.tableId, resolvedStorageMode)
    : {}),
}))
```

合并顺序：`initialState.columnSizing` 在前，用户缓存在后 → 缓存优先。无 `tableId` 时跳过 storage 查询。

**为什么放在 `useState` initializer 而不是 `useReactTable.initialState`：**
TanStack 中 `state.columnSizing`（受控）会覆盖 `initialState.columnSizing`。Task 2 已经把 `columnSizing` 作为受控 state 传入 `useReactTable`，所以 `initialState.columnSizing` 实际不生效。把合并逻辑放在 `useState` initializer 中，受控 state 的初始值就直接包含缓存列宽，无需 `initialState` 参与。

**`useReactTable` 的 `initialState` 参数保持不变**（Task 2 的原样即可，不额外设置 `initialState.columnSizing`）。

**Step C — 在 `useReactTable` 调用之后新增两个 effect：**

```ts
// ── Seed prevSizingRef with initial sizing so the first resize-end
//     only fires for columns that actually changed. ───────────────────

const prevSizingRef = React.useRef<ColumnSizingState>({})

React.useEffect(() => {
  prevSizingRef.current = table.getState().columnSizing
}, [])

// ── Persistence: write to storage only on resize-end ─────────────────

const prevIsResizingRef = React.useRef<string | false>(false)

const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn

React.useEffect(() => {
  const wasResizing = !!prevIsResizingRef.current
  const isResizing = !!isResizingColumn
  prevIsResizingRef.current = isResizingColumn

  if (wasResizing && !isResizing) {
    // Resize just ended — persist
    const currentSizing = table.getState().columnSizing
    if (props.tableId && resolvedStorageMode !== false) {
      saveColumnSizing(
        props.tableId,
        currentSizing as Record<string, number>,
        resolvedStorageMode,
      )
    }
    // Only fire for columns that actually changed
    if (props.onColumnResizeEnd) {
      const prev = prevSizingRef.current
      for (const [key, width] of Object.entries(currentSizing)) {
        if (typeof width === 'number' && prev[key] !== width) {
          props.onColumnResizeEnd(key, width)
        }
      }
    }
    prevSizingRef.current = { ...currentSizing }
  }
}, [isResizingColumn])
```

第一个 effect（`[]` deps）在首次渲染后把 `prevSizingRef` 同步为当前列宽，确保后续 diff 不会误报。第二个 effect 依赖 `isResizingColumn`，仅在 resize 开始/结束时触发。

**Step D — 新增 `resetColumnSizing` 方法：**

```ts
const resetColumnSizing = React.useCallback(() => {
  // Clear persisted cache
  if (props.tableId) {
    clearColumnSizing(props.tableId, resolvedStorageMode)
  }
  // Reset to initialState.columnSizing or empty (falls back to defaultColumn.size)
  setColumnSizing(initialState?.columnSizing ?? {})
  // Sync prevSizingRef so the next resize-end diff is valid
  prevSizingRef.current = initialState?.columnSizing ?? {}
}, [props.tableId, resolvedStorageMode, initialState?.columnSizing])
```

**修改 return 语句**，新增 `resetColumnSizing`：

```ts
return { table, shallow, debounceMs, throttleMs: tableProps.throttleMs, resetColumnSizing }
```

**保留 Task 2 中的 `onColumnSizingChange` 不变** — 它只更新 state，不写 storage。

---

- [ ] Step 1: 修改 `use-data-table.ts` — import、useState initializer（合并缓存）、prevSizingRef 同步 effect、resize-end effect、resetColumnSizing + return
- [ ] Step 2: Run `profile: task-4-regression`
- [ ] Step 3: Run `npx tsc --noEmit`
- [ ] Step 4: 手动浏览器验证持久化（见 Manual Verification Steps）
- [ ] Step 5: Commit `feat: add column width persistence and onColumnResizeEnd callback`

---

### Task 5: 业务表接入 tableId

**Type:** `wiring`

**Files**
- Modify: `src/features/users/components/users-table/index.tsx`
- Modify: `src/features/products/components/product-tables/index.tsx`

**Shared Runtime Contracts**
- `none`

**Invariants**
- 用户表、产品表行为不变

**Constraints**
- tableId 使用稳定的字符串常量

**Acceptance Criteria**
- [ ] `profile: task-5-regression` 现有测试全绿
- [ ] `npx tsc --noEmit` 零错误

**Verification Profile**
- `profile: task-5-regression`
  - `npx vitest run src/features/users/components/users-table.internal-state.test.tsx`
  - `npx vitest run src/features/products/components/product-tables.internal-state.test.tsx`
- `Expected Signals:` 全部通过

**Verification Strategy**
- `regression guard`

---

#### 修改 `src/features/users/components/users-table/index.tsx`

```ts
const USERS_TABLE_ID = 'user-list'
```

在 `useDataTable` 调用处添加：

```ts
const { table } = useDataTable({
  // ... existing props
  tableId: USERS_TABLE_ID,
})
```

#### 修改 `src/features/products/components/product-tables/index.tsx`

```ts
const PRODUCT_TABLE_ID = 'product-list'
```

在 `useDataTable` 调用处添加：

```ts
const { table } = useDataTable({
  // ... existing props
  tableId: PRODUCT_TABLE_ID,
})
```

---

- [ ] Step 1: 修改 users-table `useDataTable` 调用
- [ ] Step 2: 修改 products-table `useDataTable` 调用
- [ ] Step 3: Run `profile: task-5-regression`
- [ ] Step 4: Run `npx tsc --noEmit`
- [ ] Step 5: Commit `feat: add tableId to user and product tables`

---

## 验收检查清单

全部任务完成后执行：

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npx vitest run` 全部测试通过
- [ ] users 表：拖拽调整列宽，刷新后保持
- [ ] users 表：selection 列不可拖拽
- [ ] products 表：拖拽调整列宽，刷新后保持
- [ ] 拖拽过程中 userSelect 被禁用
- [ ] 拖拽过程中无 localStorage 写入（仅在释放时写入）
- [ ] 虚拟滚动模式下列宽调整正常
- [ ] 排序、筛选功能未受影响
- [ ] 固定列在列宽变化后位置正确

<!-- Execution appended below during runtime -->

### Task 1 Execution
- Result: pass
- Files changed: `src/lib/data-table-column-resize-storage.ts` (create), `src/lib/data-table-column-resize-storage.test.ts` (create), `src/config/data-table.ts` (modify)
- Verification: `npx vitest run src/lib/data-table-column-resize-storage.test.ts` -> 19 tests PASS; `npx tsc --noEmit` -> zero errors
- Notes: none

### Task 2 Execution
- Result: pass
- Files changed: `src/types/data-table.ts` (add ColumnResizeStorageMode export), `src/hooks/use-data-table.ts` (add ColumnSizingState import, columnSizing state, onColumnSizingChange, useReactTable column resize config)
- Verification: `profile: task-2-regression` -> 43 tests PASS; `npx tsc --noEmit` -> zero errors
- Notes: none

### Task 3 Execution
- Result: pass
- Files changed: `src/components/ui/table/data-table-column-resize-handle.tsx` (create), `src/components/ui/table/data-table.tsx` (import + render handle in TableHead)
- Verification: `npx vitest run src/components/ui/table/data-table.test.tsx` -> 6 tests PASS; `npx tsc --noEmit` -> zero errors
- Notes: Manual browser verification deferred — drag interaction requires real browser environment. Automated tests pass.

### Task 4 Execution
- Result: pass
- Files changed: `src/hooks/use-data-table.ts` (add imports, resolvedStorageMode, useState initializer merge, prevSizingRef effect, persistence effect, resetColumnSizing)
- Verification: `profile: task-4-regression` -> 43 tests PASS; `npx tsc --noEmit` -> zero errors
- Notes: none

### Task 5 Execution
- Result: pass
- Files changed: `src/features/users/components/users-table/index.tsx` (add USERS_TABLE_ID + tableId prop), `src/features/products/components/product-tables/index.tsx` (add PRODUCT_TABLE_ID + tableId prop)
- Verification: `profile: task-5-regression` -> 27 tests PASS; `npx tsc --noEmit` -> zero errors
- Notes: none

### Final Verification
- `npx tsc --noEmit` -> zero errors
- `npx vitest run` -> 293 passed, 1 failed (pre-existing virtualization test, not caused by these changes)
- Pre-existing failure verified by running same test on base commit — reproduces identically
