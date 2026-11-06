import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup, FieldSet } from '@/components/ui/field';

/**
 * 决策树的通用布局外壳。分组、条件和操作通过 children 组合，
 * 数据模型、增删与校验由调用方管理。
 */
function DecisionTree({ className, children, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      data-slot='decision-tree'
      className={cn('@container/decision-tree min-w-0 gap-0 shadow-none', className)}
      {...props}
    >
      <CardContent className='[--decision-tree-indent:0.5rem] [--decision-tree-spine:calc(var(--decision-tree-indent)/2)] @min-[24rem]/decision-tree:[--decision-tree-indent:1.5rem]'>
        {children}
      </CardContent>
    </Card>
  );
}

function DecisionTreeGroup({ className, ...props }: ComponentProps<typeof FieldSet>) {
  return (
    <FieldSet
      data-slot='decision-tree-group'
      className={cn('min-w-0 gap-2', className)}
      {...props}
    />
  );
}

/** 组头的首行作为逻辑节点，树干从该行下方接入子分支。 */
function DecisionTreeHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot='decision-tree-header'
      className={cn(
        'relative isolate flex min-h-9 min-w-0 flex-wrap items-center gap-2',
        'after:pointer-events-none after:absolute after:top-9 after:-bottom-2 after:left-[var(--decision-tree-spine)] after:-z-10 after:border-l after:border-muted-foreground/35',
        className
      )}
      {...props}
    />
  );
}

function DecisionTreeChildren({ className, ...props }: ComponentProps<typeof FieldGroup>) {
  return (
    <FieldGroup
      data-slot='decision-tree-children'
      className={cn('gap-3 pl-[var(--decision-tree-indent)]', className)}
      {...props}
    />
  );
}

/** 分支连接到首行控件中心；末项在弧形接点处结束树干。 */
function DecisionTreeItem({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot='decision-tree-item'
      className={cn(
        'relative min-h-9 min-w-0',
        'before:pointer-events-none before:absolute before:-top-3 before:bottom-0 before:left-[calc(var(--decision-tree-spine)_-_var(--decision-tree-indent))] before:border-l before:border-muted-foreground/35',
        'first:before:-top-2 last:before:bottom-[calc(100%_-_0.75rem)]',
        'after:pointer-events-none after:absolute after:top-3 after:left-[calc(var(--decision-tree-spine)_-_var(--decision-tree-indent))] after:h-1.5 after:w-[calc(var(--decision-tree-indent)_-_var(--decision-tree-spine))] after:rounded-bl-md after:border-b after:border-l after:border-muted-foreground/35',
        'focus-within:before:border-primary/70 focus-within:after:border-primary/70',
        className
      )}
      {...props}
    />
  );
}

export {
  DecisionTree,
  DecisionTreeGroup,
  DecisionTreeHeader,
  DecisionTreeChildren,
  DecisionTreeItem
};
