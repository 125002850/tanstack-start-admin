import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tree, type TreeItem } from './tree';

const ITEMS: TreeItem[] = [
  {
    value: 'root',
    label: '总部',
    children: [
      {
        value: 'research',
        label: '研发部',
        children: [{ value: 'frontend', label: '前端组' }]
      },
      { value: 'operations', label: '运维部' }
    ]
  }
];

afterEach(cleanup);

describe('Tree', () => {
  it('supports controlled single selection for form-like consumers', () => {
    function Harness() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <>
          <Tree
            aria-label='组织树'
            items={ITEMS}
            selection={{ mode: 'single', value, onValueChange: setValue }}
          />
          <output aria-label='当前选中值'>{value}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('treeitem', { name: '研发部' }));

    expect(screen.getByLabelText('当前选中值')).toHaveTextContent('research');
    expect(screen.getByRole('treeitem', { name: '研发部' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('selects a complete subtree and derives parent mixed state from child changes', () => {
    function Harness() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <>
          <Tree
            aria-label='组织树'
            items={ITEMS}
            selection={{ mode: 'cascade-multiple', values, onValuesChange: setValues }}
          />
          <output aria-label='当前选中值'>{JSON.stringify(values)}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('treeitem', { name: '总部，未选中' }));

    expect(screen.getByRole('treeitem', { name: '总部，已选中' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('treeitem', { name: '前端组，已选中' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('当前选中值')).toHaveTextContent(
      '["root","research","frontend","operations"]'
    );

    fireEvent.click(screen.getByRole('treeitem', { name: '前端组，已选中' }));

    expect(screen.getByRole('treeitem', { name: '总部，部分选中' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    );
    expect(screen.getByRole('treeitem', { name: '研发部，未选中' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByLabelText('当前选中值')).toHaveTextContent('["operations"]');
  });

  it('supports independent multi-selection where parent and children do not cascade', () => {
    function Harness() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <>
          <Tree
            aria-label='组织树'
            items={ITEMS}
            selection={{ mode: 'independent-multiple', values, onValuesChange: setValues }}
          />
          <output aria-label='当前选中值'>{JSON.stringify(values)}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('treeitem', { name: '总部，未选中' }));

    expect(screen.getByRole('treeitem', { name: '总部，已选中' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('treeitem', { name: '前端组，未选中' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByLabelText('当前选中值')).toHaveTextContent('["root"]');
  });

  it('supports roving focus and standard tree keyboard navigation', () => {
    render(
      <Tree
        aria-label='组织树'
        items={ITEMS}
        selection={{ mode: 'single', value: null, onValueChange: () => {} }}
      />
    );

    const root = screen.getByRole('treeitem', { name: '总部' });
    root.focus();
    expect(root).toHaveAttribute('tabindex', '0');
    expect(root).toHaveAttribute('aria-level', '1');

    fireEvent.keyDown(root, { key: 'ArrowDown' });
    const research = screen.getByRole('treeitem', { name: '研发部' });
    expect(research).toHaveFocus();
    expect(research).toHaveAttribute('aria-level', '2');
    expect(research).toHaveAttribute('aria-posinset', '1');
    expect(research).toHaveAttribute('aria-setsize', '2');

    fireEvent.keyDown(research, { key: 'ArrowRight' });
    expect(screen.getByRole('treeitem', { name: '前端组' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('treeitem', { name: '前端组' }), { key: 'End' });
    expect(screen.getByRole('treeitem', { name: '运维部' })).toHaveFocus();
  });

  it('keeps matching ancestor paths visible while searching', () => {
    render(
      <Tree
        aria-label='组织树'
        items={ITEMS}
        searchQuery='前端'
        selection={{ mode: 'single', value: null, onValueChange: () => {} }}
      />
    );

    expect(screen.getByText('总部')).toBeInTheDocument();
    expect(screen.getByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('前端组')).toBeInTheDocument();
    expect(screen.queryByText('运维部')).not.toBeInTheDocument();
  });

  it('rejects duplicate values before ambiguous selection state can be rendered', () => {
    expect(() =>
      render(
        <Tree
          items={[
            { value: 'duplicate', label: '第一项' },
            { value: 'duplicate', label: '第二项' }
          ]}
          selection={{ mode: 'single', value: null, onValueChange: () => {} }}
        />
      )
    ).toThrow('Tree item value must be unique: duplicate');
  });
});
