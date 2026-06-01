# 流程优化提案（基于 V2-04 审计发现）

**From:** 资深工程师（独立审计）
**To:** 总工程师/项目经理 (%14)
**Based on:** writing-plans v4.1.0 + executing-plans v2.4.0 + dag-runtime.md

---

先确认：这次 V2 plan 严格遵循了 spec/ immutable、runtime/ mutable、reviews/ gate decisions 的契约，目录结构也完全符合 folder plan 模板。以下 4 点流程改进建议，每个都标注了触发事件和 skill 依据。

---

## 提案 1：task spec 的 acceptance criteria 写死 executor 自跑验证命令

**触发事件：** V2-02A 五轮 review，每一轮协调端独立跑 vitest + build 都通过，但问题仍然存在（hook-order → render setState → stale snapshot → SSR → identity-switch）。executor 只跑了改动的那个测试，没跑全量矩阵。

**依据：**

- writing-plans v4.1.0：`include exact commands for verification whenever possible; include expected pass/fail signals`
- executing-plans v2.4.0：verification 必须在当前 session 新鲜执行，`an agent's self-report is not evidence`

**建议：**

- task spec 的 acceptance criteria 写死具体文件列表命令，不只写"vitest 通过"
- task log 模板增加字段：`executor self-verification: <exact command> -> <result>`，不允许模糊表述
- coordinator 的独立验证是"复核"，不应该是"首次执行"

---

## 提案 2：E2E smoke 骨架前置到第一个实现任务

**触发事件：** V2-04 才跑 Playwright，发现 ALL_PROXY 劫持、选择器不匹配、hidden DOM 误命中——这些问题在代码落盘后存活了 2-3 个 task 才暴露。

**依据：**

- writing-plans：migration 类型任务需要 dry-run plus rollback path，但 rollout smoke 不应等到 migration 阶段才第一次执行
- dag-runtime.md：replan 触发条件包括 acceptance criteria are impossible as written——如果 V2-01 就跑了 smoke，环境问题会立刻触发 replan

**建议：**

- 当 plan 包含浏览器级验收时，第一个实现任务搭建 smoke 骨架（2-3 个核心场景），后续任务增量扩展
- 这是环境可行性的 early probe，不是把 V2-04 的工作量前移

**请评审：** 这个会不会与 task 独立性原则冲突？smoke 骨架该放在 V2-01 还是作为独立 infra task？

---

## 提案 3：增加跨切面静态审计作为 gate 条件

**触发事件：** keepAlive=false x closeGuard 语义冲突在 V2-03 review 中被定性为"可接受的内存权衡"，到 V2-04 才暴露。每个 task review 只检查本任务文件集合，没有人做 keepAlive x dirty/closeGuard 矩阵扫描。

**依据：**

- dag-runtime.md gate rules：通过条件包括 verification strategy completed 和 acceptance criteria met——V2-03 的 acceptance criteria 没要求检查 keepAlive 与 lifecycle 的交叉一致性
- writing-plans：task 必须有 invariants that must remain true——V2-03 的 invariant 是"所有页面默认进入 Activity shell"，但没人验证 closeGuard 消费者是否真的在 Activity shell 里存活

**建议：**

- 当多个 task 修改了共享维度（keepAlive、closeGuard、closable 等），在所有上游 task gate 通过后、下游 task 启动前，coordinator 执行一次 cross-cutting audit
- 形式：矩阵表 + 异常标注，不是重文档
- 可以写成 dag-runtime.md gate rules 的一条新规则

**请评审：** cross-cutting audit 应该由 coordinator 执行还是由 agent 执行？

---

## 提案 4：review 的 residual risk 条目必须包含四个必填字段

**触发事件：** task-v2-03-review.md 写了"residual risk: $productId 仍是 keepAlive=false 例外，后续评估"，但没有写这个风险阻塞了哪个后续任务、在哪个 task 验收。结果在 V2-04 变成了 blocker 但没人提前预期到。

**依据：**

- writing-plans 质量规则：禁止 TBD/TODO/implement later 等占位符
- dag-runtime.md："blocks downstream work until upstream gates pass"——但如果 risk 没有明确 blocks 谁，coordinator 无法判断是否应该 block

**建议：** review 模板 residual risk 条目改为：

```
- Risk: <描述>
- Blocks: <task ID 或 "none">
- Acceptance for closure: <可验证的条件>
- Deadline task: <哪个 task 必须验收>
```

缺字段视为 incomplete review，gate 不放行。

---

## 待讨论

1. 提案 2（smoke 前置）会不会与 task 独立性原则冲突？
2. 提案 3（cross-cutting audit）应该由 coordinator 还是 agent 执行？
3. 这四个提案中你是否有反对或需要修改的？

## Coordinator Response (2026-05-27)

结论：4 个提案都采纳，但按“减少 token、避免流程变重”的目标做收紧，不原样照搬。

### 对 3 个待讨论问题的答复

#### 1. 提案 2 是否与 task 独立性冲突？

不冲突，但不应该直接塞进第一个业务实现 task。

- 采纳方式：新增一个独立的 `preflight / infra smoke` task，放在第一个功能 task 之前。
- 职责边界：它只验证环境可行性、server 启动、代理变量、关键 selector、最小 SSR/CSR 健康，不承担完整业务验收。
- 原因：如果把 smoke 骨架并入 `V2-01` 之类的业务 task，executor 会同时负责产品实现和测试基建，任务边界会变混，后续 reopen 也不容易定责。

建议写法：

```md
Task P0: Browser Preflight Smoke

- Type: infra
- Goal: 建立后续 browser gate 的最小可运行入口
- Acceptance:
  - `bunx playwright test e2e/<spec>.spec.ts --grep "@preflight"` -> PASS
  - 本地 server 启动、核心页面加载、关键选择器命中、NO_PROXY/ALL_PROXY 不阻断
- Non-goals:
  - 不验证业务状态迁移正确性
  - 不替代 rollout/regression smoke
```

#### 2. 提案 3 应该由 coordinator 还是 agent 执行？

所有权必须在 coordinator，执行可以委派给独立 agent。

- coordinator 负责：
  - 定义 audit 触发条件
  - 定义审计矩阵维度
  - 判定 gate 是否放行
- 独立 agent 负责：
  - 按矩阵扫描代码、测试、route metadata、runtime 结论
  - 提交证据和异常项

不建议让上游实现者自己做 cross-cutting audit 并自判通过；这会把 gate 降级成自证。

#### 3. 这四个提案中是否有反对或需要修改的？

没有反对项，但建议做以下修改后再固化：

- 提案 1：保留“写死验证命令”的方向，但实现成 `verification profile`，不要让每个 task 手写长命令串。
- 提案 2：改成独立 `infra` task，而不是并入首个业务 task。
- 提案 3：增加明确触发规则，避免每个 plan 都机械性加 audit gate。
- 提案 4：`residual risk` 必填字段保留，但建议补 `Owner`；没有 owner 的 risk 仍然容易悬空。

### 采纳后的规则收口

#### 提案 1：Acceptance criteria 改为引用 verification profile

采纳，且按以下规则落地：

- task spec 不再只写“vitest 通过”或“build 通过”。
- 每个 task 必须给出精确验证入口：
  - 直接命令；或
  - `verification profile` 名称 + 命令列表。
- executor 回传必须包含：
  - `executor self-verification`
  - `exact command`
  - `result`

推荐格式：

```md
## Verification Profile

- `profile: v2-03-route-contract`
  - `bunx vitest run src/features/workspace-tabs/components/workspace-routing.integration.test.tsx src/features/workspace-tabs/hooks/use-workspace-page.test.tsx`
  - `bunx vitest run --exclude 'e2e'`
  - `bun run build`
```

这样既满足“命令写死”，也避免 task 文档反复复制一整段命令。

#### 提案 2：Browser smoke 前置为独立 preflight gate

采纳，触发规则如下：

- 当 plan 的最终 acceptance 包含浏览器级验收时，必须先有一个 `preflight smoke` task。
- 该 task 在第一个业务实现 task 前完成并过 gate。
- 后续 rollout/regression 任务只做场景扩展，不再第一次发现环境问题。

#### 提案 3：新增 cross-cutting audit gate

采纳，且只在满足以下任一条件时触发：

- `2+` 个 task 修改同一共享 runtime 维度，例如 `keepAlive / closeGuard / closable / route identity`
- 一个 task 的 residual risk 会改变下游 task 的验收语义
- 上游 task 分别通过，但系统级 invariant 需要跨文件或跨 feature 才能证明

输出形式保持轻量：

- 一张矩阵表
- 每项只写 `expected / observed / status / note`
- 不重写 spec，不写长 narrative

建议矩阵列：

```md
| Dimension                 | Expected Invariant                    | Evidence               | Status    | Note |
| ------------------------- | ------------------------------------- | ---------------------- | --------- | ---- |
| keepAlive x dirty form    | dirty form tag 切换后实例仍存活       | route metadata + smoke | pass/fail |      |
| closeGuard x close-other  | rejection 中止关闭并保焦点            | unit + e2e             | pass/fail |      |
| flag-off x provider chain | rollback 路径仍有 React Query context | SSR smoke              | pass/fail |      |
```

#### 提案 4：Residual risk 改成强约束模板

采纳，但我建议从“四字段”升级为“五字段”：

```md
- Risk: <描述>
- Blocks: <hard-block | soft-block | none>
- Owner: <coordinator / agent id / team>
- Acceptance for closure: <可验证条件>
- Deadline task: <task id / release gate>
```

解释：

- `Blocks` 不再写自由文本，避免 coordinator 重新解释语义。
- `Owner` 必填，否则 risk 很容易漂移到“大家都知道但没人收口”。
- `Deadline task` 必须是可定位的 gate，不能写“后续评估”。

### 建议纳入下一版流程基线的最小条目

如果只保留最有价值、最不增重的 4 条，我建议固定为：

1. 有 browser gate 的 plan，先建独立 `preflight smoke` task。
2. task acceptance 必须引用精确 `verification profile`。
3. 命中共享 runtime contract 时，插入 coordinator-owned `cross-cutting audit`。
4. `residual risk` 必须填写 `Risk / Blocks / Owner / Acceptance for closure / Deadline task`。

### 执行建议

这 4 条先作为本仓库 folder-plan 的默认约束使用，不必立刻扩写成通用大手册。下一次新 plan 直接按这套模板落地，再看是否需要进一步抽象进 `dag-runtime` 或团队公共 skill。
