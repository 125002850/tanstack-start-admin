# 开发工作流与规范维护

## 环境前置条件

- 应用根目录包含 `package.json`、`components.json` 和 `vite.config.ts`，命令从该目录执行。
- Node.js 与 pnpm 版本分别以 `package.json` 的 `engines.node`、`packageManager` 为准；依赖按 `pnpm-lock.yaml` 安装。
- npm 包源必须提供项目锁定的 `@oig/react-query-generator` 版本。团队镜像的部署默认值见根目录 `Dockerfile` 的 `NPM_REGISTRY`；开发环境按团队包源及凭证配置访问。
- 包源返回 404 时先核对实际请求地址、版本和访问配置。安装阶段失败不能视为 lint 或测试结果；不要通过降低生成器版本或改写锁文件绕过。pnpm 可能在执行脚本前自动同步依赖，因此也需要检查其安装日志。

当前包源可用以下只读命令查看；共享文档不记录认证 token：

```bash
pnpm config get registry
```

## 首次启动与生成产物

首次检出后使用 README 的快速开始步骤。`.env` 已存在时保留其值，环境字段的用途和默认值见根目录 `env.example.txt`。

| 产物                                                              | 生成入口                                    | 前置条件                                                 |
| ----------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `src/lib/api/clients/service/generated/` 与 `openapi/.generated/` | `pnpm codegen`                              | 依赖安装成功；已提交的 `openapi/specs/openapi.json` 可用 |
| `src/routeTree.gen.ts`                                            | `pnpm dev` 或 `pnpm build` 中的 Router 插件 | 路由源文件可用                                           |

这些产物由工具生成并被 Git 忽略。`typecheck` 和单元测试不会自动生成它们；干净检出后执行完整检查的顺序为：

```bash
pnpm install --frozen-lockfile
pnpm codegen
pnpm build
pnpm check
pnpm bundle:check
```

`pnpm codegen` 读取本地 spec，不需要后端运行。只有接口契约变化时才使用 `pnpm api` 从已运行的后端拉取并生成；请求地址、transport 和认证约束见[配置与 API](configuration-and-api.md)。应用实际登录和业务请求仍需可用的后端及正确代理配置。

## 验证范围

- `pnpm lint` 运行 OxLint、架构契约和文档校验；`pnpm check` 再执行类型检查与单元测试。
- 仅修改维护中文档或 skills 时，运行 `pnpm lint:docs`，检查变更文件格式，并按真实任务核对 skill 能否给出正确的目录、命令、API 和适用边界。
- 修改文档校验器时，运行 `pnpm exec vitest run scripts/validate-project-docs.test.mjs`；校验器检查项目操作规范、本地 skill 适配入口及 `UPSTREAM.json.localPatches` 声明的 Markdown 文件，包括相对文件链接、项目入口声明的 pnpm 脚本，以及 Vitest skill 与依赖的主版本。
- 校验范围内的本地相对链接统一使用 Markdown 行内链接；目标路径包含空格或括号时使用 `[说明](<path/file (draft).md>)`。引用式链接不属于当前校验器的支持范围，不得用于上述项目操作规范和适配入口。
- `docs/` 当前不属于 `lint:docs` 默认范围；其中 plans 和 reviews 是历史记录，由任务复盘和人工审查维护。
- 校验器不抓取外部链接、不检查锚点和生成产物，不读取未声明本地补丁的 vendored upstream 快照，也不判断规范语义是否冲突；这些仍需审查。
- UI、pointer、虚拟化与浮层行为的验证按对应 reference 选择浏览器回归。只报告实际执行且通过的检查。
- 接入方 CI 应复用上述生成与质量检查顺序。仓库的 `.gitlab-ci.yml.example` 继续作为部署模板，规范维护不自动启用部署流水线。

## 规范与 Skill 维护

- `AGENTS.MD` 保留全局硬约束，README 提供说明和索引，项目规则正文放在本目录。调整现有约束时同步删除失效的重复说明。
- 项目 skill 负责目录、公共 API 和约束；通用 skill 的模式与优化建议只应用于当前任务，不能扩大为无关重构。
- 引入外部 skill 时核对工作目录、包管理器、框架和版本；来源记录与本地适配说明分别保留。升级运行库时同步核对相关 skill，不能仅修改版本标签。
- Vitest、Vercel React、组合模式与 Web 设计 skill 的适用边界、来源记录及更新步骤集中在[外部 Skills 的项目适配](external-skills.md)。
- `skills-lock.json` 记录安装来源指纹，不代表本地维护内容未经修改；本地修复不伪造上游 hash 或改写来源。
