# 上游 Skills 安装与项目适配计划

**目标：** 按用户确认的 skills.sh 候选替换四个仓库级 skill，保留可追踪的来源及必要项目约束。

**实现方式：** 在临时目录使用 skills.sh 官方 CLI 安装固定 Git 提交，再替换 `.agents/skills/` 下对应目录。上游文档保留原有结构；项目约束集中到 `oig-tanstack-admin/references/external-skills.md`，入口只增加适配链接。保留真实安装锁记录，使用 `UPSTREAM.json` 记录固定提交与本地补丁。

**工具：** Node.js、skills CLI、Git、现有 Vitest 4.1.10 与文档校验器。Python 安装辅助脚本因本机无可用 Python 解释器而由官方 CLI 替代。

## 安装来源

| Skill                         | 仓库与路径                                                  | 固定提交                                   |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `vitest`                      | `paulrberg/agent-skills` / `skills/vitest`                  | `23d7851a893533d44d8cb7a6c804f9d7d6528f9f` |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` / `skills/react-best-practices`  | `063bee94c3f4df8453406c830b0a7df0f2860278` |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` / `skills/composition-patterns`  | `063bee94c3f4df8453406c830b0a7df0f2860278` |
| `web-design-guidelines`       | `vercel-labs/agent-skills` / `skills/web-design-guidelines` | `063bee94c3f4df8453406c830b0a7df0f2860278` |

## 执行步骤

1. **暂存安装并保留回滚材料。** 在系统临时目录安装四个 skill，核对目录、文件和上游提交；备份当前四个目录与 `skills-lock.json`。不修改个人全局 skill、不执行应用依赖安装。
2. **替换上游内容。** 保持四个现有 skill 名称，完整替换 Vitest 的旧 references，避免新旧版本并存；合并 CLI 生成的四个锁条目，保留其他来源记录。
3. **保留必要项目适配。** 新增 `references/external-skills.md`，集中说明 pnpm/jsdom、SPA/Query、组件公共契约和设计审查边界；四个 `SKILL.md` 与两份编译版 `AGENTS.md` 链接该 reference。Vitest 入口声明验证过的运行库版本 `4.1.10`，修正数字型第三参数 timeout 的错误说明；保留 React 性能编译文档三个相对链接修复。
4. **验证与记录。** 校验上游快照与锁指纹，核对差异只包含记录的补丁；执行文档校验、行为测试、架构契约、OxLint、元数据及变更文件格式检查。独立代理检查使用场景并记录结果；更新本计划与前一计划的实现状态。

## 验收边界

- 应用源码、运行库版本、应用配置和 `pnpm-lock.yaml` 不属于本次改动。
- 设计 skill 按官方工作流读取完整的 `web-interface-guidelines/command.md`，项目补充不替代上游规则。
- 新 Vitest skill 的关键配置/API 在替换前已通过本地 4.1.10 类型核对；安装后的超时参数、更名后的 references 和命令入口需要再次核对。
- 原有应用 codegen/build 阻塞属于生成器包源问题，不能用本次文档验证声称应用完整构建通过。
- 当前工作区已有的评审 HTML 和 `learning/` 内容保留。

## 实现状态

- 状态：进行中。
- 依赖关系：需要 GitHub 与 npm 公共源下载 skill/CLI；现有本地测试工具不依赖应用生成器包源。

### Update (2026-09-06)

- 实现状态：四个 skill 已按表中固定提交替换，保留 97 个上游文件的目录结构；其中 90 个文件字节不变，7 个文件包含记录在 `UPSTREAM.json` 的项目入口或事实修正补丁。新增四份来源记录，更新四个安装锁条目，其他锁条目保持原值。Vitest 旧 references 和 `GENERATION.md` 已整体清除；项目适配集中在 `references/external-skills.md`。四个旧目录和原锁文件已保留于本次系统临时暂存目录的 `backup/`，被替换的旧目录另存于 `replaced/`。
- 实现状态：文档校验已收敛为 21 份项目操作规范、本地 skill 适配入口及 `UPSTREAM.json.localPatches` 声明的补丁文件，未修改的上游快照和 `docs/` 不进入项目 lint；9 个文档校验用例、24 个架构契约用例和 OxLint 检查通过。重新从安装后的 Vitest references 提取 11 个关键片段，补齐片段省略的 import 和共享 fixture 声明，并加入 2 个兼容性探针；13 项在本地 Vitest 4.1.10 下类型检查通过，4 个 CLI 参数解析通过。独立代理复核的 6 个使用场景、入口锚点、来源和完整补丁清单通过；验证范围不包含实际浏览器交互。
- 依赖关系：Git 克隆连接重置后，改由固定提交的 GitHub Tree/Blob API 获取快照，逐文件验证 Git blob SHA，再经兼容本地 Node 的 `skills@1.5.18` 从快照安装；安装指纹与原始完整目录一致。CLI 自动跳过的两份上游 `metadata.json` 已原样补回。应用源码、运行库版本、配置和 `pnpm-lock.yaml` 未改变；完整应用 codegen/build/check 仍依赖此前记录的生成器包源恢复，本次安装与文档验证不依赖该包源。
