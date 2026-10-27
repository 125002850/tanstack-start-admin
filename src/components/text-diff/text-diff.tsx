import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  buildTextDiff,
  foldTextDiff,
  type TextDiffLanguage,
  type TextDiffLine
} from '@/lib/text-diff';
import { cn } from '@/lib/utils';
import './text-diff.css';

export interface TextDiffViewProps {
  readonly lines: readonly TextDiffLine[];
  readonly title?: React.ReactNode;
  readonly beforeLabel?: string;
  readonly afterLabel?: string;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

export interface TextDiffProps extends Omit<TextDiffViewProps, 'lines'> {
  readonly before: string;
  readonly after: string;
  readonly language?: TextDiffLanguage;
}

/** 普通文本入口；结构化文档可以预计算差异行后直接使用 TextDiffView。 */
export function TextDiff({ before, after, language = 'text', ...viewProps }: TextDiffProps) {
  const lines = React.useMemo(
    () => buildTextDiff(before, after, language),
    [before, after, language]
  );
  return <TextDiffView {...viewProps} lines={lines} />;
}

export function TextDiffView({
  lines,
  title,
  beforeLabel = '原版本',
  afterLabel = '新版本',
  'aria-label': ariaLabel = '文本变更内容',
  className
}: TextDiffViewProps) {
  const blocks = React.useMemo(() => foldTextDiff(lines), [lines]);
  return (
    <div
      className={cn('min-w-0 overflow-hidden rounded-md border', className)}
      data-component='text-diff'
    >
      {title ? (
        <div className='bg-muted/40 text-muted-foreground border-b px-3 py-2 font-mono text-xs'>
          {title}
        </div>
      ) : null}
      <div
        aria-label={ariaLabel}
        className='overflow-x-auto'
        role='region'
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 独立滚动区域需要键盘聚焦，以便用方向键查看长行。
        tabIndex={0}
      >
        {lines.length === 0 ? (
          <p className='text-muted-foreground px-3 py-4 text-sm'>内容为空。</p>
        ) : null}
        <table className='w-full border-collapse font-mono text-xs leading-6'>
          <caption className='sr-only'>
            {ariaLabel}。前两列分别为{beforeLabel}与{afterLabel}的行号；减号表示删除，加号表示新增。
          </caption>
          <tbody>
            {blocks.map((block) =>
              block.kind === 'fold' ? (
                <TextDiffFold key={`fold-${block.lines[0]!.beforeLine}`} lines={block.lines} />
              ) : (
                <TextDiffRow
                  key={`${block.line.beforeLine}-${block.line.afterLine}`}
                  line={block.line}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextDiffFold({ lines }: { readonly lines: readonly TextDiffLine[] }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <>
      <tr className='bg-muted/50'>
        <td colSpan={4}>
          <Button
            aria-expanded={expanded}
            className='text-muted-foreground h-7 w-full justify-start rounded-none px-3 font-sans text-xs'
            onClick={() => setExpanded((value) => !value)}
            size='sm'
            variant='ghost'
          >
            {expanded ? '收起' : '展开'} {lines.length} 行未变化内容
          </Button>
        </td>
      </tr>
      {expanded ? lines.map((line) => <TextDiffRow key={line.beforeLine} line={line} />) : null}
    </>
  );
}

function TextDiffRow({ line }: { readonly line: TextDiffLine }) {
  return (
    <tr data-diff-kind={line.kind}>
      <td
        aria-hidden='true'
        className='text-muted-foreground/60 w-8 border-r px-2 text-right align-top select-none'
      >
        {line.beforeLine}
      </td>
      <td
        aria-hidden='true'
        className='text-muted-foreground/60 w-8 border-r px-2 text-right align-top select-none'
      >
        {line.afterLine}
      </td>
      <td className='w-6 px-2 text-center align-top select-none'>
        <span aria-hidden='true'>
          {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
        </span>
        <span className='sr-only'>
          {line.kind === 'added' ? '新增' : line.kind === 'removed' ? '删除' : ''}
        </span>
      </td>
      <td className='pr-4 align-top'>
        <code className='whitespace-pre'>
          {line.tokens.map((token, index) => (
            <span
              data-diff-highlight={token.highlighted || undefined}
              data-token={token.kind}
              key={index}
            >
              {token.text}
            </span>
          ))}
        </code>
      </td>
    </tr>
  );
}
