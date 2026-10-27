import { describe, expect, it } from 'vitest';

import { buildKeyedTextDiff, buildTextDiff, foldTextDiff, type TextDiffLine } from './text-diff';

const text = (line: TextDiffLine) => line.tokens.map((token) => token.text).join('');
const restore = (lines: readonly TextDiffLine[], side: 'before' | 'after') =>
  lines
    .filter((line) => line.kind !== (side === 'before' ? 'added' : 'removed'))
    .map(text)
    .join('\n');

describe('buildTextDiff', () => {
  it('keeps context and pairs replacements with word highlights and independent line numbers', () => {
    const before = 'header\nHello old world\nfooter';
    const after = 'header\nHello new world\nfooter';
    const lines = buildTextDiff(before, after);
    expect(lines.map((line) => line.kind)).toEqual(['unchanged', 'removed', 'added', 'unchanged']);
    expect(lines[1]?.beforeLine).toBe(2);
    expect(lines[1]?.afterLine).toBeUndefined();
    expect(lines[2]?.afterLine).toBe(2);
    expect(lines[2]?.beforeLine).toBeUndefined();
    expect(
      lines[1]?.tokens.filter((token) => token.highlighted).map((token) => token.text)
    ).toEqual(['old']);
    expect(
      lines[2]?.tokens.filter((token) => token.highlighted).map((token) => token.text)
    ).toEqual(['new']);
    expect(restore(lines, 'before')).toBe(before);
    expect(restore(lines, 'after')).toBe(after);
  });

  it.each([
    ['', ''],
    ['', 'created'],
    ['deleted', ''],
    ['a\n', 'a'],
    ['a\n\n b\n', 'a\n b\n'],
    ['a\nb\nc\nd', 'a\nx\nd'],
    ['a\nx\nd', 'a\nb\nc\nd'],
    ['hello \t', 'hello'],
    ['重复\n相同\n重复', '重复\n新内容\n重复'],
    ['😀旧内容', '😀新内容']
  ])(
    'can restore both documents including blank lines and whitespace (%j → %j)',
    (before, after) => {
      const lines = buildTextDiff(before, after);
      expect(restore(lines, 'before')).toBe(before);
      expect(restore(lines, 'after')).toBe(after);
      for (const side of ['before', 'after'] as const) {
        const numbers = lines.flatMap((line) => line[`${side}Line`] ?? []);
        expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, index) => index + 1));
      }
    }
  );

  it('normalizes CRLF without removing blank lines or treating JSON-like text as code by default', () => {
    const lines = buildTextDiff('"ready": true\r\n\r\n', '"ready": true\n\n');
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.kind === 'unchanged')).toBe(true);
    expect(lines.flatMap((line) => line.tokens).every((token) => token.kind === 'plain')).toBe(
      true
    );
  });

  it('supports JSON syntax colors and highlights changed values without parsing or evaluating the content', () => {
    const lines = buildTextDiff(
      '{ "type": "STRING", "required": true }',
      '{ "type": "NUMBER", "required": false }',
      'json'
    );
    expect(
      lines[0]?.tokens.filter((token) => token.highlighted).map((token) => token.text)
    ).toEqual(['"STRING"', 'true']);
    expect(
      lines[1]?.tokens.filter((token) => token.highlighted).map((token) => token.text)
    ).toEqual(['"NUMBER"', 'false']);
    expect(lines[1]?.tokens.find((token) => token.text === '"type"')?.kind).toBe('key');
    expect(lines[1]?.tokens.find((token) => token.text === '"NUMBER"')?.kind).toBe('string');
    expect(lines[1]?.tokens.find((token) => token.text === 'false')?.kind).toBe('literal');
  });
});

describe('buildKeyedTextDiff', () => {
  it('pairs the same logical line even when neighboring lines contain identical text', () => {
    const lines = buildKeyedTextDiff(
      [
        { key: 'first', text: 'same' },
        { key: 'second', text: 'same' }
      ],
      [{ key: 'second', text: 'changed' }]
    );
    expect(lines.map((line) => line.kind)).toEqual(['removed', 'removed', 'added']);
    expect(lines[0]?.tokens.some((token) => token.highlighted)).toBe(false);
    expect(lines[1]?.beforeLine).toBe(2);
    expect(lines[1]?.tokens.some((token) => token.highlighted)).toBe(true);
    expect(lines[2]?.afterLine).toBe(1);
  });
});

describe('foldTextDiff', () => {
  it('keeps all changes and nearby context, and restores the full document when expanded', () => {
    const original = Array.from({ length: 20 }, (_, index) => `line ${index}`);
    const lines = buildTextDiff(
      original.join('\n'),
      original.map((line, index) => (index === 10 ? 'changed' : line)).join('\n')
    );
    const blocks = foldTextDiff(lines);
    expect(blocks.filter((block) => block.kind === 'fold').length).toBeGreaterThan(0);
    expect(blocks.flatMap((block) => (block.kind === 'fold' ? block.lines : block.line))).toEqual(
      lines
    );
    const visible = blocks
      .filter((block) => block.kind === 'line')
      .map((block) => text(block.line));
    expect(visible).toContain('line 9');
    expect(visible).toContain('line 11');
    expect(
      blocks
        .filter((block) => block.kind === 'fold')
        .every((block) => block.lines.every((line) => line.kind === 'unchanged'))
    ).toBe(true);
  });
});
