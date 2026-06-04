# TagsBar Drag Sort — 架构评审反馈

整体评分 **7.0/10**。核心架构决策是正确的，但有几个硬伤在实现前必须修。

---

## 做得好的地方（保持）

- visualOrder vs openedOrder 的解耦设计 — 纯视图层状态不污染 store，架构正确
- 首页从结构上排除在 sortable 集合外 — 比"可拖动但运行时禁止"可靠得多
- TDD 顺序（Task 1 护栏 → Task 2 实现 → Task 3 浏览器回归）— 标准
- reconcile 算法四步定义明确，可验证

---

## P0 — 必须补齐（否则我会坚持打回）

### 1. 无障碍 (a11y) 完全缺失
Spec 和 Plan 都没有提到：
- dnd-kit 的 Announcements API —— 屏幕阅读器用户拖完标签不知道发生了什么
- Ghost 占位是否需要 aria-hidden
- 排序后 aria-posinset / aria-setsize 的更新
- 标签栏是高频交互区域，没有 a11y 设计在合规审计中会被直接打回

### 2. suppressClickRef 机制未详述
"拖拽结束后抑制 click 导航"是整个交互中最容易出 bug 的地方。Plan 提到了 suppressClickRef，但没有说清楚：
- 用什么标记？（ref boolean？pointer 移动距离？时间窗口？）
- 什么时候 reset？
- 如果用户在 drag end 后 50ms 内又点了一次怎么办？

这个实现不好，用户会感知到"有时候点了没反应"。

### 3. reconcile 竞态条件未处理
如果用户在拖动过程中（手指还没松），store 因为 closeOther 或其他操作更新了 openedOrder——reconcile 和 drag end 的执行顺序会导致 visualOrder 进入不一致状态。Spec 需要定义这个场景的行为。

---

## P1 — 强烈建议

### 4. 自动滚动欠规范
Spec 只说"靠近边缘时自动滚动"，但没有：
- 激活区宽度
- 速度曲线
- 是 dnd-kit 的 autoScroll 还是自定义？
- 与 ScrollArea 嵌套的兼容性

### 5. 缺少集成测试层
测试策略是 RTL 单元 → Playwright 浏览器，中间缺了一层组件集成测试。dnd-kit 的 pointer 序列在 RTL 里可以模拟——完全跳过这一层意味着很多边界情况只能等 Playwright 发现，反馈循环太慢。

### 6. e2e 中的 waitForTimeout(220) 在 CI 环境不够可靠
建议暴露 LONG_PRESS_DELAY_MS 为可配置常量，测试环境用更短的 delay，或者用 data-test-* 钩子标记"已进入长按就绪态"。

---

## P2 — 锦上添花

### 7. Task 依赖关系显式声明
Task 0→1→2→3 是严格线性的，应该在每个 task 头部声明 dependsOn

### 8. 增加回滚/放弃策略
什么情况下应该放弃 dnd-kit 方案？回退到什么状态？

### 9. 引用 kanban.tsx 的具体可复用模式
用表格列出"kanban 中的 X 模式 → TagsBar 中的 Y 应用"，减少实现者推断成本

---

总结：设计方向没问题，但在生产就绪之前，P0 三项必须在 spec/plan 中补齐。特别是 a11y——这不是 nice-to-have，标签栏是核心导航组件。
