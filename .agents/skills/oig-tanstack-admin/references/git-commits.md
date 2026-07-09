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
