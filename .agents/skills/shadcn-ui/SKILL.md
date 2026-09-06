---
name: shadcn-ui
description: 在本仓库新增、修复或审查 shadcn/ui 组件、主题和 registry 内容时使用；提供应用根目录、pnpm 命令、本地组件覆盖规则及 vendored 参考入口。
---

# Shadcn UI 项目适配

## 项目上下文

应用根目录就是包含 [package.json](../../../package.json) 与 [components.json](../../../components.json) 的仓库根目录。包管理器以 `packageManager` 为准；当前使用 pnpm。组件别名、图标库和样式配置从 `components.json` 读取，实际组件 API 从 `src/components/ui/` 核对。

本仓库使用 TanStack Router SPA。Radix 与 Base UI 的具体 API 以目标组件 import 为准，不能仅凭项目级检测结果推断所有组件。

## 使用顺序

1. 先读取当前任务对应的[项目规范入口](../oig-tanstack-admin/SKILL.md)，UI 任务同时读取 [UI 组件与本地覆盖规则](../oig-tanstack-admin/references/ui-components.md)。表单、浮层、业务表格按入口路由读取相应 reference。
2. 检查已有组件与调用点，优先复用本地 API；例如 Button 的 loading、图标 lookup 与尺寸规则均由项目 reference 定义。
3. 需要查询 registry 或上游组件文档时，在应用根目录执行以下命令，并读取 `docs` 返回的文档 URL：

```bash
pnpm dlx shadcn@latest info --json
pnpm dlx shadcn@latest docs button sheet
```

4. 新增或更新组件前，按 [vendored CLI](vendor/shadcn/cli.md) 使用预览和 diff 核对影响；保留本地扩展及公共 API，避免把上游文件直接覆盖进项目。
5. 上游示例中的 runner 根据本仓库 `packageManager` 替换。运行安装、更新或 preset 命令的范围仍由用户当前任务决定。

## 按需参考

| 任务                 | 参考                                                  |
| -------------------- | ----------------------------------------------------- |
| 上游工作流和组件选择 | [vendored skill](vendor/shadcn/SKILL.md)              |
| CLI、查询与更新      | [CLI](vendor/shadcn/cli.md)                           |
| 主题与 token         | [定制](vendor/shadcn/customization.md)                |
| MCP                  | [MCP](vendor/shadcn/mcp.md)                           |
| 表单组合             | [Forms](vendor/shadcn/rules/forms.md)                 |
| 组件组合             | [Composition](vendor/shadcn/rules/composition.md)     |
| 底层库的不同 API     | [Base 与 Radix](vendor/shadcn/rules/base-vs-radix.md) |

项目 reference 的显式覆盖规则优先于 vendored 规则。上游快照来源与版本保留在 [UPSTREAM.txt](vendor/shadcn/UPSTREAM.txt)；本文件只维护本仓库适配，不改写上游来源。
