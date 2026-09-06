# 项目规范与 Skills 校准实现计划

**目标：** 修复架构审查确认的文档冲突、跨项目残留和版本漂移，使当前仓库的开发入口可直接执行。

**实现方式：** 保留现有应用分层与公共 API；项目约束集中在 `oig-tanstack-admin/references/`，README 提供入口和首次启动步骤。通用 skill 明确本仓库适用范围；增加独立的文档契约校验，不升级依赖。

**技术栈：** Markdown、Node.js 内置文件 API、Vitest 4.1.10。

## 任务与文件

1. **文档契约校验**
   - 新增 `scripts/validate-project-docs.mjs` 与同目录行为测试。
   - 校验维护中文档的相对链接、项目命令和 Vitest skill 声明的主版本。
   - 在 `package.json` 增加 `lint:docs` 并接入现有 lint 流程。
2. **项目入口与初始化**
   - 将 README 重复的 UI、路由、配置规范改为 reference 索引，迁移仍有效且唯一的 IAM 约束。
   - 在 `references/development-workflow.md` 说明包源前置条件、本地 codegen、路由树生成和验证顺序。
   - 保留现有 Docker 的 codegen/build 顺序与部署模板策略。
3. **Skills 本地适配**
   - 修复 shadcn 工作目录与 pnpm runner，链接本地覆盖规则。
   - 修正组合模式入口、编译文档和 React 19 规则，保留局部修复与兼容边界。
   - 为 React 性能指南限定 SPA / React Query 的适用范围。
   - 校准 Vitest 入口、过期 reference 示例与来源记录。
   - 将设计规范占位入口替换为可以直接执行的审查指引。

## 验证

- 先运行新校验器的行为测试，确认缺失实现时失败；实现后覆盖相对链接、代码示例隔离、命令识别和版本差异。
- 执行 `pnpm lint:docs`、相关 Vitest 测试、OxLint 与变更文件格式检查。
- 独立代理按相同使用场景复核修改后的 skills，验证能正确选择命令、配置和任务边界。
- 依赖源与生成产物就绪后按文档执行 codegen、build、check；若环境仍阻塞，记录具体失败与已经通过的验证范围。

## 实现状态

- 状态：进行中。
- 依赖关系：完整应用验证需要可访问的 `@oig/react-query-generator@5.0.0` 包源；文档校验与现有本地测试工具可独立运行。

### Update (2026-09-05)

- 实现状态：计划中的文档、skills 与 `lint:docs` 修复已完成；未修改应用源码、依赖声明、锁文件或 Vitest 运行时配置。使用现有本地工具验证了 117 份文档、7 个文档校验用例和 24 个架构契约用例，OxLint 零错误、零警告；变更入口及新增文件格式、6 个 skill 元数据和差异空白检查通过。独立代理复核的 4 个场景通过，范围是指引可用性，不包含浏览器交互验证。
- 依赖关系：完整 codegen/build/check 仍依赖可访问的生成器包源；当前请求 `@oig/react-query-generator@5.0.0` 返回 404。pnpm 在脚本执行前尝试同步依赖，因此本次检查直接调用已安装的 Node、Vitest 和 OxLint；没有将依赖安装失败报告为应用验证通过。包源恢复后按开发工作流执行完整检查。

### Update (2026-09-06)

- 实现状态：按后续确认的[上游安装计划](2026-09-06-upstream-skills-installation.md)，Vitest 的旧 references 手工修正和 Web 设计的本地摘要已由固定提交的完整上游 skill 替换；React 性能与组合模式同步到 Vercel 官方来源。四项的项目适用边界集中到 `oig-tanstack-admin/references/external-skills.md`，入口保留适配链接，来源及必要补丁由 `UPSTREAM.json` 和安装锁记录。文档校验已收敛为 21 份项目操作规范、本地 skill 适配入口及已声明补丁，33 个相关用例、OxLint、Vitest 4.1.10 关键示例及 6 个独立使用场景复核通过。
- 依赖关系：本次仅更新 skill 来源锁，不升级应用依赖；完整应用验证的生成器包源前置条件保持不变。
