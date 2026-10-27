import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { buildKeyedTextDiff } from '@/lib/text-diff';
import { TextDiff, TextDiffView } from './text-diff';

afterEach(cleanup);

describe('TextDiff', () => {
  it('renders ordinary text with old then new lines, a title and accessible labels', () => {
    render(
      <TextDiff
        before='Hello old world'
        after='Hello new world'
        title='notes.txt'
        beforeLabel='已保存'
        afterLabel='当前编辑'
        aria-label='正文变更'
      />
    );
    expect(screen.getByText('notes.txt')).toBeVisible();
    expect(screen.getByRole('region', { name: '正文变更' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('table')).toHaveAccessibleName(/已保存与当前编辑的行号/);
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.dataset.diffKind)).toEqual(['removed', 'added']);
    expect(within(rows[0]!).getByText('old')).toHaveAttribute('data-diff-highlight', 'true');
    expect(within(rows[1]!).getByText('new')).toHaveAttribute('data-diff-highlight', 'true');
  });

  it('expands and collapses unchanged context and updates when the input changes', async () => {
    const user = userEvent.setup();
    const content = Array.from({ length: 12 }, (_, index) => `unchanged_${index}`).join('\n');
    const { rerender } = render(<TextDiff before={content} after={content} />);
    expect(screen.queryByText('unchanged_6')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '展开 8 行未变化内容' }));
    expect(screen.getByText('unchanged_6')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '收起 8 行未变化内容' }));
    expect(screen.queryByText('unchanged_6')).not.toBeInTheDocument();
    rerender(<TextDiff before='old' after='new' />);
    expect(screen.getByText('new')).toBeVisible();
    expect(screen.queryByText('unchanged_0')).not.toBeInTheDocument();
  });

  it('renders HTML and template source as inert text and handles empty documents', () => {
    const { container, rerender } = render(
      <TextDiff before='<img src=x onerror=alert(1)>' after='<script>{{user.name}}</script>' />
    );
    expect(container.querySelector('img, script')).toBeNull();
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('<script>{{user.name}}</script>');
    rerender(<TextDiff before='' after='' />);
    expect(screen.getByText('内容为空。')).toBeVisible();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });
});

describe('TextDiffView', () => {
  it('renders precomputed structural diffs without needing business data', () => {
    const lines = buildKeyedTextDiff(
      [{ key: 'property', text: '"count": 1' }],
      [{ key: 'property', text: '"count": 2' }],
      'json'
    );
    render(<TextDiffView lines={lines} />);
    const changedValue = within(screen.getAllByRole('row')[1]!).getByText('2', {
      selector: '[data-token]'
    });
    expect(changedValue).toHaveAttribute('data-token', 'literal');
    expect(changedValue).toHaveAttribute('data-diff-highlight', 'true');
    expect(screen.queryByText(/Payload|线上|待发布/)).not.toBeInTheDocument();
  });
});
