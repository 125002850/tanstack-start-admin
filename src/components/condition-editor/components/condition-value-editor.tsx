import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoutingReferenceSetSelector } from './routing-reference-set-selector';
import { routingOperatorUsesNoValue } from '../model/condition-model';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  MultiSelectCombobox,
  type MultiSelectComboboxOption
} from '@/components/ui/multi-select-combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import {
  getConditionFieldReferenceOptions,
  isDecimalConditionOperator,
  supportsConditionFieldReference,
  type ConditionField,
  type ConditionFieldType,
  type ConditionOperator,
  type PredicateCondition
} from '../model/condition-model';
import { CONDITION_LIMITS } from '../model/condition-limits';
import { ConditionSearchSelect } from './condition-search-select';
import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

const ConditionDateTimePicker = React.lazy(async () => {
  const module = await import('./condition-date-time-picker');
  return { default: module.ConditionDateTimePicker };
});

const DAY_OF_WEEK_OPTIONS: readonly MultiSelectComboboxOption<string>[] = [
  { value: 'MONDAY', label: '周一' },
  { value: 'TUESDAY', label: '周二' },
  { value: 'WEDNESDAY', label: '周三' },
  { value: 'THURSDAY', label: '周四' },
  { value: 'FRIDAY', label: '周五' },
  { value: 'SATURDAY', label: '周六' },
  { value: 'SUNDAY', label: '周日' }
];

type ConditionValueValidation = {
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
};

export function RoutingCanvasConditionValueEditor({
  condition,
  catalog,
  disabled,
  field,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly catalog: readonly ConditionField[];
  readonly disabled: boolean;
  readonly field: ConditionField | undefined;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  const description =
    field?.description === undefined ? null : (
      <FieldDescription
        className='min-w-0 flex-1 truncate nth-last-2:mt-0'
        title={field.description}
      >
        {field.description}
      </FieldDescription>
    );
  if (
    (condition.operator === 'IN' || condition.operator === 'NOT_IN') &&
    field?.type === 'STRING'
  ) {
    const mode = condition.setRef === undefined ? 'literal' : 'reference';
    const base = {
      clientId: condition.clientId,
      type: 'CONDITION' as const,
      field: condition.field,
      operator: condition.operator
    };
    return (
      <Tabs
        className='nodrag nopan'
        value={mode}
        onValueChange={(value) => {
          if (value === mode || disabled) return;
          onChange(value === 'reference' ? { ...base, setRef: '' } : { ...base, values: [] });
        }}
      >
        <Field className='gap-2' orientation='horizontal'>
          {description}
          <TabsList aria-label='集合来源' className='ml-auto shrink-0'>
            <TabsTrigger disabled={disabled} value='literal'>
              固定集合
            </TabsTrigger>
            <TabsTrigger disabled={disabled} value='reference'>
              引用集合
            </TabsTrigger>
          </TabsList>
        </Field>
        <TabsContent value='literal'>
          <RoutingCanvasLiteralValueEditor
            condition={condition}
            disabled={disabled}
            fieldType={field.type}
            onChange={onChange}
            validation={validation}
          />
        </TabsContent>
        <TabsContent value='reference'>
          {mode === 'reference' ? (
            <RoutingReferenceSetSelector
              value={condition.setRef ?? ''}
              nodeId={condition.clientId}
              disabled={disabled}
              onChange={(setRef) => onChange({ ...base, setRef })}
              validation={validation}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    );
  }
  if (supportsConditionFieldReference(condition.operator) && field !== undefined) {
    const referenceOptions = getConditionFieldReferenceOptions(catalog, field);
    const mode = condition.fieldRef === undefined ? 'literal' : 'field';
    const base = {
      clientId: condition.clientId,
      type: 'CONDITION' as const,
      field: condition.field,
      operator: condition.operator
    };
    return (
      <Tabs
        className='nodrag nopan'
        value={mode}
        onValueChange={(value) => {
          if (value === mode || disabled) return;
          if (value === 'literal') {
            onChange(field.type === 'BOOLEAN' ? { ...base, value: true } : { ...base, value: '' });
          }
          if (value === 'field' && referenceOptions[0] !== undefined) {
            onChange({ ...base, fieldRef: referenceOptions[0].path });
          }
        }}
      >
        <Field className='gap-2' orientation='horizontal'>
          {description}
          <TabsList aria-label='比较方式' className='ml-auto shrink-0'>
            <TabsTrigger aria-label='与固定值比较' disabled={disabled} value='literal'>
              固定值
            </TabsTrigger>
            <TabsTrigger
              aria-label='与字段比较'
              disabled={disabled || referenceOptions.length === 0}
              title={referenceOptions.length === 0 ? '没有类型兼容的可选字段' : undefined}
              value='field'
            >
              字段
            </TabsTrigger>
          </TabsList>
        </Field>
        <TabsContent value='field'>
          <RoutingCanvasFieldReferenceEditor
            condition={condition}
            disabled={disabled}
            onChange={onChange}
            options={referenceOptions}
            validation={validation}
          />
        </TabsContent>
        <TabsContent value='literal'>
          <RoutingCanvasLiteralValueEditor
            condition={condition}
            disabled={disabled}
            fieldType={field.type}
            onChange={onChange}
            validation={validation}
          />
        </TabsContent>
      </Tabs>
    );
  }
  return (
    <>
      {description}
      <RoutingCanvasLiteralValueEditor
        condition={condition}
        disabled={disabled}
        fieldType={field?.type}
        onChange={onChange}
        validation={validation}
      />
    </>
  );
}

function RoutingCanvasFieldReferenceEditor({
  condition,
  disabled,
  onChange,
  options,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly options: readonly ConditionField[];
  readonly validation?: ConditionValueValidation;
}) {
  const selectedOption = options.find((option) => option.path === condition.fieldRef);
  return (
    <Field className='gap-2'>
      <FieldLabel className='sr-only'>对比字段</FieldLabel>
      <ConditionSearchSelect
        aria-invalid={Boolean(validation?.['aria-invalid'])}
        aria-describedby={validation?.['aria-describedby']}
        disabled={disabled || options.length === 0}
        onValueChange={(fieldRef) => onChange({ ...condition, fieldRef })}
        options={options.map((option) => ({
          value: option.path,
          label: option.label,
          description: option.description
        }))}
        overlayId={`field-ref:${condition.clientId}`}
        placeholder='选择对比字段'
        searchPlaceholder='搜索字段名称、路径或说明'
        triggerLabel='对比字段'
        value={condition.fieldRef}
      />
      {selectedOption?.description === undefined ? null : (
        <FieldDescription className='truncate' title={selectedOption.description}>
          {selectedOption.description}
        </FieldDescription>
      )}
    </Field>
  );
}

function RoutingCanvasLiteralValueEditor({
  condition,
  disabled,
  fieldType,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly fieldType: ConditionFieldType | undefined;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  if (routingOperatorUsesNoValue(condition.operator)) return null;
  const isCollection =
    condition.operator === 'IN' ||
    condition.operator === 'NOT_IN' ||
    condition.operator === 'BETWEEN' ||
    condition.operator === 'NUM_IN' ||
    condition.operator === 'NUM_NOT_IN' ||
    condition.operator === 'NUM_BETWEEN' ||
    condition.operator === 'DAY_OF_WEEK_IN';
  if (isCollection) {
    return (
      <RoutingCanvasCollectionValueEditor
        condition={condition}
        disabled={disabled}
        fieldType={fieldType}
        onChange={onChange}
        validation={validation}
      />
    );
  }
  if (fieldType === 'DAY_OF_WEEK') {
    return (
      <RoutingCanvasDayOfWeekValueEditor
        condition={condition}
        disabled={disabled}
        onChange={onChange}
        validation={validation}
      />
    );
  }
  if (fieldType === 'BOOLEAN') {
    return (
      <RoutingCanvasBooleanValueEditor
        condition={condition}
        disabled={disabled}
        onChange={onChange}
        validation={validation}
      />
    );
  }
  if (fieldType === 'DATETIME') {
    return (
      <RoutingCanvasDateTimeValueEditor
        condition={condition}
        disabled={disabled}
        onChange={onChange}
        validation={validation}
      />
    );
  }
  return (
    <Field data-invalid={validation?.['aria-invalid']}>
      <FieldLabel className='sr-only' htmlFor={`routing-condition-value-${condition.clientId}`}>
        条件值
      </FieldLabel>
      <Input
        {...validation}
        className='nodrag nopan'
        disabled={disabled}
        id={`routing-condition-value-${condition.clientId}`}
        onChange={(event) => onChange({ ...condition, value: event.target.value }, 'value')}
        placeholder={literalPlaceholder(fieldType, condition.operator)}
        step={fieldType === 'TIME' ? 1 : undefined}
        type={fieldType === 'DATE' ? 'date' : fieldType === 'TIME' ? 'time' : 'text'}
        value={String(condition.value ?? '')}
      />
    </Field>
  );
}

function RoutingCanvasCollectionValueEditor({
  condition,
  disabled,
  fieldType,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly fieldType: ConditionFieldType | undefined;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  const values = condition.values ?? [];
  const between = condition.operator === 'BETWEEN' || condition.operator === 'NUM_BETWEEN';
  const summary = between ? '设置区间' : `${values.length} 个集合值`;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const previousValuesLength = React.useRef(values.length);

  React.useEffect(() => {
    if (values.length > previousValuesLength.current) {
      const container = scrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
    previousValuesLength.current = values.length;
  }, [values.length]);

  const overlay = useRoutingCanvasOverlayOpen(`collection:${condition.clientId}`);

  const isDayOfWeekMultiSelect =
    (fieldType === 'DAY_OF_WEEK' || condition.operator === 'DAY_OF_WEEK_IN') && !between;
  if (isDayOfWeekMultiSelect) {
    return (
      <Field>
        <FieldLabel className='sr-only'>条件值</FieldLabel>
        <MultiSelectCombobox
          {...validation}
          className='nodrag nopan w-full'
          disabled={disabled}
          emptyText='未找到匹配项'
          onOpenChange={overlay.onOpenChange}
          onValueChange={(nextValues) => onChange({ ...condition, values: nextValues })}
          open={overlay.open}
          options={DAY_OF_WEEK_OPTIONS}
          placeholder='选择星期'
          triggerLabel='条件值'
          value={values.map(String)}
        />
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel className='sr-only'>条件值</FieldLabel>
      <Popover onOpenChange={overlay.onOpenChange} open={overlay.open}>
        <PopoverTrigger asChild>
          <Button
            {...validation}
            className='nodrag nopan w-full justify-between'
            disabled={disabled}
            type='button'
            variant='outline'
          >
            {summary}
            <Icons.chevronDown className='size-4' data-icon='inline-end' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='start' className='nodrag nopan w-80'>
          <FieldGroup className='gap-3'>
            <div ref={scrollRef} className='max-h-72 overflow-y-auto pr-2'>
              <FieldGroup className='gap-3'>
                {values.map((value, index) => (
                  <Field key={index} orientation='horizontal'>
                    <FieldLabel
                      className='w-16 shrink-0'
                      htmlFor={`routing-collection-${condition.clientId}-${index}`}
                    >
                      {between ? (index === 0 ? '起点' : '终点') : `值 ${index + 1}`}
                    </FieldLabel>
                    {fieldType === 'DATETIME' ? (
                      <React.Suspense fallback={<Skeleton className='h-9 flex-1 rounded-md' />}>
                        <ConditionDateTimePicker
                          {...validation}
                          ariaLabel={
                            between ? (index === 0 ? '起点时间' : '终点时间') : `值 ${index + 1}`
                          }
                          disabled={disabled}
                          id={`routing-collection-${condition.clientId}-${index}`}
                          onChange={(nextValue) =>
                            onChange(
                              {
                                ...condition,
                                values: values.map((current, valueIndex) =>
                                  valueIndex === index ? nextValue : current
                                )
                              },
                              `values:${index}`
                            )
                          }
                          value={String(value)}
                        />
                      </React.Suspense>
                    ) : (
                      <Input
                        {...validation}
                        disabled={disabled}
                        id={`routing-collection-${condition.clientId}-${index}`}
                        onChange={(event) =>
                          onChange(
                            {
                              ...condition,
                              values: values.map((current, valueIndex) =>
                                valueIndex === index ? event.target.value : current
                              )
                            },
                            `values:${index}`
                          )
                        }
                        placeholder={literalPlaceholder(fieldType, condition.operator)}
                        step={fieldType === 'TIME' ? 1 : undefined}
                        type={
                          fieldType === 'DATE' ? 'date' : fieldType === 'TIME' ? 'time' : 'text'
                        }
                        value={String(value)}
                      />
                    )}
                    {between ? null : (
                      <Button
                        aria-label={`删除集合值 ${index + 1}`}
                        disabled={disabled || values.length <= 1}
                        onClick={() =>
                          onChange({
                            ...condition,
                            values: values.filter((_current, valueIndex) => valueIndex !== index)
                          })
                        }
                        size='icon'
                        type='button'
                        variant='ghost'
                      >
                        <Icons.trash className='size-4' />
                      </Button>
                    )}
                  </Field>
                ))}
              </FieldGroup>
            </div>
            {between ? null : (
              <Button
                disabled={disabled || values.length >= CONDITION_LIMITS.collectionValues}
                onClick={() => onChange({ ...condition, values: [...values, ''] })}
                size='sm'
                type='button'
                variant='outline'
              >
                <Icons.add className='size-4' data-icon='inline-start' />
                添加集合值（{values.length}/{CONDITION_LIMITS.collectionValues}）
              </Button>
            )}
          </FieldGroup>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function RoutingCanvasDayOfWeekValueEditor({
  condition,
  disabled,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  const overlay = useRoutingCanvasOverlayOpen(`value:${condition.clientId}`);
  return (
    <Field>
      <FieldLabel className='sr-only'>条件值</FieldLabel>
      <Select
        disabled={disabled}
        onOpenChange={overlay.onOpenChange}
        onValueChange={(value) => onChange({ ...condition, value })}
        open={overlay.open}
        value={String(condition.value ?? '')}
      >
        <SelectTrigger {...validation} aria-label='条件值' className='nodrag nopan w-full'>
          <SelectValue placeholder='选择星期' />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {DAY_OF_WEEK_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function RoutingCanvasBooleanValueEditor({
  condition,
  disabled,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  const overlay = useRoutingCanvasOverlayOpen(`value:${condition.clientId}`);
  return (
    <Field>
      <FieldLabel className='sr-only'>条件值</FieldLabel>
      <Select
        disabled={disabled}
        onOpenChange={overlay.onOpenChange}
        onValueChange={(value) => onChange({ ...condition, value: value === 'true' })}
        open={overlay.open}
        value={String(condition.value ?? true)}
      >
        <SelectTrigger {...validation} aria-label='条件值' className='nodrag nopan w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value='true'>true</SelectItem>
            <SelectItem value='false'>false</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function RoutingCanvasDateTimeValueEditor({
  condition,
  disabled,
  onChange,
  validation
}: {
  readonly condition: PredicateCondition;
  readonly disabled: boolean;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly validation?: ConditionValueValidation;
}) {
  const overlay = useRoutingCanvasOverlayOpen(`value:${condition.clientId}`);
  return (
    <Field>
      <FieldLabel className='sr-only' htmlFor={`routing-condition-value-${condition.clientId}`}>
        条件值
      </FieldLabel>
      <React.Suspense fallback={<Skeleton className='h-9 w-full rounded-md' />}>
        <ConditionDateTimePicker
          {...validation}
          ariaLabel='条件值'
          disabled={disabled}
          id={`routing-condition-value-${condition.clientId}`}
          onChange={(value) => onChange({ ...condition, value }, 'value')}
          onOpenChange={overlay.onOpenChange}
          open={overlay.open}
          value={String(condition.value ?? '')}
        />
      </React.Suspense>
    </Field>
  );
}

function literalPlaceholder(
  type: ConditionFieldType | undefined,
  operator: ConditionOperator
): string {
  if (isDecimalConditionOperator(operator)) return '输入十进制字符串，如 99.50';
  if (type === 'DATE') return '2026-07-31';
  if (type === 'DATETIME') return '2026-07-31 09:30:00';
  if (type === 'TIME') return '09:30:00';
  return '输入常量';
}
