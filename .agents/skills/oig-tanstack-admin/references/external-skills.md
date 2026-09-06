# 外部 Skills 的项目适配

使用下列 skill 时，先读取对应章节，再按当前任务选择上游规则。项目真实配置、公共 API 和本目录的约束优先；上游示例与优先级标签不构成扩大改动范围的要求。

## vitest

- 本次适配验证使用 Vitest **4.1.10**；实际版本以 `package.json`、锁文件和已安装依赖为准。skill 的上游提交与运行库版本分别记录，不能把 skill 标签当作库版本。
- 从应用根目录执行 `pnpm test:unit <测试文件>`，按需使用 `-t` 筛选用例；持续 watch 仅在任务需要时启用。上游的 `nlx` 示例按仓库现有 pnpm 脚本执行，环境前置条件见[开发工作流](development-workflow.md)。
- 先读取根目录 `vitest.config.ts`、`src/test/setup.ts` 和相邻测试。当前使用独立 Vitest 配置，默认 `jsdom`、显式导入 `vitest` API，并在测试配置中声明 React 插件和 setup；不能假设自动继承 `vite.config.ts`。需要 Node 环境的单个测试文件可使用 `// @vitest-environment node`。
- 复用既有 mock 清理、DOM 测试工具和测试目录。不因通用示例新增 globals、projects、coverage provider 或重写运行配置；这些调整必须来自实际测试需求。
- Vitest 4 的对象选项放在第二参数；**4.1.10 仍支持数字型第三参数 timeout**，移除的是第三参数的对象选项写法。新示例优先采用第二参数对象，存量数字 timeout 不需要批量迁移。
- 用有意义的测试验证行为，记录实际执行的命令与结果。报告语言和格式遵循用户要求与项目规范，上游固定标题或表格模板只作参考。

## vercel-react-best-practices

- 当前项目是 **Vite + TanStack Router 的 React SPA**。先定位具体性能或行为问题，只读取相关规则；不能按优先级清单批量重构。
- `server-*`、RSC、Server Actions、SSR/hydration 等规则仅适用于存在相应链路的代码，当前常规页面不套用这些实现。
- 懒加载复用 Router 的自动代码分割、`React.lazy` 和动态 `import()`；`next/dynamic` 示例用于理解模式，不据此引入 Next.js。
- 服务端数据缓存和请求去重复用 TanStack Query；SWR 示例不构成增加平行数据层的依据。
- 按需导入遵守[公共入口与目录约束](project-structure.md)、[配置与 API](configuration-and-api.md)以及 [DataTable 规范](data-table.md)，不能为了消除 barrel import 删除项目公共入口。

## vercel-composition-patterns

- 组合模式用于解决当前组件的复用、状态归属或多种业务模式问题；局部 prop 修复只调整必要调用点。
- `disabled`、`open`、`isLoading` 等独立状态属性可以保持布尔值。只有多个开关共同表达互斥业务模式并造成复杂分支时，才评估组合或判别联合。
- 保留现有公共契约，包括[路由规范](routing-and-navigation.md)中的 `WorkspacePageRoute.render`、[DataTable 列 DSL](data-table.md)和[受控表单接口](forms.md)。组件库要求的 render prop、传递数据的渲染回调或执行时机明确的回调不属于统一清理对象。
- React 19 支持 ref prop 和 `use()`，既有 `forwardRef`、`useContext` 仍是有效用法；不能仅因存在这些 API 而判为缺陷或要求迁移。新代码按实际需求与兼容性选择。
- 上游的 “Don't add boolean props”“children over render props”“no forwardRef” 在本仓库按以上边界理解，不是全仓库重构指令。

## web-design-guidelines

- 按上游入口的工作流，每次审查读取完整的 [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)。本节补充项目约束，不替代上游规则。远端规则会更新，审查时记录实际读取的来源；无法获取时明确说明覆盖限制。
- 范围由用户指定的页面、组件、文件或当前 diff 决定；已有上下文足以定位时直接检查，确实缺少范围时再询问。具体 UI 问题不扩展为全站改版。
- 表单标签、提交级校验、禁用条件、失败保留输入与关闭重置按[表单规范](forms.md)检查；布局、滚动归属、语义 token 和共享组件按 [UI 规范](ui-components.md)检查；拖拽与 pointer 竞争按[交互规范](drag-and-pointer-interactions.md)检查。
- 嵌套 Sheet/Dialog 选择器需验证键盘操作、Escape 层级、焦点恢复及 workspace 失活后的浮层清理。复用既有 Portal 和生命周期接口；业务代码不强制 Portal 到 `document.body`，也不重复实现基础组件已经封装的逻辑。
- 检查窄视口、长文本、缩放、软键盘下的滚动和操作可达性，并区分首次加载、缓存刷新、空态、错误与重试。上游的 URL 状态或按钮禁用建议先核对项目约束，例如 DataTable 不默认同步 URL，表单依赖不可用时按项目规则禁用提交。
- 静态代码检查与浏览器验证分别说明。焦点、pointer、滚动和虚拟化需要实际浏览器证据；发现项包含文件位置、触发场景、影响与最小修复建议，输出格式遵循用户要求。

## 来源与更新

- 四个 skill 保留上游目录结构；[Vitest](../../vitest/UPSTREAM.json)、[React 性能](../../vercel-react-best-practices/UPSTREAM.json)、[组合模式](../../vercel-composition-patterns/UPSTREAM.json)与[Web 设计](../../web-design-guidelines/UPSTREAM.json)的 `UPSTREAM.json` 分别记录来源仓库、固定提交、Git tree SHA、安装指纹和本地补丁文件。
- 根目录 `skills-lock.json` 的 `computedHash` 是安装时未经项目修改的上游目录指纹。项目适配后内容可以与该指纹不同；不要用修改后的目录重新计算并冒充上游指纹。
- 更新时先核对固定提交的完整文件和安装指纹，再重放记录中的入口链接、事实修正等必要补丁；确认旧 references 已整体替换且其他 skill 锁条目保留。更新 skill 不附带升级应用依赖。
- 使用 `skills update` 或重新安装会覆盖本地补丁；执行前备份，完成后恢复适配入口并重新检查来源、链接、示例 API 和真实使用场景。验证入口见[开发工作流](development-workflow.md)。
