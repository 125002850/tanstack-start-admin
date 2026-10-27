import { diffArrays } from 'diff';

export type TextDiffLanguage = 'text' | 'json';

export interface TextDiffToken {
  readonly text: string;
  readonly kind: 'key' | 'string' | 'literal' | 'plain';
  readonly highlighted?: boolean;
}

export interface TextDiffLine {
  readonly kind: 'added' | 'removed' | 'unchanged';
  readonly beforeLine?: number;
  readonly afterLine?: number;
  readonly tokens: readonly TextDiffToken[];
}

export interface TextDiffSourceLine {
  /** 两份文档中同一逻辑行的稳定标识，文档内唯一；顺序由调用方决定。 */
  readonly key: string;
  readonly text: string;
}

interface NumberedLine {
  readonly text: string;
  readonly number: number;
}

/** 普通文本按行比较；统一 CRLF 为 LF，保留空白、空行及末尾换行差异。 */
export function buildTextDiff(
  before: string,
  after: string,
  language: TextDiffLanguage = 'text'
): readonly TextDiffLine[] {
  const split = (text: string) => (text === '' ? [] : text.replaceAll('\r\n', '\n').split('\n'));
  const changes = diffArrays(split(before), split(after));
  const lines: TextDiffLine[] = [];
  let beforeNumber = 0;
  let afterNumber = 0;
  for (let index = 0; index < changes.length; index++) {
    const change = changes[index]!;
    const replacement = change.removed && changes[index + 1]?.added ? changes[++index] : undefined;
    if (replacement) {
      for (
        let offset = 0;
        offset < Math.max(change.value.length, replacement.value.length);
        offset++
      ) {
        const oldText = change.value[offset];
        const newText = replacement.value[offset];
        lines.push(
          ...buildLinePair(
            oldText === undefined ? undefined : { text: oldText, number: ++beforeNumber },
            newText === undefined ? undefined : { text: newText, number: ++afterNumber },
            language
          )
        );
      }
    } else {
      for (const text of change.value) {
        lines.push(
          ...buildLinePair(
            change.added ? undefined : { text, number: ++beforeNumber },
            change.removed ? undefined : { text, number: ++afterNumber },
            language
          )
        );
      }
    }
  }
  return lines;
}

/** 已有结构标识的文档按 key 匹配，不把内容恰好相同的不同逻辑行配为一行。 */
export function buildKeyedTextDiff(
  before: readonly TextDiffSourceLine[],
  after: readonly TextDiffSourceLine[],
  language: TextDiffLanguage = 'text'
): readonly TextDiffLine[] {
  const lines: TextDiffLine[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const change of diffArrays([...before], [...after], {
    comparator: (a, b) => a.key === b.key
  })) {
    for (const source of change.value) {
      if (change.removed) {
        lines.push(
          ...buildLinePair({ text: source.text, number: ++beforeIndex }, undefined, language)
        );
      } else if (change.added) {
        lines.push(
          ...buildLinePair(undefined, { text: source.text, number: ++afterIndex }, language)
        );
      } else {
        lines.push(
          ...buildLinePair(
            { text: before[beforeIndex++]!.text, number: beforeIndex },
            { text: after[afterIndex++]!.text, number: afterIndex },
            language
          )
        );
      }
    }
  }
  return lines;
}

function buildLinePair(
  before: NumberedLine | undefined,
  after: NumberedLine | undefined,
  language: TextDiffLanguage
): TextDiffLine[] {
  if (!before && !after) return [];
  if (!before)
    return [{ kind: 'added', afterLine: after!.number, tokens: tokenize(after!.text, language) }];
  if (!after)
    return [
      { kind: 'removed', beforeLine: before.number, tokens: tokenize(before.text, language) }
    ];
  if (before.text === after.text)
    return [
      {
        kind: 'unchanged',
        beforeLine: before.number,
        afterLine: after.number,
        tokens: tokenize(after.text, language)
      }
    ];

  const changes = diffArrays(tokenize(before.text, language), tokenize(after.text, language), {
    comparator: (a, b) => a.text === b.text
  });
  return [
    {
      kind: 'removed',
      beforeLine: before.number,
      tokens: changes
        .filter((part) => !part.added)
        .flatMap((part) => part.value.map((token) => ({ ...token, highlighted: part.removed })))
    },
    {
      kind: 'added',
      afterLine: after.number,
      tokens: changes
        .filter((part) => !part.removed)
        .flatMap((part) => part.value.map((token) => ({ ...token, highlighted: part.added })))
    }
  ];
}

function tokenize(text: string, language: TextDiffLanguage): TextDiffToken[] {
  if (language === 'text') {
    return (text.match(/\s+|[\p{L}\p{N}_]+|./gu) ?? []).map((text) => ({ text, kind: 'plain' }));
  }
  const parts =
    text.match(/"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\s+|./g) ?? [];
  return parts.map((text, index) => ({
    text,
    kind: text.startsWith('"')
      ? parts[index + 1] === ':'
        ? 'key'
        : 'string'
      : /^(?:true|false|null|-?\d)/.test(text)
        ? 'literal'
        : 'plain'
  }));
}

export type TextDiffBlock =
  | { readonly kind: 'line'; readonly line: TextDiffLine }
  | { readonly kind: 'fold'; readonly lines: readonly TextDiffLine[] };

/** 每段变更保留两行上下文，并保留文档首尾；长段未变化内容原位展开。 */
export function foldTextDiff(lines: readonly TextDiffLine[]): TextDiffBlock[] {
  const blocks: TextDiffBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const start = index;
    if (lines[index]!.kind !== 'unchanged') {
      blocks.push({ kind: 'line', line: lines[index++]! });
      continue;
    }
    while (index < lines.length && lines[index]!.kind === 'unchanged') index++;
    const run = lines.slice(start, index);
    if (run.length <= 5) blocks.push(...run.map((line) => ({ kind: 'line' as const, line })));
    else
      blocks.push(
        ...run.slice(0, 2).map((line) => ({ kind: 'line' as const, line })),
        { kind: 'fold', lines: run.slice(2, -2) },
        ...run.slice(-2).map((line) => ({ kind: 'line' as const, line }))
      );
  }
  return blocks;
}
