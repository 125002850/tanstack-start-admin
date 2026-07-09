---
name: oig-tanstack-admin
description: oig tanstack admin 团队开发规范与任务路由。分析、设计、修改或审查本仓库代码，处理 React 页面、Shadcn UI、表单、SearchCombobox、overlay portal、Card、PageContainer、DataTable、路由导航、workspace tabs、环境配置、OpenAPI/API transport，或创建 Git 提交时使用。
---

# Oig Tanstack Admin

## 核心原则

只加载当前任务相关的 reference，并以仓库真实代码和配置为最终依据。reference 中的“必须”“禁止”“统一”等要求属于仓库开发约束。

## 工作流程

1. 读取 `AGENTS.MD` 的全局硬约束。
2. 根据任务类型读取下表中的 reference；任务跨领域时读取所有相关项。
3. 修改前检查现有实现并优先复用，禁止仅依据 reference 臆造文件、命令或 API。
4. 修改后运行与变更风险相匹配的 lint、类型检查、测试或构建。
5. Git 提交前读取 `references/git-commits.md`，并执行 commitlint。

## Reference 路由

| 任务                                                                      | 必读文件                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Card、图标、页面布局、PageContainer、Management 页面                      | `references/ui-components.md`                                         |
| DataTable、服务端分页、虚拟化、审计字段列                                 | `references/data-table.md`                                            |
| 新增或修改表格页面                                                        | `references/data-table.md`、`references/ui-components.md`             |
| TanStack Router、route metadata、侧边栏、KBar、breadcrumb、workspace tabs | `references/routing-and-navigation.md`                                |
| 新增 dashboard 内容页                                                     | `references/routing-and-navigation.md`、`references/ui-components.md` |
| 表单、字段校验、Sheet/Dialog 表单、SearchCombobox、overlay portal         | `references/forms.md`                                                 |
| 环境变量、配置中心、请求头、OpenAPI、API transport                        | `references/configuration-and-api.md`                                 |
| Git commit、提交标题、commitlint                                          | `references/git-commits.md`                                           |

## 与其他 Skill 的关系

- 涉及 Shadcn UI 时，同时使用仓库的 `shadcn-ui` Skill。
- 涉及 React/性能时，同时使用 `vercel-react-best-practices`。
- 涉及组件 API 设计或布尔 prop 膨胀时，同时使用 `vercel-composition-patterns`。
- 涉及 Vitest 测试时，同时使用 `vitest`。

本 Skill 定义仓库特有约束；通用 Skill 不得覆盖这些约束。

## 常见错误

- 不要为了“完整了解项目”一次性读取全部 references。
- 不要把 `docs/plans/` 中的历史设计当作当前约束；实现与本 Skill 冲突时先核对现有代码。
- 不要在 README、AGENTS.md 和 reference 中复制同一规范；规范正文只维护在 reference。
- 可由 lint、hook、测试或 CI 强制的规则，必须继续保留机器校验，不能只依赖 Skill。
