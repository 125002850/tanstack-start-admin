import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateConditionTree } from '../lib/condition-validation';
import { indexConditionTree } from '../lib/condition-tree';
import {
  createConditionClientId,
  getConditionMetrics,
  type ConditionField,
  type ConditionNode,
  type GroupCondition,
  type PredicateCondition
} from '../model/condition-model';
import { ConditionTreeEditor } from './condition-tree-editor';
import { ConditionReferenceSetsProvider } from './condition-reference-sets';

afterEach(cleanup);
const catalog: readonly ConditionField[] = [
  {
    path: 'payload.hidden',
    label: '不可选字段',
    type: 'STRING',
    source: 'PAYLOAD',
    selectable: false
  },
  {
    path: 'payload.amount',
    label: '金额',
    type: 'NUMBER',
    source: 'PAYLOAD',
    expression: '$json.amount'
  },
  {
    path: 'payload.status',
    label: '状态',
    type: 'STRING',
    source: 'PAYLOAD',
    expression: '$json.status'
  }
];
const amount: PredicateCondition = {
  clientId: 'amount',
  type: 'CONDITION',
  field: 'payload.amount',
  operator: 'NUM_GT',
  value: '100.05'
};
const root = (children: readonly ConditionNode[] = [amount]): GroupCondition => ({
  clientId: 'root',
  type: 'GROUP',
  logic: 'AND',
  children
});
function Editor({
  initial = root(),
  disabled = false,
  fields = catalog,
  onChange
}: {
  initial?: Exclude<ConditionNode, { type: 'ALWAYS' }>;
  disabled?: boolean;
  fields?: readonly ConditionField[];
  onChange: (condition: ConditionNode) => void;
}) {
  const [condition, setCondition] = useState<ConditionNode>(initial);
  if (condition.type === 'ALWAYS') throw new Error('条件树编辑不得生成固定命中');
  return (
    <ConditionReferenceSetsProvider
      items={[{ code: 'REGION_CODES', label: '地区编码', fieldType: 'STRING' }]}
    >
      <ConditionTreeEditor
        condition={condition}
        catalog={fields}
        disabled={disabled}
        issuePathPrefix='rule.condition'
        issues={validateConditionTree(condition, fields, 'rule.condition')}
        onChange={(next) => {
          setCondition(next);
          onChange(next);
        }}
      />
    </ConditionReferenceSetsProvider>
  );
}

describe('通用条件树双输入编辑器', () => {
  it('已有目录条件在左右输入框回显，打开时不改写配置', () => {
    const changed = vi.fn();
    render(<Editor onChange={changed} />);
    expect(screen.getByRole('textbox', { name: '条件左值' })).toHaveValue('{{ $json.amount }}');
    expect(screen.getByRole('textbox', { name: '条件右值' })).toHaveValue('100.05');
    expect(screen.getByRole('tab', { name: '全部', selected: true })).toBeVisible();
    expect(screen.queryByRole('combobox', { name: '条件字段' })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it('左右值可直接输入动态语法，编辑后移除旧字段与固定值配置', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor initial={amount} onChange={changed} />);
    await user.clear(screen.getByRole('textbox', { name: '条件左值' }));
    await user.paste('{{ $json.total }}');
    await user.clear(screen.getByRole('textbox', { name: '条件右值' }));
    await user.paste("{{ $('查询订单').first().json.limit }}");
    expect(changed).toHaveBeenLastCalledWith({
      clientId: 'amount',
      type: 'CONDITION',
      field: '',
      operator: 'NUM_GT',
      leftValue: '{{ $json.total }}',
      rightValue: "{{ $('查询订单').first().json.limit }}"
    });
  });

  it('Tabs 切换全部或任一，支持嵌套并保留原条件', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor onChange={changed} />);
    await user.click(screen.getByRole('button', { name: '添加条件组' }));
    const nested = screen.getAllByRole('group', { name: '条件组 AND' }).at(-1)!;
    expect(within(nested).getByRole('textbox', { name: '条件左值' })).toHaveFocus();
    await user.click(within(nested).getByRole('tab', { name: '任一' }));
    await user.type(within(nested).getByRole('textbox', { name: '条件右值' }), '200.10');
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        logic: 'AND',
        children: [
          amount,
          expect.objectContaining({
            type: 'GROUP',
            logic: 'OR',
            children: [
              expect.objectContaining({ leftValue: '{{ $json.amount }}', rightValue: '200.10' })
            ]
          })
        ]
      })
    );
    expect(within(nested).getByRole('tab', { name: '任一', selected: true })).toBeVisible();
    await user.click(within(nested).getByRole('button', { name: '删除条件组' }));
    expect(changed).toHaveBeenLastCalledWith(root());
  });

  it('删除最后一条条件保留空组，重新添加不产生固定命中', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor onChange={changed} />);
    await user.click(screen.getByRole('button', { name: '删除条件' }));
    expect(changed).toHaveBeenLastCalledWith(root([]));
    expect(screen.getByRole('alert')).toHaveTextContent('条件组需包含 1 至 32 个直接子条件。');
    await user.click(screen.getByRole('button', { name: '添加条件' }));
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ leftValue: '{{ $json.amount }}', operator: 'NUM_EQ' })]
      })
    );
  });

  it('操作符独立于字段目录，存在性判断移除右值', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor initial={amount} onChange={changed} />);
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    await user.click(await screen.findByRole('option', { name: '存在' }));
    expect(changed).toHaveBeenLastCalledWith({
      clientId: 'amount',
      type: 'CONDITION',
      field: '',
      leftValue: '{{ $json.amount }}',
      operator: 'EXISTS'
    });
    expect(screen.queryByRole('textbox', { name: '条件右值' })).not.toBeInTheDocument();
  });

  it('大小比较只有一套数值选项，日期使用早于和晚于', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor initial={amount} onChange={changed} />);
    expect(screen.getByRole('combobox', { name: '条件操作符' })).toHaveTextContent('大于');
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    expect(await screen.findAllByRole('option', { name: '大于' })).toHaveLength(1);
    const textGroup = screen.getByRole('group', { name: '文本' });
    const numberGroup = screen.getByRole('group', { name: '数字' });
    expect(within(textGroup).getByRole('option', { name: '等于' })).toBeVisible();
    expect(within(textGroup).getByRole('option', { name: '属于' })).toBeVisible();
    expect(within(numberGroup).getByRole('option', { name: '数字等于' })).toBeVisible();
    expect(within(numberGroup).getByRole('option', { name: '数字属于' })).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: '日期' })).getByRole('option', { name: '早于' })
    ).toBeVisible();
    expect(screen.queryByRole('option', { name: '数字大于' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '早于' })).toBeVisible();
    expect(screen.getByRole('option', { name: '数字等于' })).toBeVisible();
    await user.click(screen.getByRole('option', { name: '小于' }));
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ operator: 'NUM_LT' }));
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    await user.click(await screen.findByRole('option', { name: '晚于' }));
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ operator: 'GT' }));
    expect(screen.getByRole('alert')).toHaveTextContent('日期比较');
    const right = screen.getByRole('textbox', { name: '条件右值' });
    await user.clear(right);
    await user.type(right, '2026-11-04 08:00:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('搜索分组名称时保留对应标题，键盘直接选择运算符', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor initial={amount} onChange={changed} />);
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    const search = await screen.findByPlaceholderText('搜索操作符');
    await user.type(search, '数字');
    expect(screen.getByRole('group', { name: '数字' })).toBeVisible();
    expect(screen.queryByRole('group', { name: '文本' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '日期' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '大于' })).toBeVisible();
    await user.clear(search);
    await user.type(search, '不存在的操作符');
    expect(screen.getByText('没有匹配的选项')).toBeVisible();
    expect(screen.queryByRole('group', { name: '数字' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, '数字等于');
    await user.keyboard('{Enter}');
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ operator: 'NUM_EQ' }));
    expect(screen.queryByPlaceholderText('搜索操作符')).not.toBeInTheDocument();
  });

  it('无目录也可配置常量与动态引用，普通固定值不强制选择字段', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Editor initial={root([])} fields={[]} onChange={changed} />);
    await user.click(screen.getByRole('button', { name: '添加条件' }));
    await user.type(screen.getByRole('textbox', { name: '条件左值' }), 'approved');
    await user.type(screen.getByRole('textbox', { name: '条件右值' }), 'approved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ leftValue: 'approved', rightValue: 'approved' })]
      })
    );
  });

  it('错误关联到右值，修正后清除；集合使用 JSON 数组输入', async () => {
    const user = userEvent.setup();
    render(
      <Editor
        initial={{
          ...amount,
          field: '',
          leftValue: '{{ $json.amount }}',
          rightValue: 'invalid',
          value: undefined
        }}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole('textbox', { name: '条件右值' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
    await user.clear(input);
    await user.type(input, '100.05');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    await user.click(await screen.findByRole('option', { name: '介于' }));
    expect(screen.getByRole('alert')).toHaveTextContent('JSON 数组');
    await user.clear(input);
    await user.paste('["100.00", "200.00"]');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('集合逐项编辑和原文同步，保留前导零、精确数值及变量引用', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{
          clientId: 'in',
          type: 'CONDITION',
          field: '',
          operator: 'IN',
          leftValue: '{{ $json.code }}',
          rightValue: '["001",100.000000000000000001,"{{ $json.expected }}"]'
        }}
        onChange={changed}
      />
    );
    expect(screen.queryByRole('tab', { name: '引用数据集合' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '集合值 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '条件右值' })).not.toBeInTheDocument();
    const summary = screen.getByRole('button', { name: '条件右值' });
    expect(summary).toHaveTextContent('["001",100.000000000000000001,"{{ $json.expected }}"]');
    expect(summary).toHaveAttribute(
      'title',
      '["001",100.000000000000000001,"{{ $json.expected }}"]'
    );
    await user.click(summary);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: '集合值 1' })).toHaveValue('001');
    expect(screen.getByRole('textbox', { name: '集合值 2' })).toHaveValue('100.000000000000000001');
    const third = screen.getByRole('textbox', { name: '集合值 3' });
    await user.clear(third);
    await user.paste('{{ $json.other }}');
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ rightValue: '["001",100.000000000000000001,"{{ $json.other }}"]' })
    );
    await user.click(screen.getByRole('button', { name: '添加一项' }));
    expect(screen.getByRole('textbox', { name: '集合值 4' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '删除集合值 4' }));
    expect(summary).toHaveTextContent('["001",100.000000000000000001,"{{ $json.other }}"]');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: '集合值 1' })).not.toBeInTheDocument();
    expect(summary).toHaveFocus();
  });

  it.each([
    ['{{ $json.codes }}', '正在引用动态数组，可从字段目录替换数组变量。'],
    ['["unfinished', '集合格式不完整，可重新逐项填写。'],
    ['[]', '直接填写，或拖入变量。']
  ])('打开集合 %s 不覆盖原值', async (rightValue, message) => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{
          clientId: 'in',
          type: 'CONDITION',
          field: '',
          operator: 'IN',
          leftValue: '{{ $json.code }}',
          rightValue
        }}
        onChange={changed}
      />
    );
    expect(screen.getByRole('button', { name: '条件右值' })).toHaveTextContent(rightValue);
    await user.click(screen.getByRole('button', { name: '条件右值' }));
    expect(screen.getByText(message)).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: '条件右值' })).not.toBeInTheDocument();
  });

  it('未配置的集合直接打开首项输入，逐项填写即可保存数组', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{ ...amount, operator: 'IN', field: '', leftValue: '001', rightValue: '' }}
        onChange={changed}
      />
    );
    await user.click(screen.getByRole('button', { name: '条件右值' }));
    await user.type(screen.getByRole('textbox', { name: '集合值 1' }), '001');
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ rightValue: '["001"]' }));
    expect(screen.getByRole('button', { name: '条件右值' })).toHaveTextContent('["001"]');
  });

  it('引用数据集合与输入数组互斥，修改左值保留引用且切换后可重新填写数组', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{
          clientId: 'in',
          type: 'CONDITION',
          field: '',
          operator: 'NOT_IN',
          leftValue: '{{ $json.code }}',
          rightValue: '["001"]'
        }}
        onChange={changed}
      />
    );
    expect(screen.queryByRole('button', { name: '集合选项' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '条件右值' }));
    await user.click(screen.getByRole('tab', { name: '引用集合' }));
    expect(screen.queryByRole('textbox', { name: '条件右值' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '引用集合' }));
    expect(await screen.findByRole('option', { name: '地区编码' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: '引用集合' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '集合值' })).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: '引用集合' }));
    await user.click(await screen.findByRole('option', { name: '地区编码' }));
    expect(screen.getByRole('dialog', { name: '集合值' })).toBeVisible();
    expect(screen.getByRole('button', { name: '条件右值' })).toHaveTextContent('地区编码');
    const left = screen.getByRole('textbox', { name: '条件左值' });
    await user.clear(left);
    await user.paste('{{ $json.port }}');
    expect(changed).toHaveBeenLastCalledWith({
      clientId: 'in',
      type: 'CONDITION',
      field: '',
      operator: 'NOT_IN',
      leftValue: '{{ $json.port }}',
      setRef: 'REGION_CODES'
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '条件右值' }));
    await user.click(screen.getByRole('tab', { name: '固定集合' }));
    expect(changed).toHaveBeenLastCalledWith({
      clientId: 'in',
      type: 'CONDITION',
      field: '',
      operator: 'NOT_IN',
      leftValue: '{{ $json.port }}',
      rightValue: '[""]'
    });
    expect(screen.getByRole('textbox', { name: '集合值 1' })).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: '条件右值' })).toHaveFocus();
  });

  it('集合浮层与操作符选择互斥，切换不会改写集合', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{ ...amount, field: '', operator: 'NUM_IN', leftValue: '1', rightValue: '[1,2]' }}
        onChange={changed}
      />
    );
    await user.click(screen.getByRole('button', { name: '条件右值' }));
    expect(screen.getByRole('textbox', { name: '集合值 1' })).toHaveValue('1');
    expect(screen.queryByRole('tab', { name: '引用集合' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    expect(screen.queryByRole('textbox', { name: '集合值 1' })).not.toBeInTheDocument();
    expect(await screen.findByPlaceholderText('搜索操作符')).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
  });

  it('右值浮层在当前弹窗内展开，Escape 关闭并恢复焦点', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <div role='dialog' aria-label='条件面板'>
        <Editor
          initial={{
            ...amount,
            field: '',
            operator: 'IN',
            leftValue: '001',
            rightValue: '["001"]'
          }}
          onChange={changed}
        />
      </div>
    );
    const trigger = screen.getByRole('button', { name: '条件右值' });
    await user.click(trigger);
    const popover = within(screen.getByRole('dialog', { name: '条件面板' })).getByRole('dialog', {
      name: '集合值'
    });
    expect(within(popover).getByRole('textbox', { name: '集合值 1' })).toHaveValue('001');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '集合值' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
  });

  it('引用集合改为普通比较时清除集合编码，避免将编码当作固定右值', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <Editor
        initial={{
          clientId: 'in',
          type: 'CONDITION',
          field: '',
          operator: 'IN',
          leftValue: '{{ $json.port }}',
          setRef: 'REGION_CODES'
        }}
        onChange={changed}
      />
    );
    await user.click(screen.getByRole('combobox', { name: '条件操作符' }));
    await user.click(await screen.findByRole('option', { name: '等于' }));
    expect(changed).toHaveBeenLastCalledWith({
      clientId: 'in',
      type: 'CONDITION',
      field: '',
      operator: 'EQ',
      leftValue: '{{ $json.port }}',
      rightValue: ''
    });
    expect(screen.getByRole('textbox', { name: '条件右值' })).toHaveValue('');
  });

  it('五层边界仍可编辑已有条件，限制继续添加组', () => {
    let nested = root();
    for (let index = 0; index < 3; index++)
      nested = { ...root([nested]), clientId: `depth-${index}` };
    render(<Editor initial={nested} onChange={vi.fn()} />);
    const inner = within(screen.getAllByRole('group', { name: '条件组 AND' }).at(-1)!);
    expect(inner.getByRole('button', { name: '添加条件组' })).toBeDisabled();
    expect(inner.getByText('条件树最大深度为 5 层。')).toBeVisible();
    expect(inner.getByRole('textbox', { name: '条件右值' })).toBeEnabled();
  });

  it('限制直接子条件数和总节点数，展示限制原因', () => {
    const many = Array.from({ length: 32 }, (_, index) => ({
      ...amount,
      clientId: `leaf-${index}`
    }));
    const view = render(<Editor initial={root(many)} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '添加条件' })).toBeDisabled();
    expect(screen.getByText('单个条件组最多支持 32 个直接子节点。')).toBeVisible();
    view.unmount();
    render(
      <Editor
        initial={root([
          { ...root(many), clientId: 'left' },
          {
            ...root(many.slice(3).map((leaf) => ({ ...leaf, clientId: `right-${leaf.clientId}` }))),
            clientId: 'right'
          }
        ])}
        onChange={vi.fn()}
      />
    );
    for (const button of screen.getAllByRole('button', { name: /^添加条件/ }))
      expect(button).toBeDisabled();
    expect(screen.getAllByText('单棵条件树最多支持 64 个节点。').length).toBeGreaterThan(0);
  });

  it('新增节点避开导入的 ID 并保留原规则', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const sequence = Number(createConditionClientId('condition').split('-').at(-1));
    const initial = root(
      Array.from({ length: 6 }, (_, index) => ({
        ...amount,
        clientId: `condition-${sequence + index + 1}`
      }))
    );
    render(<Editor initial={initial} onChange={changed} />);
    await user.click(screen.getByRole('button', { name: '添加条件组' }));
    const next = changed.mock.lastCall![0] as GroupCondition;
    expect(indexConditionTree(next).size).toBe(getConditionMetrics(next).nodeCount);
    expect(next.children.slice(0, 6)).toEqual(initial.children);
  });

  it('只读模式展示嵌套配置并禁用输入、Tabs 和结构操作', () => {
    const changed = vi.fn();
    render(
      <Editor
        disabled
        initial={root([
          amount,
          { ...amount, clientId: 'collection', operator: 'NUM_IN', value: '["1","2"]' },
          { ...root([{ ...amount, clientId: 'nested-leaf' }]), clientId: 'nested', logic: 'OR' }
        ])}
        onChange={changed}
      />
    );
    for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    for (const tab of screen.getAllByRole('tab')) expect(tab).toBeDisabled();
    expect(screen.getAllByRole('textbox', { name: '条件右值' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: '条件右值' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '集合选项' })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});
