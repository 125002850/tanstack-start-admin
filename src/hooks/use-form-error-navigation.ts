import * as React from 'react';

export interface FormErrorField<Section extends string = string> {
  readonly path: string;
  readonly section?: Section;
}

interface FormErrorNavigationOptions<
  Issue extends { readonly path: string },
  Section extends string
> {
  readonly issues: readonly Issue[];
  /** 按表单展示顺序声明；父路径同时匹配点号或方括号表示的子字段。 */
  readonly fields: readonly FormErrorField<Section>[];
  readonly onFocus: (issue: Issue) => void;
  /** 可选：在下一次渲染中展示字段所在的 Tab、步骤或折叠区。 */
  readonly onActivateSection?: (section: Section) => void;
  /** 异步加载或提交期间可暂缓聚焦，待控件可用后执行。 */
  readonly enabled?: boolean;
}

function matchesPath(path: string, field: string): boolean {
  return path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[`);
}

/** 仅在显式导航时定位错误；重新校验只更新计数，不抢占正在编辑的焦点。 */
export function useFormErrorNavigation<
  Issue extends { readonly path: string },
  Section extends string = string
>({
  issues,
  fields,
  onFocus,
  onActivateSection,
  enabled = true
}: FormErrorNavigationOptions<Issue, Section>) {
  const [pending, setPending] = React.useState<{ readonly issue: Issue } | null>(null);
  const sectionErrorCounts = new Map<Section, number>();
  for (const issue of issues) {
    const section = fields.find((field) => matchesPath(issue.path, field.path))?.section;
    if (section !== undefined) {
      sectionErrorCounts.set(section, (sectionErrorCounts.get(section) ?? 0) + 1);
    }
  }

  const cancelNavigation = React.useCallback(() => setPending(null), []);
  const navigateToFirstError = (nextIssues: readonly Issue[] = issues) => {
    for (const field of fields) {
      const issue = nextIssues.find((candidate) => matchesPath(candidate.path, field.path));
      if (issue === undefined) continue;
      if (field.section !== undefined) onActivateSection?.(field.section);
      setPending({ issue });
      return;
    }
    cancelNavigation();
  };

  React.useEffect(() => {
    if (!enabled || pending === null) return;
    let cancelled = false;
    // Tabs 等容器会在 layout effect 中挂载内容，等待本轮提交及其同步更新完成。
    queueMicrotask(() => {
      if (cancelled) return;
      onFocus(pending.issue);
      setPending(null);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, onFocus, pending]);

  return { sectionErrorCounts, navigateToFirstError, cancelNavigation };
}
