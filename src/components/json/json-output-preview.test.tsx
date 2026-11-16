import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatJsonSource } from '@/lib/json-source';
import { JsonOutputPreview } from './json-output-preview';

const copy = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('@/lib/browser/copy-text-to-clipboard', () => ({ copyTextToClipboard: copy }));
vi.mock('@/lib/json-source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/json-source')>();
  return { ...actual, formatJsonSource: vi.fn(actual.formatJsonSource) };
});

afterEach(cleanup);

describe('JSON 输出预览', () => {
  it('小结果保持完整文本和精确数值，同一份结果重新渲染不重复格式化', () => {
    const source = '{"id":9007199254740993,"amount":1.000000000000000001}';
    const { rerender } = render(<JsonOutputPreview source={source} ariaLabel='结果' />);
    expect(screen.getByLabelText('结果')).toHaveTextContent('9007199254740993');
    expect(screen.getByLabelText('结果')).toHaveTextContent('1.000000000000000001');
    expect(screen.getByLabelText('结果')).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByLabelText('结果')).toHaveAttribute('aria-readonly', 'true');
    expect(formatJsonSource).toHaveBeenCalledTimes(1);
    rerender(<JsonOutputPreview source={source} ariaLabel='更新结果' />);
    expect(formatJsonSource).toHaveBeenCalledTimes(1);
  });

  it('已经格式化的提取结果不再重复处理', () => {
    render(
      <JsonOutputPreview source='[\n  {"id":9007199254740993}\n]' ariaLabel='结果' formatted />
    );
    expect(screen.getByLabelText('结果')).toHaveTextContent('9007199254740993');
    expect(formatJsonSource).not.toHaveBeenCalled();
  });

  it('大结果提供完整复制，复制内容包含滚动区域之外的末尾数据', async () => {
    const user = userEvent.setup();
    const source = `[${Array.from({ length: 1000 }, (_, index) => `{"id":"ROW-${index}"}`).join(',')}]`;
    render(<JsonOutputPreview source={source} ariaLabel='大响应' />);
    expect(screen.getByText('共 3002 行')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '复制完整大响应' }));
    const copied = copy.mock.calls.at(-1)![0] as string;
    expect(JSON.parse(copied)).toHaveLength(1000);
    expect(copied).toContain('ROW-0');
    expect(copied).toContain('ROW-999');
  });
});
