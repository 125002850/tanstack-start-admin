import { Handle, Position, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { CONDITION_INPUT_OPERATOR_LABELS } from '../lib/condition-operands';
import {
  createPredicateCondition,
  getConditionField,
  getConditionOperators,
  getConditionOperatorGroup,
  isConditionFieldSelectable,
  type ConditionOperator
} from '../model/condition-model';
import { RoutingCanvasConditionValueEditor } from './condition-value-editor';
import { ConditionSearchSelect } from './condition-search-select';
import type {
  RoutingCanvasConditionData,
  RoutingCanvasGroupData,
  RoutingCanvasStartData
} from './condition-canvas-types';

function RoutingCanvasStartNode({ data }: NodeProps<Node<RoutingCanvasStartData, 'start'>>) {
  return (
    <button
      className='routing-canvas-start-node nodrag nopan'
      data-active={data.active}
      onClick={data.onSelect}
      type='button'
    >
      <Icons.circleCheck className='size-4' />
      开始命中
      <Handle
        className='routing-canvas-handle'
        isConnectable={false}
        position={Position.Bottom}
        type='source'
      />
    </button>
  );
}

function RoutingCanvasGroupNode({ data }: NodeProps<Node<RoutingCanvasGroupData, 'group'>>) {
  return (
    <article
      aria-label={`条件组 ${data.condition.logic}`}
      className='routing-canvas-node routing-canvas-group-node nopan'
      data-active={data.active}
      data-invalid={data.error === undefined ? undefined : 'true'}
      onFocusCapture={data.onSelect}
    >
      <Handle
        className='routing-canvas-handle'
        isConnectable={false}
        position={Position.Top}
        type='target'
      />
      <div
        className='routing-canvas-group-header routing-canvas-node-drag-handle'
        title='拖动条件组'
      >
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <Icons.gripVertical className='size-4' />
          逻辑运算
        </span>
        {data.onRemove === undefined ? null : (
          <Button
            aria-label='删除条件组'
            className='nodrag nopan'
            disabled={data.disabled}
            onClick={(event) => {
              event.stopPropagation();
              data.onRemove?.();
            }}
            size='icon'
            type='button'
            variant='ghost'
          >
            <Icons.trash className='size-4' />
          </Button>
        )}
      </div>
      <ToggleGroup
        aria-label='条件组逻辑'
        className='nodrag nopan w-full'
        disabled={data.disabled}
        onValueChange={(value) => {
          if (value === 'AND' || value === 'OR') data.onLogicChange(value);
        }}
        size='sm'
        type='single'
        value={data.condition.logic}
        variant='outline'
      >
        <ToggleGroupItem className='flex-1' value='AND'>
          且 AND
        </ToggleGroupItem>
        <ToggleGroupItem className='flex-1' value='OR'>
          或 OR
        </ToggleGroupItem>
      </ToggleGroup>
      {data.error === undefined ? null : (
        <p className='text-destructive truncate text-xs' title={data.error}>
          {data.error}
        </p>
      )}
      <RoutingCanvasAddChildButton
        disabledReason={data.addDisabledReason}
        label='向条件组添加子条件'
        onClick={data.onAddCondition}
      />
      <Handle
        className='routing-canvas-handle'
        isConnectable={false}
        position={Position.Bottom}
        type='source'
      />
    </article>
  );
}

function RoutingCanvasConditionNode({
  data
}: NodeProps<Node<RoutingCanvasConditionData, 'condition'>>) {
  const field = getConditionField(data.catalog, data.condition.field);
  const operators = field === undefined ? [] : getConditionOperators(field);
  const changeField = (fieldPath: string) => {
    const nextField = getConditionField(data.catalog, fieldPath);
    if (nextField === undefined) return;
    data.onChange(createPredicateCondition(nextField, data.condition.clientId));
  };
  const changeOperator = (operator: ConditionOperator) => {
    if (field === undefined) return;
    data.onChange(createPredicateCondition(field, data.condition.clientId, operator));
  };

  return (
    <article
      aria-label={`条件 ${data.condition.field}`}
      className='routing-canvas-node routing-canvas-condition-node nopan'
      data-active={data.active}
      data-invalid={data.error === undefined ? undefined : 'true'}
      onFocusCapture={data.onSelect}
    >
      <Handle
        className='routing-canvas-handle'
        isConnectable={false}
        position={Position.Top}
        type='target'
      />
      <div
        className='routing-canvas-condition-header routing-canvas-node-drag-handle'
        title='拖动条件节点'
      >
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <Icons.gripVertical className='size-4' />
          命中条件
        </span>
        <div className='flex items-center gap-1'>
          <Button
            aria-label='删除条件'
            className='nodrag nopan'
            disabled={data.disabled}
            onClick={(event) => {
              event.stopPropagation();
              data.onRemove();
            }}
            size='icon'
            type='button'
            variant='ghost'
          >
            <Icons.trash className='size-4' />
          </Button>
        </div>
      </div>
      <FieldGroup className='gap-2'>
        <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-2'>
          <Field>
            <FieldLabel className='sr-only'>条件字段</FieldLabel>
            <ConditionSearchSelect
              disabled={data.disabled}
              onValueChange={changeField}
              options={data.catalog.filter(isConditionFieldSelectable).map((option) => ({
                value: option.path,
                label: option.label,
                description: option.description
              }))}
              overlayId={`field:${data.condition.clientId}`}
              placeholder='选择字段'
              searchPlaceholder='搜索字段名称、路径或说明'
              triggerLabel='条件字段'
              value={data.condition.field}
            />
          </Field>
          <Field>
            <FieldLabel className='sr-only'>条件操作符</FieldLabel>
            <ConditionSearchSelect
              disabled={data.disabled || field === undefined}
              onValueChange={changeOperator}
              options={operators.map((operator) => ({
                value: operator,
                label: CONDITION_INPUT_OPERATOR_LABELS[operator],
                group: getConditionOperatorGroup(operator, field?.type)
              }))}
              overlayId={`operator:${data.condition.clientId}`}
              placeholder='选择操作符'
              searchPlaceholder='搜索操作符'
              triggerLabel='条件操作符'
              value={data.condition.operator}
            />
          </Field>
        </div>
        <RoutingCanvasConditionValueEditor
          catalog={data.catalog}
          condition={data.condition}
          disabled={data.disabled}
          field={field}
          onChange={data.onChange}
        />
      </FieldGroup>
      {data.error === undefined ? null : <FieldError>{data.error}</FieldError>}
      <RoutingCanvasAddChildButton
        disabledReason={data.addDisabledReason}
        icon={<Icons.branch className='size-4' />}
        label='添加同组条件'
        onClick={data.onAddCondition}
      />
      <Handle
        className='routing-canvas-handle'
        isConnectable={false}
        position={Position.Bottom}
        type='source'
      />
    </article>
  );
}

export const ROUTING_CANVAS_NODE_TYPES = {
  start: React.memo(RoutingCanvasStartNode, (previous, next) => previous.data === next.data),
  logic: React.memo(RoutingCanvasGroupNode, (previous, next) => previous.data === next.data),
  condition: React.memo(RoutingCanvasConditionNode, (previous, next) => previous.data === next.data)
} satisfies NodeTypes;

function RoutingCanvasAddChildButton({
  disabledReason,
  icon = <Icons.add className='size-4' />,
  label,
  onClick
}: {
  readonly disabledReason?: string;
  readonly icon?: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className='routing-canvas-node-add nodrag nopan'
      disabled={disabledReason !== undefined}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      size='icon'
      title={disabledReason ?? label}
      type='button'
      variant='outline'
    >
      {icon}
    </Button>
  );
}
