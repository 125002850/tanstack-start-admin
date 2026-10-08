# 表单代码规范

## 适用范围

新增或修改表单、字段校验、Sheet/Dialog 表单、可搜索选择器、远程选项加载或嵌套浮层时，必须读取本文件。

以以下仓库实现为准：

- `src/components/ui/tanstack-form.tsx`
- `src/components/ui/form-context.tsx`
- `src/components/forms/fields/`
- `src/components/ui/search-combobox.tsx`
- `src/components/ui/use-overlay-portal-container.ts`
- `src/hooks/use-remote-combobox-state.ts`

## 表单状态与校验

- 标准新增、编辑表单统一使用 `useAppForm`；优先通过 `useFormFields<TValues>()` 获取类型安全的 `FormXxxField`。
- 使用 Zod schema 定义提交级校验，并通过 `validators.onSubmit` 接入；字段级 `onBlur` / `onChange` 校验只用于提前反馈，不得替代提交级校验。
- `defaultValues` 必须覆盖完整表单结构，并显式约束为表单值类型。API DTO 到表单值、表单值到提交 payload 的转换必须在边界处完成。
- 请求字段的 `undefined`、`null`、空字符串语义必须来自当前接口契约，禁止在请求边界使用 `value || undefined` 隐式丢弃空字符串。
- 创建接口明确将空字符串定义为“未提供/使用默认值”时，可显式使用 `emptyStringToUndefined()`；更新/保存请求必须保留“清空字段”的表达能力，不得用该 helper 把空字符串省略。
- 字典值、状态码和条件分支必须来自当前字典或仓库常量，禁止在表单中重复硬编码后端枚举值。
- 提交期间必须阻止重复提交；依赖数据加载失败、必需选项缺失或当前上下文不可提交时，必须禁用提交并提供可见错误。
- 依赖查询只在首次无数据的 pending 状态展示骨架；后台 refetch 必须保留现有表单和用户输入。刷新失败但缓存仍可用时不得把表单替换为错误页。
- 提交失败必须保留当前字段值和 Sheet/Dialog 打开状态；错误通知统一交给项目 MutationCache 或明确的局部错误出口，禁止产生未处理 Promise rejection。
- Sheet/Dialog 表单在关闭动画完成后通过 `onAfterClose` 重置；外部 Footer 提交按钮必须使用稳定的 `form` id 关联内部 `<form>`。
- loading、error、ready 分支切换不得被误判为关闭。若分支使用不同的 `SheetContent` / `DialogContent` 实例，只有实际持有可编辑表单的实例可以注册重置回调，或将 Content 提升为稳定的公共外壳。
- 仅当表单包含动态行、附件上传、跨组件提交编排等现有封装无法合理承载的状态时，才允许手写状态和校验。此时仍必须遵守下述 Field、可访问性和生命周期规范。

## 字段组合与可访问性

- 自定义字段必须使用 `FieldGroup` / `FieldSet`、`Field`、`FieldLabel`、`FieldError` 组合，禁止使用裸 `div + Label + control` 模拟表单字段。
- 优先复用 `src/components/forms/fields/` 中的字段组件；只有现有字段无法表达交互时才使用 `form.AppField` 自定义。
- 必填标识统一使用字段组件的 `required` 属性或 `<FieldLabel required>`，禁止在 label 文本中手写 `*`。
- `Field` 使用 `data-invalid` 表达容器错误状态，输入控件或 trigger 使用 `aria-invalid`；错误信息必须由 `FieldError` 或等价的可访问错误节点呈现。
- `FieldLabel htmlFor` 必须指向输入控件 id。非原生输入控件必须提供明确的可访问名称，例如 `triggerLabel`、`aria-label` 或 `aria-labelledby`。
- 条件字段的显示、必填、校验和 payload 映射必须复用同一组派生条件。条件失效时应清理不再提交的旧值，避免隐藏字段残留脏数据。
- 多列布局可以在字段组外使用响应式 grid；字段内部间距由 Field 组件负责，禁止使用绝对定位拼装输入控件。

## SearchCombobox

### 选择原则

- 固定且无需搜索的小型选项集使用 `Select`；需要搜索、自定义选项展示、对象值或分页加载时使用 `SearchCombobox`。
- 业务代码禁止重新实现 `Button + Command + absolute div` 形式的可搜索下拉框，也禁止自行维护点击外部关闭、Escape 关闭和焦点恢复逻辑。
- `SearchCombobox` 使用受控接口。调用方必须显式管理 `value`、`open`、`inputValue` 及对应 change handler。

### 值与选项

- `itemToStringValue` 必须返回稳定的领域唯一值，禁止使用展示文案作为业务标识。
- `isItemEqualToValue` 必须按同一领域标识比较；`getItemKey` 优先使用同一稳定标识，只有无稳定标识的纯展示项才允许回退到 index。
- `itemToStringLabel` 只负责 trigger 展示；选项含多字段时必须提供 `getItemAriaLabel`，确保读屏文本完整。
- `filter={null}` 由基础组件统一设置，调用方必须传入已过滤的 `items`。本地数据使用派生过滤结果；远程数据使用 `useRemoteComboboxState` 统一处理 debounce、分页、去重和关闭重置。
- 远程选择器必须区分 `emptyText` 与 `loadingText`，并通过 `loadMore` 暴露分页状态；加载中和只读状态必须传入 `disabled`。

### 展示、分页与可访问性

- `triggerAppearance` 默认为 `'input'`；工具栏等按钮式入口可使用 `'button'`。该属性只调整触发器外观，不改变受控值、搜索或选择行为。
- `id` 用于关联外部 Label 的 `htmlFor`；必填字段传入 `aria-required`，校验提示继续使用 `aria-invalid` / `aria-describedby`。这些可访问性属性不代替表单校验。
- 列表滚动接近底部时会调用 `loadMore.onClick`，并保留手动加载入口。调用方通过 `loadMore.visible` 表达是否还有下一页，通过 `isLoading` / `disabled` 阻止重复加载；分页状态和请求仍由调用方管理，禁止另外注册滚动监听重复触发请求。
- 自定义外观或分页不得绕过组件内置的 `useOverlayLifecycle` 与 Portal 容器处理。

## ChoiceCombobox

- 单选和多选统一复用 `SingleChoiceCombobox` / `MultipleChoiceCombobox`，两者共享 ChoiceCombobox 弹层与底部操作区，并分别保持标量和数组值契约；`MultiSelectCombobox` 仅作为向后兼容包装。
- value 必须由调用方受控；多选值保持用户选择顺序并按 value 去重。使用 `maxSelected` 时，达到上限后只禁用未选 option；`allowEmpty={false}` 时隐藏清除入口，并阻止移除最后一项。
- 远程选择器同时受控 `open`、`inputValue`，通过 `loadMore` 传入分页状态，并使用 `searchMode='remote'` 避免二次本地过滤。
- loading、empty、error、load more 必须使用不同文案；搜索翻页时需要保留已选 value，但不得实现“选择全部远程数据”。
- `ChoiceComboboxOption.labelContent` 只替换选项内的文案展示，可用于徽标或复合内容；必须保留纯文本 `label`，搜索、触发器和 Tooltip 仍使用它，`value` 继续作为稳定业务标识。
- `SingleChoiceCombobox` / `MultipleChoiceCombobox` 的 `children` 渲染在弹层底部独立操作区，适合创建或管理入口；不得塞入选项列表或当成选中值。自定义操作需要关闭弹层时，通过受控 `open` / `onOpenChange` 完成。
- DataTable 的 `editableField` 已封装上述远程状态、Portal 和焦点生命周期，业务列只声明 option source、selectionMode 与 allowEmpty，不直接拼装 Combobox。

### Workspace 与表单联动

- 位于 workspace keep-alive 页面中的业务选择器应使用自身受控 `open` / `onOpenChange` 状态；`WorkspaceViewport` 通过通用 `OverlayLifecycleProvider` 注入显式关闭注册，`page-overlays` 的 DOM fallback 继续覆盖未注册浮层和退出动画。
- 基础 UI 组件可依赖 `components/ui/overlay-lifecycle` 的通用接口，但禁止引用 workspace 业务模块或 workspace 专用 hook；tabId 与注册表绑定必须留在 `features/workspace-tabs` 边界内。
- 关闭选择器时必须重置搜索词；选中值后必须同步表单字段，并在自定义 TanStack Form 字段中正确触发 touched/blur 语义。
- 不得在业务组件中查询 `[role="combobox"]`、手动调用 `requestAnimationFrame` 聚焦或注册 document 级 pointer/keyboard 监听；这些职责属于基础组件。

## useOverlayPortalContainer

- `SearchCombobox` 已内置 `useOverlayPortalContainer`，业务调用方禁止重复调用或覆盖其 portal container。
- 只有封装新的通用浮层组件，且该组件可能嵌套在 Sheet/Dialog 中时，才直接使用此 hook。
- 必须把 `setTriggerNode` 绑定到真实 trigger 节点，把返回的 `container` 传给浮层 Portal/Content，并把 `triggerRef` 用于关闭后的焦点恢复。
- 默认 selector 会选择最近的 Sheet/Dialog content；找不到容器时允许底层组件回退到默认 portal。禁止在业务代码中强制 portal 到 `document.body`。
- 自定义 selector 仅用于稳定、可复用且带明确 `data-slot` 的 overlay host，禁止依赖页面结构层级或临时 className。
- 本 hook 只解决 portal 归属和 trigger 引用，不替代 workspace 边界的页面失活关闭机制。

## Sheet/Dialog 表单检查项

- 必须提供 `SheetTitle` / `DialogTitle`；视觉上不展示时使用 `sr-only`，不得省略。
- 可滚动内容区使用 `min-h-0 flex-1 overflow-auto`，Footer 保持在内容区外。
- Sheet 统一不提供取消按钮，关闭操作由 Sheet 自身的 overlay 点击 / ESC 处理。
- 验证嵌套选择器的键盘导航、Escape 关闭、关闭后焦点恢复，以及 workspace 页面失活时浮层不会残留。
- 测试至少覆盖提交级校验、条件必填、禁用/加载状态、选项选择和关闭重置；远程选择器额外覆盖 debounce、分页追加与重复项去重。

## 提交与辅助技术

- 必填字段除可视标记外，还须向输入控件传递 `aria-required`。加载按钮应保持动作的可访问名称，并设置 disabled/aria-busy 阻止重复提交。
- `form.Form` 统一捕获提交 Promise 的拒绝；已由 Mutation 处理的错误不重复提示，其余错误使用安全归一化器。提交失败保留字段输入与浮层。

### 独立选择筛选触发器

业务版本选择等独立筛选可组合公开的 `DataTableFilterTrigger`（`components/data-table/filters/data-table-filter-trigger`）与 `SingleChoiceCombobox`，复用选中标签展示。其余 DataTable 内部筛选实现仍不对业务 feature 开放。

`CheckboxField` 支持受控 `checked/id/onCheckedChange`；旧上下文用法保留。显式 adapter 为 `TanStackCheckboxField`，`FormCheckboxField` 与 `form.CheckboxField` 公开接口继续兼容。

### 远程选项预加载

`useRemoteComboboxState` 默认仅在展开且未禁用时查询。需要提前加载首屏时显式传入 `preload: true`；`disabled` 始终优先，禁用时不自动请求。预加载模式关闭面板后恢复默认首屏并复用查询缓存，不在关闭状态加载后续页。未开启预加载的调用方保留关闭清空候选项的行为。
