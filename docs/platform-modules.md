# 通用平台页面

回灌模块沿用 generated client、DataTable、workspace tabs 和字典 code 契约。

| 页面 | 路由 | 菜单键 |
| --- | --- | --- |
| 操作审计 | `/dashboard/system-management/operation-audit` | `operation-audit` |
| 调度中心 | `/dashboard/system-management/schedule-center` | `schedule-center` |
| 工作日历 | `/dashboard/system-management/work-calendar` | `work-calendar` |

页面需要配套 `java-admin-starter` 的操作审计、调度、日历增量迁移与 API。更新后端后，按 README 的 `pnpm api` 重新拉取契约；单独运行前端不会生成审计或执行任务。

- 审计页支持筛选、分页和脱敏详情。
- 调度页支持任务维护、启停、执行记录、操作记录及 Cron 预览；立即执行前需要确认。后端调用白名单和单实例运行边界见后端 `docs/platform-modules.md`。
- 日历支持年度工作时段、特殊日期、JSON 导入模板、草稿试算和发布差异确认。发布后生效快照只读，未保存修改受 workspace 关闭保护。
- 每个页面声明字典范围，一次批量获取枚举名称；显示未知 code 时应检查后端字典迁移和接口访问权限。

## 公共组件

- 列 DSL 的 `buildFilterCondition` 可将一项筛选序列化为组合条件；调用方需显式配置，它不是独立的高级筛选页面。
- 表格支持输入页码跳转，空态/错误态在可见表格宽度内居中；多列排序使用 Shift 点击。
- TreeCombobox 支持树形单选/多选、搜索及禁用节点说明；ChoiceCombobox 支持分组。
- 页签支持 `Alt+ArrowLeft/ArrowRight` 和右键菜单调序，首页位置固定。
