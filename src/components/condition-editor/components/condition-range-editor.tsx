import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  conditionCollectionItemInput,
  readConditionCollection,
  replaceConditionCollectionItem
} from '../lib/condition-operands';
import type { ConditionField, ConditionIssue } from '../model/condition-model';
import { ConditionOperandInput } from './condition-operand-input';
import type { ConditionOperandInputProps, ConditionTreeEditorProps } from './condition-tree-editor';

export function ConditionRangeEditor({
  operand,
  catalog,
  renderOperand,
  issues,
  path
}: {
  readonly operand: ConditionOperandInputProps;
  readonly catalog: readonly ConditionField[];
  readonly renderOperand?: ConditionTreeEditorProps['renderOperand'];
  readonly issues: readonly ConditionIssue[];
  readonly path: string;
}) {
  const [showSource, setShowSource] = useState(false);
  const items = readConditionCollection(operand.value);
  const canSplit = items !== undefined && (items.length === 0 || items.length === 2);
  const isBoundaryIssue = (issue: ConditionIssue, index: number) =>
    issue.path === `${path}.rightValue.${index}` || issue.path === `${path}.values.${index}`;
  const generalIssues = issues.filter(
    (issue) => !isBoundaryIssue(issue, 0) && !isBoundaryIssue(issue, 1)
  );
  if (showSource || !canSplit) {
    const props: ConditionOperandInputProps = {
      ...operand,
      className: undefined,
      label: '区间表达式',
      placeholder: '{{ $json.range }}',
      describedBy: issues.length ? `${operand.id}-error` : undefined
    };
    return (
      <Field className='gap-2' data-invalid={issues.length > 0}>
        <FieldLabel htmlFor={props.id}>区间表达式</FieldLabel>
        {renderOperand ? (
          renderOperand(props)
        ) : (
          <Input
            id={props.id}
            aria-invalid={props.invalid}
            aria-describedby={props.describedBy}
            disabled={props.disabled}
            spellCheck={false}
            placeholder={props.placeholder}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
          />
        )}
        <FieldError id={`${operand.id}-error`} errors={[...issues]} />
        <Button
          type='button'
          size='sm'
          variant='link'
          className='h-auto self-start justify-start p-0 text-xs'
          disabled={operand.disabled}
          onClick={() => {
            if (!canSplit) operand.onChange('["",""]');
            setShowSource(false);
          }}
        >
          分别填写上下限
        </Button>
      </Field>
    );
  }
  return (
    <FieldGroup className='@container/range mb-0 gap-2'>
      <div className='grid min-w-0 grid-cols-1 items-start gap-2 @min-[16rem]/range:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
        {(['下限', '上限'] as const).map((label, index) => {
          const errors = issues.filter((issue) => isBoundaryIssue(issue, index));
          const errorId = `${operand.id}-${index}-error`;
          const describedBy =
            [
              errors.length ? errorId : undefined,
              generalIssues.length ? `${operand.id}-error` : undefined
            ]
              .filter(Boolean)
              .join(' ') || undefined;
          const props: ConditionOperandInputProps = {
            ...operand,
            className: undefined,
            id: `${operand.id}-${index}`,
            label,
            collectionIndex: index,
            value: conditionCollectionItemInput(items[index] ?? '""'),
            invalid: errors.length > 0 || generalIssues.length > 0,
            describedBy,
            placeholder: `输入${label}…`,
            onChange: (value) =>
              operand.onChange(
                replaceConditionCollectionItem(
                  items.length ? operand.value : '["",""]',
                  index,
                  value
                )
              )
          };
          return (
            <Field key={label} className='gap-2' data-invalid={props.invalid}>
              <FieldLabel htmlFor={props.id}>{label}</FieldLabel>
              {renderOperand ? (
                renderOperand(props)
              ) : (
                <ConditionOperandInput operand={props} catalog={catalog} />
              )}
              <FieldError id={errorId} errors={errors} />
            </Field>
          );
        })}
        <span
          aria-hidden='true'
          className='text-muted-foreground col-start-2 row-start-1 hidden self-start pt-8 text-sm @min-[16rem]/range:block'
        >
          至
        </span>
      </div>
      <FieldError id={`${operand.id}-error`} errors={generalIssues} />
      <Button
        type='button'
        size='sm'
        variant='link'
        className='h-auto self-start justify-start p-0 text-xs'
        disabled={operand.disabled}
        onClick={() => setShowSource(true)}
      >
        使用区间表达式
      </Button>
    </FieldGroup>
  );
}
