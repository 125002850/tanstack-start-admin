# 项目结构与组件归属

## 主目录

```text
src/
├── assets/                  # 由模块导入的静态资源
├── routes/                  # TanStack Router 文件路由与 route metadata
│   ├── __root.tsx           # provider、主题与文档壳
│   ├── index.tsx            # 入口跳转
│   ├── about.tsx            # 公开关于页
│   ├── privacy-policy.tsx   # 隐私政策
│   ├── terms-of-service.tsx # 服务条款
│   ├── auth.tsx             # 认证布局
│   ├── auth/                # 登录、注册兼容入口
│   ├── dashboard.tsx        # SSO loader 与 dashboard 布局壳
│   └── dashboard/           # dashboard 业务路由
│       ├── elements/
│       ├── examples/
│       ├── forms/
│       └── system-management/
├── components/              # 跨 feature 共享组件
│   ├── ui/                  # Shadcn / 设计系统基础组件
│   ├── data-table/          # DataTable 共享子系统
│   ├── dictionary/          # 字典 scope 与内存映射基础设施
│   ├── forms/               # 共享表单组合与字段组件
│   ├── layout/              # 应用布局与 tags bar
│   ├── modal/               # 共享 modal 组合
│   ├── themes/              # 主题组件
│   └── kbar/                # Command+K
├── features/                # 按业务能力组织的页面、组件、API 与状态
│   ├── auth/                # SSO 禁止访问与认证页面组合
│   ├── chat/                # 聊天演示
│   ├── dictionaries/        # 字典管理
│   ├── elements/            # UI 能力示例
│   ├── export-center/       # 导出中心
│   ├── forms/               # 表单示例
│   ├── kanban/              # 看板演示
│   ├── notifications/       # 通知中心
│   ├── overview/            # dashboard 概览
│   └── workspace-tabs/      # 工作区页签运行时
├── hooks/                   # 跨 feature 的状态编排 hook
│   └── use-data-table/      # DataTable 状态、DSL 与编辑运行时
│       └── columns/         # 列状态与能力编排
├── config/                  # 环境与特性配置
├── constants/               # 静态示例数据与常量
├── lib/                     # 无 UI 的跨 feature 共享运行时与纯算法
│   ├── api/                 # API transport、SSO 会话与 generated client 适配
│   │   ├── clients/service/ # OpenAPI 生成客户端与 adapter
│   │   └── sso/             # SSO bootstrap、session、headers、queries
│   ├── browser/             # 浏览器 DOM 与 runtime helper
│   ├── data-table/          # DataTable 纯算法与状态持久化
│   ├── formatters/          # 日期、数字和展示格式化
│   └── router/              # 路由元数据、守卫与导航算法
├── styles/                  # 全局样式与主题 token
│   └── themes/              # 主题变量
├── test/                    # 跨子系统测试基础设施
│   ├── contracts/           # 架构、OpenAPI adoption 等项目级契约
│   ├── fixtures/            # 项目级共享测试输入
│   ├── lint/                # lint 自测试输入
│   └── smoke/               # 冒烟测试
└── types/                   # 跨层共享类型契约
```

## DataTable 子系统

```text
src/components/data-table/
├── actions/                 # 顶层操作、选择操作和行操作
├── cells/                   # 通用展示 cell
├── columns/                 # 稳定列入口、列标签及其契约测试
│   ├── dsl/                 # 列 builder、options、formatter、type registry
│   └── header/              # 可排序/筛选列头与 resize handle
├── core/                    # DataTable 壳、表头/表体与能力装配
│   └── body/                # 普通/虚拟表体与共享 cell 渲染
├── dnd/                     # 列拖拽
├── editing/                 # 单元格编辑子域
│   ├── adapters/            # 列类型到 editor/codec 的适配
│   ├── batch/               # 粘贴、填充等批量编辑计划
│   │   └── fixtures/        # 批量编辑测试输入
│   ├── cells/               # editable cell 与键盘交互
│   ├── choice/              # 选项值模型、展示、编辑器与远程查询
│   ├── codecs/              # 编辑值解析、校验与格式化
│   └── runtime/             # 跨页草稿、错误、提交与编辑 session
├── expand/                  # 展开分屏
├── export/                  # 导出交互
├── feedback/                # loading、empty、error 状态
├── filters/                 # 工具栏筛选与表头本地 Set Filter
├── selection/               # 区域选择、剪贴板、填充与交互编排
├── toolbar/                 # 工具栏与列面板
└── virtualization/          # 行列虚拟化

src/hooks/use-data-table/    # TanStack Table 状态装配、服务端 DSL、编辑、本地筛选与持久化
src/config/data-table*.ts    # 全局开关、尺寸 preset、消息
src/lib/data-table/          # 非 React 的共享算法与持久化
src/types/data-table.ts      # 跨层公共类型和 TanStack module augmentation
```

## 归属规则

- `components/ui` 保留基础组件和稳定的低层设计系统能力；新建完整子系统、页面组合或 feature 专属组件时禁止继续塞入该目录。
- 跨多个 feature 复用且拥有独立运行时、目录或测试矩阵的能力放入 `components/<subsystem>`；DataTable 固定使用 `components/data-table`。
- 只服务单一业务域的组件放入对应 `features/<feature>`。只有出现稳定的跨 feature 复用后才上移到 `components`。
- route 文件只负责路由、metadata 和页面边界；业务查询、交互与布局组合下沉到 feature。
- `hooks` 负责共享状态编排，`lib` 负责无 UI 的跨 feature 运行时与纯算法，`types` 只放跨层契约；禁止用任一目录作为无法归类代码的兜底。
- `lib` 禁止放置 JSX、可渲染组件或仅服务单一 feature 的工具；前者归入 `components`，后者归入对应 `features/<feature>/lib`。同一子系统存在多个稳定模块时使用 `lib/<subsystem>/`，禁止继续扩展根目录同前缀平铺文件。
- 项目级架构、边界和 adoption 契约测试统一放入 `src/test/contracts/`；模块行为测试继续与实现同目录放置。
- 模块级 fixture 必须跟随唯一消费者放置；例如 DataTable 矩阵粘贴输入固定放在 `editing/batch/fixtures/`，只由相邻测试导入，不属于生产资源，也不得回迁到历史计划或评审目录。
- 只被单一 feature 或共享子系统消费的 hook 必须与消费者同层放置；只有稳定跨 feature 复用的状态编排才放入顶层 `hooks`。
- 搬迁公共入口时一次性更新源码、测试和有效文档，删除旧入口；禁止增加兼容转发、同名 alias 或新旧路径双写。
