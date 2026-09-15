import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Tree, type TreeItem } from './tree';
const items: TreeItem[] = [
  {
    value: 'root',
    label: '根',
    children: [
      {
        value: 'disabled',
        label: '禁选角色',
        disabled: true,
        disabledReason: '不能选择下级角色',
        children: [{ value: 'child', label: '可选下级' }]
      }
    ]
  }
];
afterEach(cleanup);
it('keeps disabled nodes visible and expandable but blocks mouse and keyboard selection', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(
    <Tree items={items} selection={{ mode: 'single', value: null, onValueChange: changed }} />
  );
  const node = screen.getByRole('treeitem', { name: '禁选角色' });
  await user.click(node);
  await user.keyboard('{Enter} ');
  expect(changed).not.toHaveBeenCalled();
  expect(node).toHaveAccessibleDescription('不能选择下级角色');
  expect(screen.getByRole('treeitem', { name: '可选下级' })).toBeInTheDocument();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(changed).toHaveBeenCalledWith('child');
});
it('does not select disabled descendants through cascade selection', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(
    <Tree
      items={items}
      selection={{ mode: 'cascade-multiple', values: [], onValuesChange: changed }}
    />
  );
  await user.click(screen.getByRole('treeitem', { name: '根，未选中' }));
  expect(changed).toHaveBeenCalledWith(['root', 'child']);
});
it('preserves selection order in independent multi selection', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [values, setValues] = useState<string[]>([]);
    return (
      <>
        <Tree
          items={[
            { value: 'a', label: '甲' },
            { value: 'b', label: '乙' }
          ]}
          selection={{ mode: 'independent-multiple', values, onValuesChange: setValues }}
        />
        <output>{values.join(',')}</output>
      </>
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole('treeitem', { name: '乙，未选中' }));
  await user.click(screen.getByRole('treeitem', { name: '甲，未选中' }));
  expect(screen.getByRole('status')).toHaveTextContent('b,a');
});

it('can clear enabled descendants while preserving disabled and missing selections', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(
    <Tree
      items={items}
      selection={{
        mode: 'cascade-multiple',
        values: ['root', 'child', 'disabled', 'missing'],
        onValuesChange: changed
      }}
    />
  );
  await user.click(screen.getByRole('treeitem', { name: '根，已选中' }));
  expect(changed).toHaveBeenCalledWith(['disabled', 'missing']);
});
