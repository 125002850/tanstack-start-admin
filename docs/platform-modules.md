# 通用平台页面

回灌模块沿用 generated client、DataTable、workspace tabs 和字典 code 契约。

| 页面     | 路由                                 | 菜单键            |
| -------- | ------------------------------------ | ----------------- |
| 操作审计 | `/system-management/operation-audit` | `operation-audit` |
| 调度中心 | `/system-management/schedule-center` | `schedule-center` |

页面需要配套 `java-admin-starter` 的操作审计、调度增量迁移与 API。更新后端后，按 README 的 `pnpm api` 重新拉取契约；单独运行前端不会生成审计或执行任务。

- 审计页支持筛选、分页和脱敏详情。
- 调度页支持任务维护、启停、执行记录、操作记录及 Cron 预览；立即执行前需要确认。后端调用白名单和单实例运行边界见后端 `docs/platform-modules.md`。
- 每个页面声明字典范围，一次批量获取枚举名称；显示未知 code 时应检查后端字典迁移和接口访问权限。

## SSO 模板能力范围

SSO 模板已移除工作日历页面、路由、开发菜单及 API 客户端，与 `java-admin-starter` 的 `feature/sso`、`sync/yh-sso` 分支保持一致。原工作日历 URL 不再可用，已有部署应同步撤销 SSO 菜单和网关授权。

后端保留历史 Flyway 迁移、日历表及字典以兼容既有数据库；这些历史数据不代表模板继续提供工作日历 API。

## 公共组件

- 列 DSL 的 `buildFilterCondition` 可将一项筛选序列化为组合条件；调用方需显式配置，它不是独立的高级筛选页面。
- 表格支持输入页码跳转，空态/错误态在可见表格宽度内居中；多列排序使用 Shift 点击。
- TreeCombobox 支持树形单选/多选、搜索及禁用节点说明；ChoiceCombobox 支持分组。
- 页签支持 `Alt+ArrowLeft/ArrowRight` 和右键菜单调序，首页位置固定。

## 业务系统增量回灌（2026-09-23）

- DataTable 增加树形行、行内明细、轻量明细表格、受控跨页选择，以及远程单多选筛选；对象选择器复用这些共享能力。使用边界见 DataTable 技能 reference。
- 字典管理支持窄屏滚动和提交状态；平台状态统一为只读徽标，状态操作显式确认。表单必填语义、加载按钮可访问名称和提交异常处理同步增强。
- 主题按钮与命令面板统一模式切换，支持跟随系统；单色主题改善图表灰阶。
- 保留审计列 DSL、操作列自定义尺寸、上传字段及现有后端请求契约；未引入业务系统依赖或环境配置。

## 增量回灌（2026-09-30）

- SearchCombobox 支持触底加载、按钮外观、字段 id 与 aria-required；保留浮层生命周期。ChoiceCombobox 支持自定义选项内容与底部操作。
- DataTable 行操作支持 `getLabel(row)`，静态 label/id 继续作为稳定标识；既有确认配置与自定义列宽保留。CheckboxField 新增受控能力和显式 TanStack adapter，旧调用兼容。
- 内容路由迁入无路径 AppLayout，首页为 `/overview`。业务 URL 不包含 `/dashboard` 前缀。
- 导航为业务中心与功能两级；旧 kind/parentId 权限树仍兼容，过滤后再展开展示。激活子页时允许手动收起中心。
- 审计失败原因按稳定 code 判定，操作人/时间合列，独立筛选和时间排序保留；DTO 仍为 code 字符串与名称字段。
- 修正嵌套 accessorKey 列 ID、Tree 内嵌按钮键盘事件、workspace 浮层注册表快照与空 Map 清理。

## DataTable 性能回灌（2026-10-13）

来源为 `oig-export-erp` 的销售订单表格优化。本次按模板现有的 `core/body/` 分层接入，保留树形表格、行内明细、编辑、选择和列拖拽契约。

| 问题                                       | 通用改进                                                    | 边界                                                                         |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 点击后选中背景缓慢变色                     | 去除表体行和固定列底色的颜色过渡                            | 保留单元格选区 outline/box-shadow 过渡；通用 UI Table 不变                   |
| 滚动或选中时重复渲染行内按钮和 Tooltip     | 私有 `React.memo` 按钮组件复用展示                          | 动态文案、显隐、禁用原因每次重新解析；数据和回调变化更新点击行为             |
| 横向滚动反复计算固定列和仍在视口中的单元格 | 内容与外框分两层复用；外框接收稳定 services、标量尺寸和位置 | `table.options` 快照作为失效信号，数据、选中状态、meta、列配置变化仍重新渲染 |
| 宽表未显式配置时渲染所有列                 | 列虚拟化默认 `auto`，20 个可见非固定列触发                  | 隐藏列与固定列不计入阈值，固定列始终渲染；显式 on/off 及结构性回退保留       |

`React.memo` 减少的是重复执行组件和计算渲染结果，不是另建一份 DOM 缓存。进入窗口的新单元格仍需渲染，浏览器的布局与绘制开销也仍存在。

模板原有的 Activity 隐藏/恢复、滚动观察器恢复和尺寸缓存能力继续复用；ERP 此前从模板同步过这些修复，本次未重复迁入。全局行虚拟化阈值仍为 100，行/列 overscan 仍为 8/3。ERP 销售单的 30 行阈值、客户和仓库强制开启列虚拟化属于页面配置，未设为模板规则。模板继续使用 `getLabel(row)` 和静态 label/id 标识，不引入 ERP 的默认详情抽屉。

### ERP 来源测量

以下是 ERP 单元格复用前后的隔离 Chromium 测量，**不是模板的性能实测值**。Mock 50 条销售订单，挂载 19 行、285 个单元格；真实拖动底部水平滚动条，向右/向左合计 120 次顺序鼠标移动，每种构建各测三轮。

| 滚动事件处理耗时中位数 | 复用前   | 复用后  | 降幅   |
| ---------------------- | -------- | ------- | ------ |
| 开发构建               | 18.92 ms | 7.90 ms | 约 58% |
| 生产构建               | 6.02 ms  | 3.42 ms | 约 43% |

比较基线已包含第一轮按钮优化，因此表中反映的是单元格复用的增量收益。顺序鼠标事件会等待 Playwright 完成，追踪本身也有开销；这些数据用于相对比较，不能当作真实用户 FPS 或所有页面的速度承诺。

### 回归范围

新增渲染计数测试验证：横向滚动后，固定列和重叠列不重复渲染，新进入列正常渲染；数据、选中状态、meta 和列渲染器变化及时更新。行操作测试验证按钮复用、动态状态以及最新数据/回调。阈值测试覆盖 19/20 个非固定列边界、默认 auto 与显式关闭。

既有回归继续覆盖 Activity 恢复、列宽/固定列对齐、树展开、行内明细、单元格编辑、选区与底部真实滚动条拖动。

本次验证（模板基线 `5b9d9b46`，隔离 Chromium、Mock API、生产构建）：

- `corepack pnpm check` 通过：lint、架构检查、TypeScript 和 163 个文件中的 1,344 项单元测试通过。
- `corepack pnpm build --outDir /tmp/template-table-build` 通过。
- 本次修改文件的格式检查及 `git diff --check` 通过。全仓 `corepack pnpm format:check` 仍报 4 个原有文件：`docs/ssr-docker-nginx-deployment.md`、`openapi/specs/openapi.json`、`src/features/workspace-tabs/components/workspace-overlay-contract-page.tsx`、`src/test/fixtures/query-scene-metadata.json`；它们与 HEAD 一致，本次未修改。
- Playwright 执行 `data-table-regression`、`data-table-cell-range-selection`、`data-table-tree`、`data-table-editing-example`、`data-table-editable-choice-columns` 五组 smoke，共 30 项。首轮 26 通过、4 失败；仅重跑失败项后，滚动条边界检查通过，剩余 3 项失败均在修改前构建中以相同断言复现。
- 3 项原有失败分别为：表头 padding 断言期望 20px、实际 8px；choice editor 的 ready trigger 不存在；刷新禁用提示 hover 后读到了“新增字典项”提示。未将其计为本次优化通过项，也未扩展到无关修复。
- 滚动条边界检查首轮出现 10px 差异，单独重测及基线测试通过，偶发原因尚未定位。另一条底部滚动条真实拖动/固定列对齐回归首轮通过。

本次没有重测模板的性能百分比，也没有运行真实 SSO 登录 E2E。后续若调整虚拟化阈值，应按页面实际列数、固定列占比、单元格复杂度和生产构建重新采样。
