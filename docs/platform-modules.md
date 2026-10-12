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
