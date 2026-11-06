import { useId, useMemo, useRef, type ReactNode, type RefCallback } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DecisionTree,
  DecisionTreeChildren,
  DecisionTreeGroup,
  DecisionTreeHeader,
  DecisionTreeItem
} from '@/components/ui/decision-tree';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  conditionFieldInput,
  CONDITION_INPUT_OPERATOR_LABELS,
  CONDITION_INPUT_OPERATORS,
  conditionOperatorUsesCollection,
  createInputCondition,
  getConditionOperands
} from '../lib/condition-operands';
import {
  appendConditionChild,
  appendConditionSibling,
  getConditionAddDisabledReason,
  indexConditionTree,
  updateConditionNode
} from '../lib/condition-tree';
import {
  createConditionClientId,
  getConditionMetrics,
  getConditionOperatorGroup,
  isConditionFieldSelectable,
  routingOperatorUsesNoValue,
  type ConditionField,
  type ConditionIssue,
  type ConditionNode,
  type GroupCondition,
  type PredicateCondition
} from '../model/condition-model';
import { ConditionSearchSelect } from './condition-search-select';
import { ConditionCollectionEditor } from './condition-collection-editor';
import { RoutingReferenceSetName } from './routing-reference-set-selector';
import {
  RoutingCanvasOverlayProvider,
  useRoutingCanvasOverlayOpen
} from './routing-canvas-overlay-context';

type EditableCondition = Exclude<ConditionNode, { type: 'ALWAYS' }>;

export interface ConditionOperandInputProps {
  readonly conditionId: string;
  readonly side: 'left' | 'right';
  readonly collectionIndex?: number;
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly describedBy?: string;
  readonly inputRef?: RefCallback<HTMLElement>;
  readonly placeholder: string;
  readonly className?: string;
  readonly collectionSummary?: {
    readonly text: string;
    readonly open: boolean;
    readonly onOpen: () => void;
  };
  readonly onChange: (value: string) => void;
}

export interface ConditionTreeEditorProps {
  readonly className?: string;
  readonly renderOperand?: (props: ConditionOperandInputProps) => ReactNode;
  readonly header?: ReactNode;
  readonly condition: EditableCondition;
  readonly catalog: readonly ConditionField[];
  readonly disabled?: boolean;
  readonly issues?: readonly ConditionIssue[];
  readonly issuePathPrefix?: string;
  readonly onChange: (condition: ConditionNode, coalesceKey?: string) => void;
}

type TreeEditor = {
  readonly renderOperand?: ConditionTreeEditorProps['renderOperand'];
  readonly catalog: readonly ConditionField[];
  readonly selectableCatalog: readonly ConditionField[];
  readonly disabled: boolean;
  readonly issues: readonly ConditionIssue[];
  readonly metrics: ReturnType<typeof getConditionMetrics>;
  readonly treeIndex: ReturnType<typeof indexConditionTree>;
  readonly focusOperand: (nodeId: string, input: HTMLElement | null) => void;
  readonly change: (node: ConditionNode, coalesceKey?: string) => void;
  readonly remove: (nodeId: string) => void;
  readonly add: (targetId: string, kind: 'CONDITION' | 'GROUP') => void;
};

const EMPTY_ISSUES: readonly ConditionIssue[] = [];

export function ConditionTreeEditor({
  className,
  condition,
  catalog,
  disabled = false,
  issues = EMPTY_ISSUES,
  issuePathPrefix = 'condition',
  renderOperand,
  header,
  onChange
}: ConditionTreeEditorProps) {
  const pendingFocus = useRef<string | null>(null);
  const treeIndex = useMemo(() => indexConditionTree(condition), [condition]);
  const metrics = useMemo(() => getConditionMetrics(condition), [condition]);
  const selectableCatalog = useMemo(() => catalog.filter(isConditionFieldSelectable), [catalog]);
  const editor: TreeEditor = {
    renderOperand,
    catalog,
    selectableCatalog,
    disabled,
    issues,
    treeIndex,
    metrics,
    focusOperand(nodeId, input) {
      if (!disabled && input && pendingFocus.current === nodeId) {
        pendingFocus.current = null;
        input.focus();
      }
    },
    change(next, coalesceKey) {
      if (disabled) return;
      onChange(
        updateConditionNode(condition, next.clientId, () => next),
        coalesceKey === undefined ? undefined : `${next.clientId}:${coalesceKey}`
      );
    },
    remove(nodeId) {
      if (disabled) return;
      const parentId = treeIndex.get(nodeId)?.parentId;
      if (parentId === undefined) return;
      // 保留空组，避免删除最后一条条件后变成固定命中。
      const next =
        parentId === null
          ? {
              clientId: condition.clientId,
              type: 'GROUP' as const,
              logic: 'AND' as const,
              children: []
            }
          : updateConditionNode(condition, parentId, (parent) =>
              parent.type === 'GROUP'
                ? {
                    ...parent,
                    children: parent.children.filter((child) => child.clientId !== nodeId)
                  }
                : parent
            );
      onChange(next);
    },
    add(targetId, kind) {
      if (
        getConditionAddDisabledReason({
          disabled,
          kind,
          metrics,
          targetId,
          treeIndex
        }) !== undefined
      )
        return;
      // 已保存和导入的条件保留原 ID，新增时避开这些 ID。
      const createId = () => {
        let id = createConditionClientId('condition');
        while (treeIndex.has(id)) id = createConditionClientId('condition');
        return id;
      };
      const field = selectableCatalog[0];
      const predicate = () =>
        createInputCondition(
          createId(),
          conditionFieldInput(field),
          '',
          field?.type === 'NUMBER' ? 'NUM_EQ' : 'EQ'
        );
      const firstCondition = predicate();
      const child: ConditionNode =
        kind === 'GROUP'
          ? {
              clientId: createId(),
              type: 'GROUP',
              logic: 'AND',
              children: [firstCondition]
            }
          : firstCondition;
      const target = treeIndex.get(targetId)?.node;
      const next =
        target?.type === 'GROUP'
          ? appendConditionChild(condition, targetId, child)
          : appendConditionSibling(condition, targetId, child, (children) => ({
              clientId: createId(),
              type: 'GROUP',
              logic: 'AND',
              children
            }));
      pendingFocus.current = firstCondition.clientId;
      onChange(next);
    }
  };

  return (
    <RoutingCanvasOverlayProvider>
      {header}
      <FieldGroup aria-label='条件树' className='gap-3'>
        <DecisionTree className={className}>
          {condition.type === 'CONDITION' ? (
            <DecisionTreeGroup aria-label='条件组'>
              <DecisionTreeHeader>
                <span className='text-sm font-medium'>条件组</span>
                <div className='ml-auto'>
                  <ConditionTreeActions
                    editor={editor}
                    targetId={condition.clientId}
                    kind='GROUP'
                  />
                </div>
              </DecisionTreeHeader>
              <DecisionTreeChildren>
                <DecisionTreeItem>
                  <ConditionTreeNode editor={editor} node={condition} path={issuePathPrefix} />
                </DecisionTreeItem>
                <DecisionTreeItem>
                  <FieldGroup className='min-h-9 justify-center gap-2'>
                    <ConditionTreeActions
                      editor={editor}
                      targetId={condition.clientId}
                      kind='CONDITION'
                    />
                  </FieldGroup>
                </DecisionTreeItem>
              </DecisionTreeChildren>
            </DecisionTreeGroup>
          ) : (
            <ConditionTreeNode editor={editor} node={condition} path={issuePathPrefix} />
          )}
        </DecisionTree>
      </FieldGroup>
    </RoutingCanvasOverlayProvider>
  );
}

function ConditionTreeNode({
  editor,
  node,
  path
}: {
  readonly editor: TreeEditor;
  readonly node: ConditionNode;
  readonly path: string;
}) {
  if (node.type === 'CONDITION') {
    return <ConditionTreePredicate editor={editor} node={node} path={path} />;
  }
  if (node.type === 'ALWAYS') {
    return (
      <Field data-invalid>
        <FieldError>此子条件不受支持，请删除并重新配置。</FieldError>
        <ConditionTreeRemove editor={editor} node={node} />
      </Field>
    );
  }
  return <ConditionTreeGroupNode editor={editor} node={node} path={path} />;
}

function ConditionTreeGroupNode({
  editor,
  node,
  path
}: {
  readonly editor: TreeEditor;
  readonly node: GroupCondition;
  readonly path: string;
}) {
  const errorId = useId();
  const error = editor.issues.find(
    (issue) => issue.path === path || issue.path === `${path}.children`
  )?.message;
  const isRoot = editor.treeIndex.get(node.clientId)?.parentId === null;
  return (
    <DecisionTreeGroup aria-label={`条件组 ${node.logic}`}>
      <Tabs
        className='min-w-0 gap-2'
        value={node.logic}
        onValueChange={(logic) => {
          if (!editor.disabled && (logic === 'AND' || logic === 'OR'))
            editor.change({ ...node, logic });
        }}
      >
        <DecisionTreeHeader>
          <TabsList
            aria-label='条件组逻辑'
            aria-describedby={error === undefined ? undefined : errorId}
            aria-invalid={error !== undefined}
          >
            <TabsTrigger disabled={editor.disabled} value='AND'>
              全部
            </TabsTrigger>
            <TabsTrigger disabled={editor.disabled} value='OR'>
              任一
            </TabsTrigger>
          </TabsList>
          <div className='ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1'>
            <ConditionTreeActions editor={editor} targetId={node.clientId} kind='GROUP' />
            {isRoot ? null : <ConditionTreeRemove editor={editor} node={node} />}
          </div>
        </DecisionTreeHeader>
        <TabsContent value={node.logic} className='min-w-0'>
          <DecisionTreeChildren>
            {node.children.length === 0 ? (
              <DecisionTreeItem>
                <FieldDescription>暂无条件，请添加条件。</FieldDescription>
              </DecisionTreeItem>
            ) : null}
            {node.children.map((child, index) => (
              <DecisionTreeItem key={child.clientId}>
                <ConditionTreeNode
                  editor={editor}
                  node={child}
                  path={`${path}.children.${index}`}
                />
              </DecisionTreeItem>
            ))}
            <DecisionTreeItem>
              <FieldGroup className='min-h-9 justify-center gap-2'>
                <ConditionTreeActions editor={editor} targetId={node.clientId} kind='CONDITION' />
              </FieldGroup>
            </DecisionTreeItem>
          </DecisionTreeChildren>
        </TabsContent>
      </Tabs>
      {error === undefined ? null : <FieldError id={errorId}>{error}</FieldError>}
    </DecisionTreeGroup>
  );
}

function ConditionTreePredicate({
  editor,
  node,
  path
}: {
  readonly editor: TreeEditor;
  readonly node: PredicateCondition;
  readonly path: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const errors = editor.issues.filter(
    (issue) => issue.path === path || issue.path.startsWith(`${path}.`)
  );
  const operands = getConditionOperands(node, editor.catalog);
  const fieldInvalid = errors.some(
    (issue) =>
      issue.path === path || issue.path === `${path}.field` || issue.path === `${path}.leftValue`
  );
  const operatorInvalid = errors.some(
    (issue) => issue.path === path || issue.path === `${path}.operator`
  );
  const valueInvalid = errors.some(
    (issue) =>
      issue.path !== `${path}.field` &&
      issue.path !== `${path}.leftValue` &&
      issue.path !== `${path}.operator`
  );
  const usesValue = !routingOperatorUsesNoValue(node.operator);
  const supportsSet = node.operator === 'IN' || node.operator === 'NOT_IN';
  const membership = supportsSet || node.operator === 'NUM_IN' || node.operator === 'NUM_NOT_IN';
  const collectionOverlay = useRoutingCanvasOverlayOpen(`collection:${node.clientId}`);
  const collectionTrigger = useRef<HTMLElement | null>(null);
  const change = (left: string, right: string, coalesceKey?: string, operator = node.operator) => {
    const next = createInputCondition(
      node.clientId,
      left,
      node.setRef !== undefined ? '' : right,
      operator
    );
    if (node.setRef !== undefined && (operator === 'IN' || operator === 'NOT_IN')) {
      const { rightValue: _, ...base } = next;
      editor.change({ ...base, setRef: node.setRef }, coalesceKey);
    } else editor.change(next, coalesceKey);
  };
  const setCollectionOpen = (open: boolean) => {
    if (open && editor.disabled) return;
    if (open && node.setRef === undefined && !operands.right.trim()) change(operands.left, '[""]');
    collectionOverlay.onOpenChange(open);
  };
  const rightOperand: ConditionOperandInputProps = {
    conditionId: node.clientId,
    side: 'right',
    id: `${id}-right`,
    label: '条件右值',
    value: operands.right,
    disabled: editor.disabled,
    invalid: valueInvalid,
    describedBy: valueInvalid ? errorId : undefined,
    inputRef: membership
      ? (element) => {
          collectionTrigger.current = element;
        }
      : undefined,
    placeholder: conditionOperatorUsesCollection(node.operator)
      ? 'JSON 数组或 {{ $json.values }}'
      : '固定值或 {{ $json.limit }}',
    className: 'rounded-none border-0 bg-transparent shadow-none ring-0',
    collectionSummary: membership
      ? {
          text: operands.right.trim()
            ? operands.right
            : node.setRef === undefined
              ? '填写集合'
              : '选择引用集合',
          open: collectionOverlay.open,
          onOpen: () => setCollectionOpen(true)
        }
      : undefined,
    onChange: (value) => change(operands.left, value, 'rightValue')
  };
  const reference =
    supportsSet && node.setRef !== undefined
      ? {
          value: node.setRef,
          onChange: (setRef: string) =>
            editor.change({
              clientId: node.clientId,
              type: 'CONDITION',
              field: '',
              operator: node.operator,
              leftValue: operands.left,
              setRef
            })
        }
      : undefined;
  const rightControl = (
    <InputGroup
      className={cn(
        'h-auto items-start overflow-hidden',
        'has-[[data-mapping-target]]:border-primary has-[[data-mapping-target]]:ring-primary/20 has-[[data-mapping-target]]:ring-2 has-[[data-drop-target]]:border-primary has-[[data-drop-target]]:border-dashed',
        valueInvalid && 'border-destructive'
      )}
    >
      <div className='min-w-0 flex-1'>
        {reference || (!editor.renderOperand && rightOperand.collectionSummary) ? (
          <Button
            ref={rightOperand.inputRef}
            id={rightOperand.id}
            type='button'
            variant='ghost'
            className='w-full min-w-0 justify-start overflow-hidden font-normal'
            aria-label={rightOperand.label}
            aria-invalid={rightOperand.invalid}
            aria-describedby={rightOperand.describedBy}
            aria-haspopup='dialog'
            aria-expanded={collectionOverlay.open}
            title={rightOperand.collectionSummary?.text}
            disabled={rightOperand.disabled}
            onClick={() => setCollectionOpen(true)}
          >
            <span className={cn('truncate', !reference && 'font-mono')}>
              {reference ? (
                reference.value ? (
                  <RoutingReferenceSetName code={reference.value} />
                ) : (
                  '选择引用集合'
                )
              ) : (
                rightOperand.collectionSummary?.text
              )}
            </span>
          </Button>
        ) : editor.renderOperand ? (
          editor.renderOperand(rightOperand)
        ) : (
          <InputGroupInput
            id={`${id}-right`}
            aria-invalid={valueInvalid}
            aria-describedby={valueInvalid ? errorId : undefined}
            disabled={editor.disabled}
            onChange={(event) => change(operands.left, event.target.value, 'rightValue')}
            placeholder={rightOperand.placeholder}
            value={operands.right}
          />
        )}
      </div>
    </InputGroup>
  );
  return (
    <FieldSet aria-label={`条件 ${operands.left}`} className='gap-2'>
      <div className='flex min-w-0 items-start gap-2'>
        <FieldGroup className='gap-2'>
          <div
            className={cn(
              'grid min-w-0 grid-cols-1 gap-2',
              usesValue
                ? '@min-[20rem]/field-group:grid-cols-[6rem_minmax(0,1fr)] @min-[24rem]/field-group:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]'
                : '@min-[20rem]/field-group:grid-cols-[minmax(0,1fr)_6rem]'
            )}
          >
            <Field
              data-invalid={fieldInvalid}
              className={cn(
                usesValue &&
                  '@min-[20rem]/field-group:col-span-2 @min-[24rem]/field-group:col-span-1'
              )}
            >
              <FieldLabel className='sr-only' htmlFor={`${id}-left`}>
                条件左值
              </FieldLabel>
              {editor.renderOperand ? (
                editor.renderOperand({
                  conditionId: node.clientId,
                  side: 'left',
                  id: `${id}-left`,
                  label: '条件左值',
                  value: operands.left,
                  disabled: editor.disabled,
                  invalid: fieldInvalid,
                  describedBy: fieldInvalid ? errorId : undefined,
                  inputRef: (input) => editor.focusOperand(node.clientId, input),
                  placeholder: '固定值或 {{ $json.amount }}',
                  onChange: (value) => change(value, operands.right, 'leftValue')
                })
              ) : (
                <Input
                  ref={(input) => editor.focusOperand(node.clientId, input)}
                  id={`${id}-left`}
                  aria-invalid={fieldInvalid}
                  aria-describedby={fieldInvalid ? errorId : undefined}
                  disabled={editor.disabled}
                  onChange={(event) => change(event.target.value, operands.right, 'leftValue')}
                  placeholder='固定值或 {{ $json.amount }}'
                  value={operands.left}
                />
              )}
            </Field>
            <Field data-invalid={operatorInvalid}>
              <FieldLabel className='sr-only'>条件操作符</FieldLabel>
              <ConditionSearchSelect
                aria-invalid={operatorInvalid}
                aria-describedby={operatorInvalid ? errorId : undefined}
                disabled={editor.disabled}
                onValueChange={(operator) => {
                  change(operands.left, operands.right, undefined, operator);
                }}
                options={CONDITION_INPUT_OPERATORS.map((operator) => ({
                  value: operator,
                  label: CONDITION_INPUT_OPERATOR_LABELS[operator],
                  group: getConditionOperatorGroup(operator)
                }))}
                overlayId={`operator:${node.clientId}`}
                placeholder={CONDITION_INPUT_OPERATOR_LABELS[node.operator]}
                searchPlaceholder='搜索操作符'
                triggerLabel='条件操作符'
                value={node.operator}
              />
            </Field>
            {usesValue ? (
              <Field data-invalid={valueInvalid}>
                <FieldLabel className='sr-only' htmlFor={`${id}-right`}>
                  条件右值
                </FieldLabel>
                {membership ? (
                  <ConditionCollectionEditor
                    operand={rightOperand}
                    renderOperand={editor.renderOperand}
                    open={collectionOverlay.open}
                    onOpenChange={setCollectionOpen}
                    finalFocus={collectionTrigger}
                    reference={reference}
                    onSourceChange={
                      supportsSet
                        ? (source) => {
                            if (editor.disabled) return;
                            const base = {
                              clientId: node.clientId,
                              type: 'CONDITION' as const,
                              field: '',
                              operator: node.operator,
                              leftValue: operands.left
                            };
                            editor.change(
                              source === 'set'
                                ? { ...base, setRef: '' }
                                : { ...base, rightValue: '[""]' }
                            );
                          }
                        : undefined
                    }
                  >
                    {rightControl}
                  </ConditionCollectionEditor>
                ) : (
                  rightControl
                )}
              </Field>
            ) : null}
          </div>
          {errors.length > 0 ? <FieldError errors={errors} id={errorId} /> : null}
        </FieldGroup>
        <ConditionTreeRemove editor={editor} node={node} />
      </div>
    </FieldSet>
  );
}

function ConditionTreeActions({
  editor,
  targetId,
  kind
}: {
  readonly editor: TreeEditor;
  readonly targetId: string;
  readonly kind: 'CONDITION' | 'GROUP';
}) {
  const reason = (kind: 'CONDITION' | 'GROUP') =>
    getConditionAddDisabledReason({
      disabled: editor.disabled,
      kind,
      metrics: editor.metrics,
      targetId,
      treeIndex: editor.treeIndex
    });
  const conditionReason = reason('CONDITION');
  const groupReason = reason('GROUP');
  return (
    <>
      <Button
        className='self-start'
        disabled={reason(kind) !== undefined}
        onClick={() => editor.add(targetId, kind)}
        size='sm'
        type='button'
        variant='outline'
      >
        {kind === 'CONDITION' ? (
          <Icons.add className='size-4' data-icon='inline-start' />
        ) : (
          <Icons.branch className='size-4' data-icon='inline-start' />
        )}
        {kind === 'CONDITION' ? '添加条件' : '添加条件组'}
      </Button>
      {kind === 'CONDITION' &&
      !editor.disabled &&
      (conditionReason ?? groupReason) !== undefined ? (
        <FieldDescription>{conditionReason ?? groupReason}</FieldDescription>
      ) : null}
    </>
  );
}

function ConditionTreeRemove({
  editor,
  node
}: {
  readonly editor: TreeEditor;
  readonly node: ConditionNode;
}) {
  const label = node.type === 'GROUP' ? '删除条件组' : '删除条件';
  return (
    <Button
      aria-label={label}
      className='ml-auto shrink-0'
      disabled={editor.disabled}
      onClick={() => editor.remove(node.clientId)}
      size='icon'
      title={label}
      type='button'
      variant='ghost'
    >
      <Icons.trash className='size-4' />
    </Button>
  );
}
