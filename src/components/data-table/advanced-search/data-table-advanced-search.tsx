import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import {
  DEFAULT_ADVANCED_SEARCH_LIMITS,
  DATA_TABLE_OPERATOR_LABELS,
  createAdvancedCondition,
  normalizeAdvancedCondition
} from '@/lib/data-table/advanced-search';
import type {
  DataTableAdvancedSearchField,
  DataTableAdvancedSearchRuntime
} from '@/components/data-table/advanced-search/types';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DataTableFilterTrigger } from '@/components/data-table/filters/data-table-filter-trigger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MultipleChoiceCombobox } from '@/components/ui/choice-combobox';
import { Input } from '@/components/ui/input';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { z } from 'zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { DataTableDslCondition } from '@/hooks/use-data-table';
import { cn } from '@/lib/utils';
import type { DataTableDslOperator } from '@/components/data-table/filters/types';

const NO_SCHEME_VALUE = '__none__';

function countNodes(condition: DataTableDslCondition): number {
  return condition.nodeType === 'compose'
    ? 1 + condition.children.reduce((total, child) => total + countNodes(child), 0)
    : 1;
}

function isDraftComplete(
  condition: DataTableDslCondition,
  fields: DataTableAdvancedSearchField[],
  root = true,
  limits = DEFAULT_ADVANCED_SEARCH_LIMITS
): boolean {
  if (condition.nodeType !== 'compose') {
    return Boolean(normalizeAdvancedCondition(condition, fields, 1, limits));
  }
  if (!root && condition.children.length === 0) return false;
  return condition.children.every((child) => isDraftComplete(child, fields, false, limits));
}

function cloneCondition<T>(condition: T): T {
  return structuredClone(condition);
}

function toDraftRoot(condition?: DataTableDslCondition): DataTableDslCondition {
  if (!condition) return { nodeType: 'compose', logic: 'AND', children: [] };
  return condition.nodeType === 'compose'
    ? cloneCondition(condition)
    : { nodeType: 'compose', logic: 'AND', children: [cloneCondition(condition)] };
}

interface QuerySchemeDialogProps {
  open: boolean;
  title: string;
  initialName?: string;
  allowDefault?: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, defaultScheme: boolean) => Promise<void>;
}

function QuerySchemeDialog({
  open,
  title,
  initialName = '',
  allowDefault = false,
  pending,
  onOpenChange,
  onSubmit
}: QuerySchemeDialogProps) {
  const formId = React.useId();
  const form = useAppForm({
    defaultValues: { name: initialName, defaultScheme: false },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, '请输入方案名称').max(64, '名称不能超过 64 个字符'),
        defaultScheme: z.boolean()
      })
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value.name.trim(), value.defaultScheme);
      onOpenChange(false);
    }
  });
  const { FormTextField, FormCheckboxField } = useFormFields<{
    name: string;
    defaultScheme: boolean;
  }>();
  React.useEffect(() => {
    if (open) form.reset({ name: initialName, defaultScheme: false });
  }, [open, initialName, form]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending && !form.state.isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent onAfterClose={() => form.reset()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            方案只保存当前快捷条件和高级条件，不保存分页、排序或列布局。
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form id={formId} className='flex flex-col gap-4 px-0'>
            <FormTextField
              name='name'
              label='方案名称'
              required
              placeholder='例如：本月待处理'
              maxLength={64}
            />
            {allowDefault && (
              <FormCheckboxField name='defaultScheme' label='设为进入页面时自动应用的默认方案' />
            )}
          </form.Form>
          <DialogFooter>
            <form.SubmitButton form={formId} disabled={pending}>
              保存
            </form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}

function findField(
  condition: Exclude<DataTableDslCondition, { nodeType: 'compose' }>,
  fields: DataTableAdvancedSearchField[]
) {
  return fields.find(
    (field) => field.field === condition.field && field.conditionType === condition.nodeType
  );
}

function updateLeafOperator(
  condition: Exclude<DataTableDslCondition, { nodeType: 'compose' }>,
  op: DataTableDslOperator
): DataTableDslCondition {
  const base = { nodeType: condition.nodeType, field: condition.field, op };
  if (op === 'IS_NULL' || op === 'IS_NOT_NULL') return base as DataTableDslCondition;
  if (op === 'BETWEEN')
    return { ...base, start: undefined, end: undefined } as DataTableDslCondition;
  if (op === 'IN' || op === 'NOT_IN') return { ...base, values: [] } as DataTableDslCondition;
  if (condition.nodeType === 'boolean') return { ...base, value: true } as DataTableDslCondition;
  return { ...base, value: undefined } as DataTableDslCondition;
}

function ConditionValueEditor({
  condition,
  field,
  limits,
  onChange
}: {
  condition: Exclude<DataTableDslCondition, { nodeType: 'compose' }>;
  field: DataTableAdvancedSearchField;
  limits: typeof DEFAULT_ADVANCED_SEARCH_LIMITS;
  onChange: (condition: DataTableDslCondition) => void;
}) {
  if (condition.op === 'IS_NULL' || condition.op === 'IS_NOT_NULL') {
    return <span className='text-muted-foreground px-2 text-sm'>无需输入值</span>;
  }

  if (condition.op === 'BETWEEN') {
    const dateInputType = field.dateMode === 'date' ? 'date' : 'datetime-local';
    const inputType = condition.nodeType === 'number' ? 'number' : dateInputType;
    const start = 'start' in condition ? condition.start : undefined;
    const end = 'end' in condition ? condition.end : undefined;
    return (
      <div className='grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2'>
        <Input
          className='h-8'
          type={inputType}
          value={String(start ?? '').replace(' ', 'T')}
          onChange={(event) =>
            onChange({
              ...condition,
              start:
                condition.nodeType === 'number' ? event.target.valueAsNumber : event.target.value
            } as DataTableDslCondition)
          }
        />
        <span className='text-muted-foreground text-sm'>至</span>
        <Input
          className='h-8'
          type={inputType}
          value={String(end ?? '').replace(' ', 'T')}
          onChange={(event) =>
            onChange({
              ...condition,
              end: condition.nodeType === 'number' ? event.target.valueAsNumber : event.target.value
            } as DataTableDslCondition)
          }
        />
      </div>
    );
  }

  if (condition.nodeType === 'boolean') {
    return (
      <Select
        value={String(condition.value ?? true)}
        onValueChange={(value) => onChange({ ...condition, value: value === 'true' })}
      >
        <SelectTrigger aria-label='条件值' size='sm' className='min-w-32'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value='true'>是</SelectItem>
            <SelectItem value='false'>否</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  if (condition.op === 'IN' || condition.op === 'NOT_IN') {
    if (
      (condition.nodeType === 'enum' || condition.nodeType === 'text') &&
      field.options.length > 0
    ) {
      return (
        <MultipleChoiceCombobox
          options={field.options}
          value={(condition.values ?? []).map(String)}
          maxSelected={limits.maxInSize}
          triggerLabel={`${field.label}多选值`}
          placeholder={`选择${field.label}`}
          searchPlaceholder={`搜索${field.label}`}
          className='h-8 min-w-52 flex-1'
          contentClassName='min-w-52'
          onValueChange={(values) =>
            onChange({
              ...condition,
              values
            })
          }
        />
      );
    }
    return (
      <Input
        className='h-8 min-w-52 flex-1'
        value={(condition.values ?? []).join(';')}
        placeholder={`多个值用英文分号分隔，最多 ${limits.maxInSize} 个`}
        onChange={(event) =>
          onChange({
            ...condition,
            values: event.target.value
              .split(';')
              .map((value) => value.trim())
              .filter(Boolean)
          })
        }
      />
    );
  }

  if (
    (condition.nodeType === 'enum' || condition.nodeType === 'text') &&
    field.options.length > 0 &&
    (condition.op === 'EQ' || condition.op === 'NE')
  ) {
    return (
      <Select
        value={String(condition.value ?? '')}
        onValueChange={(value) => onChange({ ...condition, value })}
      >
        <SelectTrigger size='sm' className='min-w-44'>
          <SelectValue placeholder={`选择${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  let inputType = 'text';
  if (condition.nodeType === 'number') inputType = 'number';
  if (condition.nodeType === 'dateTime')
    inputType = field.dateMode === 'date' ? 'date' : 'datetime-local';
  return (
    <Input
      type={inputType}
      className='h-8 min-w-44 flex-1'
      value={
        condition.nodeType === 'dateTime'
          ? String(condition.value ?? '').replace(' ', 'T')
          : String(condition.value ?? '')
      }
      onChange={(event) =>
        onChange({
          ...condition,
          value: condition.nodeType === 'number' ? event.target.valueAsNumber : event.target.value
        } as DataTableDslCondition)
      }
    />
  );
}

function ConditionNodeEditor({
  condition,
  fields,
  depth,
  limits,
  onChange,
  onRemove
}: {
  condition: DataTableDslCondition;
  fields: DataTableAdvancedSearchField[];
  depth: number;
  limits: typeof DEFAULT_ADVANCED_SEARCH_LIMITS;
  onChange: (condition: DataTableDslCondition) => void;
  onRemove: () => void;
}) {
  if (condition.nodeType === 'compose') {
    const root = depth === 1;
    return (
      <div
        className={cn(
          'flex flex-col gap-2',
          !root && 'border-border bg-muted/20 rounded-md border p-2'
        )}
      >
        <div className='flex items-center gap-2'>
          <span className='shrink-0 text-sm font-medium'>{root ? '匹配' : '条件组'}</span>
          <Select
            value={condition.logic}
            onValueChange={(logic) => onChange({ ...condition, logic: logic as 'AND' | 'OR' })}
          >
            <SelectTrigger size='sm' className='w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='AND'>同时满足</SelectItem>
                <SelectItem value='OR'>任一满足</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className='ml-auto flex items-center gap-1'>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={fields.length === 0 || countNodes(condition) >= limits.maxNodes}
              onClick={() =>
                onChange({
                  ...condition,
                  children: [...condition.children, createAdvancedCondition(fields[0]!)]
                })
              }
            >
              <Icons.add className='size-4' />
              条件
            </Button>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={depth >= limits.maxDepth || countNodes(condition) >= limits.maxNodes}
              onClick={() =>
                onChange({
                  ...condition,
                  children: [
                    ...condition.children,
                    { nodeType: 'compose', logic: 'AND', children: [] }
                  ]
                })
              }
            >
              <Icons.plusCircle className='size-4' />
              分组
            </Button>
            {!root && (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='size-8'
                onClick={onRemove}
              >
                <Icons.trash className='size-4' />
                <span className='sr-only'>删除条件组</span>
              </Button>
            )}
          </div>
        </div>
        <div className={cn('flex flex-col gap-2', !root && 'border-l pl-2')}>
          {condition.children.map((child, index) => (
            <ConditionNodeEditor
              key={`${index}-${child.nodeType}-${child.nodeType === 'compose' ? child.logic : child.field}`}
              condition={child}
              fields={fields}
              depth={depth + 1}
              limits={limits}
              onChange={(next) =>
                onChange({
                  ...condition,
                  children: condition.children.map((item, childIndex) =>
                    childIndex === index ? next : item
                  )
                })
              }
              onRemove={() =>
                onChange({
                  ...condition,
                  children: condition.children.filter((_, childIndex) => childIndex !== index)
                })
              }
            />
          ))}
          {condition.children.length === 0 && (
            <p className='text-muted-foreground py-1 text-sm'>点击“条件”开始组合筛选。</p>
          )}
        </div>
      </div>
    );
  }

  const field = findField(condition, fields) ?? fields[0];
  if (!field) return null;
  return (
    <div className='bg-background flex flex-wrap items-center gap-2 rounded-md border p-1.5'>
      <Select
        value={field.columnId}
        onValueChange={(columnId) => {
          const nextField = fields.find((candidate) => candidate.columnId === columnId);
          if (nextField) onChange(createAdvancedCondition(nextField));
        }}
      >
        <SelectTrigger aria-label='查询字段' size='sm' className='min-w-40'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {fields.map((item) => (
              <SelectItem key={item.columnId} value={item.columnId}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={condition.op}
        onValueChange={(op) => onChange(updateLeafOperator(condition, op as DataTableDslOperator))}
      >
        <SelectTrigger aria-label='比较方式' size='sm' className='min-w-32'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.operators.map((operator) => (
              <SelectItem key={operator} value={operator}>
                {DATA_TABLE_OPERATOR_LABELS[operator]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <ConditionValueEditor
        condition={condition}
        field={field}
        limits={limits}
        onChange={onChange}
      />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        className='ml-auto size-8'
        onClick={onRemove}
      >
        <Icons.trash className='size-4' />
        <span className='sr-only'>删除条件</span>
      </Button>
    </div>
  );
}

interface AdvancedSearchPopoverProps {
  runtime: DataTableAdvancedSearchRuntime;
  onSaveAs: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function AdvancedSearchPopover({
  runtime,
  onSaveAs,
  onRename,
  onDelete
}: AdvancedSearchPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DataTableDslCondition>(() =>
    toDraftRoot(runtime.condition)
  );
  const limits = runtime.limits ?? DEFAULT_ADVANCED_SEARCH_LIMITS;
  const selected = runtime.schemes.find((scheme) => scheme.id === runtime.selectedSchemeId);

  React.useEffect(() => {
    if (open) setDraft(toDraftRoot(runtime.condition));
  }, [open, runtime.condition]);

  const apply = () => {
    if (countNodes(draft) > limits.maxNodes) {
      toast.error(`高级搜索最多允许 ${limits.maxNodes} 个节点`);
      return;
    }
    if (!isDraftComplete(draft, runtime.fields, true, limits)) {
      toast.error('请补全所有高级搜索条件值，空条件不会被自动忽略');
      return;
    }
    const normalized = normalizeAdvancedCondition(draft, runtime.fields, 1, limits);
    if (draft.nodeType === 'compose' && draft.children.length > 0 && !normalized) {
      toast.error('请补全高级搜索条件值');
      return;
    }
    if (runtime.applyCondition(normalized) !== false) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <DataTableFilterTrigger
          title='高级搜索'
          aria-label={`高级搜索${runtime.conditionCount > 0 ? ` ${runtime.conditionCount}` : ''}`}
          state={
            runtime.conditionCount > 0
              ? {
                  status: 'active',
                  selection: { kind: 'value', content: runtime.conditionCount }
                }
              : { status: 'idle', icon: <Icons.filter className='size-4' /> }
          }
        />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='bottom'
        sideOffset={6}
        collisionPadding={16}
        aria-label='高级搜索条件'
        data-testid='data-table-advanced-search-popover'
        className='w-[min(48rem,calc(100vw-2rem))] p-0'
      >
        <div className='flex max-h-[min(32rem,var(--radix-popover-content-available-height))] flex-col'>
          <div className='flex shrink-0 flex-wrap items-center gap-2 px-3 py-2'>
            <span className='shrink-0 text-sm font-medium'>查询方案</span>
            <Select
              value={runtime.selectedSchemeId ? String(runtime.selectedSchemeId) : NO_SCHEME_VALUE}
              onValueChange={(value) =>
                runtime.applyScheme(value === NO_SCHEME_VALUE ? undefined : Number(value))
              }
              disabled={runtime.loadingSchemes || runtime.mutatingScheme}
            >
              <SelectTrigger size='sm' className='min-w-52 flex-1 sm:max-w-72'>
                <SelectValue placeholder='选择已保存方案' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_SCHEME_VALUE}>临时筛选（未保存）</SelectItem>
                  {runtime.schemes.map((scheme) => (
                    <SelectItem key={scheme.id} value={String(scheme.id)}>
                      {scheme.defaultScheme ? '★ ' : ''}
                      {scheme.schemeName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {runtime.dirty && <Badge variant='outline'>有修改</Badge>}
            {selected && runtime.dirty && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={runtime.mutatingScheme}
                onClick={() => void runtime.overwriteSelected().catch(() => undefined)}
              >
                <Icons.save className='size-4' />
                保存修改
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={runtime.mutatingScheme}
              onClick={onSaveAs}
            >
              <Icons.save className='size-4' />
              另存方案
            </Button>
            {selected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type='button' variant='ghost' size='icon' className='size-8'>
                    <Icons.ellipsis className='size-4' />
                    <span className='sr-only'>管理当前查询方案</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={onRename}>
                      <Icons.edit />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void runtime
                          .setSelectedAsDefault(!selected.defaultScheme)
                          .catch(() => undefined)
                      }
                    >
                      <Icons.check />
                      {selected.defaultScheme ? '取消默认' : '设为默认'}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant='destructive' onSelect={onDelete}>
                      <Icons.trash />
                      删除方案
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Separator />
          <div className='flex shrink-0 items-center justify-between gap-3 px-3 py-2'>
            <span className='text-sm font-medium'>筛选条件</span>
            <span className='text-muted-foreground text-xs'>
              支持全部/任一组合，最多 {limits.maxNodes} 个节点
            </span>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto px-3 pb-3'>
            <ConditionNodeEditor
              condition={draft}
              fields={runtime.fields}
              depth={1}
              limits={limits}
              onChange={setDraft}
              onRemove={() => undefined}
            />
          </div>
          <Separator />
          <div className='flex shrink-0 items-center justify-between gap-2 px-3 py-2'>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              onClick={() => setDraft({ nodeType: 'compose', logic: 'AND', children: [] })}
            >
              清空条件
            </Button>
            <div className='flex items-center gap-2'>
              <Button type='button' size='sm' variant='outline' onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type='button' size='sm' onClick={apply}>
                应用
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DataTableAdvancedSearch<TData>({ table }: { table: Table<TData> }) {
  const runtime = table.options.meta?.dataTableAdvancedSearch;
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  if (!runtime || runtime.fields.length === 0) return null;

  const selected = runtime.schemes.find((scheme) => scheme.id === runtime.selectedSchemeId);
  return (
    <>
      <AdvancedSearchPopover
        runtime={runtime}
        onSaveAs={() => setSaveOpen(true)}
        onRename={() => setRenameOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <QuerySchemeDialog
        open={saveOpen}
        title='另存为查询方案'
        allowDefault
        pending={runtime.mutatingScheme}
        onOpenChange={setSaveOpen}
        onSubmit={runtime.saveAs}
      />
      <QuerySchemeDialog
        open={renameOpen}
        title='重命名查询方案'
        initialName={selected?.schemeName}
        pending={runtime.mutatingScheme}
        onOpenChange={setRenameOpen}
        onSubmit={(name) => runtime.renameSelected(name)}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除查询方案“{selected?.schemeName ?? ''}”？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，当前已应用的筛选条件会保留为未保存状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={runtime.mutatingScheme}
              onClick={() => void runtime.deleteSelected().catch(() => undefined)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
