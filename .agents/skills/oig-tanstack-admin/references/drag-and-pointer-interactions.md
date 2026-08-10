# 拖拽与 Pointer 交互规范

## 模式选择

- 同一主表面同时承担点击和排序时，直接把该表面作为拖拽 activator，并使用 `@/hooks/use-dnd-click-drag-sensors` 按移动距离区分点击与拖拽。不要默认增加独立拖拽手柄。
- 主表面内存在关闭、筛选、更多操作等次级动作时，将它们实现为与主表面平级的原生 `button`，并从拖拽激活范围排除。禁止嵌套交互元素。
- 只有拖拽不应覆盖整个表面、用户需要明确排序入口时才使用独立手柄。例如列显示面板保留显式手柄和自己的阈值。
- 纯拖拽画布或 Kanban 不需要点击/拖拽共面策略，不要为了统一 API 强制迁移。

## 共享 Hook 边界

- 对点击/拖拽共面场景复用 `useDndClickDragSensors()`；禁止在各组件重复声明 mouse distance、touch delay、touch tolerance 或非触摸 `PointerSensor`。
- 默认使用鼠标移动距离 `10px`、触摸长按 `250ms` 和触摸容差 `5px`。只有交互密度或设备特征有明确差异时才通过 Hook options 覆盖，并补回归测试。
- 只让共享 Hook 管理 dnd-kit sensor 与激活阈值。将 overlay、可拖拽目标过滤、排序状态和组件库事件适配保留在所属子系统。

## Radix 浮层竞争

当 `DropdownMenuTrigger`、`PopoverTrigger` 等 Radix Trigger 与拖拽共用主表面时：

1. 使用受控 `open` 状态。
2. 在 trigger 的 `pointerdown` 阶段阻止 Radix 立即打开浮层，在 `click` 阶段切换浮层。
3. 在 capture 阶段让 dnd-kit activator 先观察 `pointerdown`，避免 Radix 的 `preventDefault()` 截断拖拽初始化。
4. 允许承担主表面点击的 trigger 发起拖拽，同时继续排除其中其他 `button`、`input`、`select`、link、menu item 等交互目标。主表面用专属标记属性（如 `data-column-header-drag-surface`）显式声明，排除逻辑查该标记，禁止硬编码具体浮层组件的 `data-slot` 命名。

不要把 Radix 的事件桥接塞进 `useDndClickDragSensors`。不要用 suppress-click timer 模拟手势状态；拖拽超过阈值后由 dnd-kit 负责阻止后续 click。

## 可访问性

- 为次级原生按钮提供可辨识的 accessible name、键盘焦点和足够点击区域。
- 为可拖拽主表面保留既有点击与键盘语义；不要因拖拽改造移除 `button`、`tab` 或 header 的语义。
- 使用 `cursor-grab` / `cursor-grabbing` 表达可拖拽状态，但不要把光标作为唯一提示。

## 验证

- 用 Vitest 验证共享 Hook 的默认阈值、覆盖参数和 pointer 激活过滤。
- 用真实 Playwright 指针覆盖：普通点击不拖拽、移动超过阈值只拖拽不点击、次级控件不发起拖拽、拖拽期间和结束后不误开浮层。
- 涉及触摸策略变更时补触摸或等价移动端回归。不要仅凭 jsdom 断言 pointer 竞争正确。
