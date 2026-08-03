# Git 提交规范

提交标题由 commitlint 校验，并通过 Husky `commit-msg` hook 在提交前执行。

标题必须完整匹配：

```regex
^(?:(?:build|test|chore|feat|fix|perf|refactor|docs|types|style):\s.+|Initial commit|Merge .+|Revert ".+"|Update .+)$
```

常规格式为 `<type>: <description>`，允许的类型：

- `build`
- `test`
- `chore`
- `feat`
- `fix`
- `perf`
- `refactor`
- `docs`
- `types`
- `style`

合法description示例：

```text
feat: 新增用户筛选
fix: 修复分页总数显示
Initial commit
Merge branch 'main'
Revert "feat: 新增用户筛选"
Update README
```

不支持 scope 格式：

```text
feat(user): 新增筛选
```

创建正式提交时，必须按 features 补全 commit body，逐项说明本次提交覆盖的功能点或工程变更，不得只重复提交标题。

推荐示例

```
feat: 新增用户筛选

- 支持部门筛选
- 支持角色筛选
- 调整筛选请求参数
- 补充测试
```

手动检查：

```bash
printf '%s\n' 'feat: 新增用户筛选' | pnpm lint:commit
```

禁止绕过 `commit-msg` hook。

## 远端推送标准

`yh` 远端 GitLab pre-receive hook 使用以下提交标题正则：

```regex
((build|test|chore|feat|fix|perf|refactor|docs|types):\s.)|Initial commit|Merge .{1,}|Revert ".{1,}"|Update .{1,}
```

推送规则：

- 推送到 `yh` 的每个新增提交都必须匹配该正则，不能只校验 `HEAD`。
- `style:` 虽然当前可通过本地 commitlint，但不在远端允许列表中，正式推送不得使用。
- 推送前先 fetch 目标分支，再用 `git log --format='%H%x09%s' <remote>/<branch>..HEAD` 审计本次将引入的全部提交标题。
- 远端历史与本地历史无共同祖先时，禁止直接引入包含不合规标题的旧历史；应在远端现有历史上生成符合规范的同步提交。
- 禁止通过跳过 hook、伪造引用或未经用户确认的强推绕过远端校验。
