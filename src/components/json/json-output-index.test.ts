// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatJsonSource } from '@/lib/json-source';
import { indexJsonOutput } from './json-output-index';

describe('JSON 输出折叠索引', () => {
  it('完整索引根对象、嵌套数组和对象，并保留原文中的精确数值', () => {
    const text = formatJsonSource(
      '{"data":[{"id":9007199254740993,"amount":1.000000000000000001}],"empty":{}}'
    );
    const { lineCount, folds } = indexJsonOutput(text);
    expect(lineCount).toBe(9);
    expect(folds.size).toBe(3);
    expect(folds.get(0)).toEqual({ from: 1, to: text.length - 1 });
    const arrayOpen = text.indexOf('[');
    const arrayLine = text.lastIndexOf('\n', arrayOpen) + 1;
    const range = folds.get(arrayLine)!;
    expect(text[range.from - 1]).toBe('[');
    expect(text[range.to]).toBe(']');
    expect(text.slice(range.from, range.to)).toContain('9007199254740993');
    expect(text.slice(range.from, range.to)).toContain('1.000000000000000001');
  });

  it('忽略字符串和转义引号内的括号，避免错误折叠后面的节点', () => {
    const text = formatJsonSource(
      JSON.stringify({
        text: '"} [ ] {',
        escaped: '\\\\"{}[]',
        nested: { items: [1, 2] }
      })
    );
    const { folds } = indexJsonOutput(text);
    expect(folds.size).toBe(3);
    expect(folds.get(0)).toEqual({ from: 1, to: text.length - 1 });
    for (const range of folds.values()) {
      expect(['{', '[']).toContain(text[range.from - 1]);
      expect(text[range.to]).toBe(text[range.from - 1] === '{' ? '}' : ']');
    }
  });

  it.each(['[]', '{}', 'true', '"[]{}"', '1.000000000000000001'])(
    '不为单行值或空容器创建折叠入口 %s',
    (text) => {
      expect(indexJsonOutput(text)).toEqual({ lineCount: 1, folds: new Map() });
    }
  );
});
