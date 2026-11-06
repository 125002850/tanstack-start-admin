import { Suspense, useState } from 'react';
import { DurationInput } from '@/components/duration-input';
import { ConditionTreeEditor } from '@/components/condition-editor/components/condition-tree-editor';
import { ConditionCanvasEditor } from '@/components/condition-editor/components/condition-canvas-editor';
import { ConditionReferenceSetsProvider } from '@/components/condition-editor/components/condition-reference-sets';
import {
  EMPTY_CONDITION_HISTORY,
  recordConditionChange,
  redoConditionChange,
  undoConditionChange
} from '@/components/condition-editor/lib/condition-history';
import { validateConditionTree } from '@/components/condition-editor/lib/condition-validation';
import type {
  ConditionField,
  ConditionNode,
  GroupCondition
} from '@/components/condition-editor/model/condition-model';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
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
import type { RoutingCanvasRemovalConfirmation } from '@/components/condition-editor/components/condition-canvas-types';

const catalog: readonly ConditionField[] = [
  { path: 'amount', label: '金额', type: 'NUMBER', source: 'PAYLOAD', expression: '$json.amount' },
  { path: 'region', label: '地区', type: 'STRING', source: 'PAYLOAD', expression: '$json.region' }
];
const referenceSets = [{ code: 'REGION_CODES', label: '地区编码', fieldType: 'STRING' as const }];
const initialCondition: GroupCondition = {
  clientId: 'example-root',
  type: 'GROUP',
  logic: 'AND',
  children: [
    {
      clientId: 'example-amount',
      type: 'CONDITION',
      field: 'amount',
      operator: 'NUM_GT',
      value: '100'
    }
  ]
};
const units = { minute: { label: '分钟' }, hour: { label: '小时' }, day: { label: '天' } };

function DurationExample() {
  const [value, setValue] = useState<{ value: string; unit: keyof typeof units }>({
    value: '',
    unit: 'minute'
  });
  return (
    <Field className='max-w-sm'>
      <FieldLabel htmlFor='example-duration'>超时时长</FieldLabel>
      <DurationInput
        id='example-duration'
        label='超时时长'
        value={value}
        units={units}
        onChange={setValue}
        onBlur={() => {}}
      />
      <output aria-label='时长结果'>{JSON.stringify(value)}</output>
    </Field>
  );
}

function ConditionsExample({ view }: { view: 'tree' | 'canvas' }) {
  const [disabled, setDisabled] = useState(false);
  const [state, setState] = useState({
    condition: initialCondition as ConditionNode,
    history: EMPTY_CONDITION_HISTORY
  });
  const [confirmation, setConfirmation] = useState<RoutingCanvasRemovalConfirmation | null>(null);
  if (state.condition.type === 'ALWAYS') throw new Error('示例使用可编辑条件');
  const condition = state.condition;
  const issues = validateConditionTree(condition, catalog);
  const change = (next: ConditionNode, coalesceKey?: string) =>
    setState((current) => ({
      condition: next,
      history: recordConditionChange(current.history, current.condition, coalesceKey, Date.now())
    }));
  const undo = () =>
    setState((current) => undoConditionChange(current.history, current.condition) ?? current);
  const redo = () =>
    setState((current) => redoConditionChange(current.history, current.condition) ?? current);
  return (
    <section
      aria-label={view === 'tree' ? '条件树编辑示例' : '条件画布编辑示例'}
      className='space-y-4'
    >
      <div className='flex flex-wrap gap-2'>
        <Button onClick={() => setDisabled(!disabled)}>
          {disabled ? '启用条件编辑' : '切换只读'}
        </Button>
        <Button disabled={disabled || state.history.past.length === 0} onClick={undo}>
          撤销条件修改
        </Button>
        <Button disabled={disabled || state.history.future.length === 0} onClick={redo}>
          重做条件修改
        </Button>
      </div>
      <ConditionReferenceSetsProvider items={referenceSets}>
        <Suspense fallback={<p role='status'>正在加载条件画布</p>}>
          {view === 'tree' ? (
            <ConditionTreeEditor
              condition={condition}
              catalog={catalog}
              disabled={disabled}
              issues={issues}
              onChange={change}
            />
          ) : (
            <ConditionCanvasEditor
              ruleName='示例条件'
              condition={condition}
              catalog={catalog}
              disabled={disabled}
              issues={issues}
              issuePathPrefix='condition'
              onChange={change}
              canUndo={state.history.past.length > 0}
              canRedo={state.history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onRequestRemoval={setConfirmation}
            />
          )}
        </Suspense>
      </ConditionReferenceSetsProvider>
      <output aria-label='条件结果' className='block overflow-auto'>
        {JSON.stringify(condition)}
      </output>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmation?.onConfirm()}>
              {confirmation?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type Row = { id: string; value: string };
const tableRows: Row[] = Array.from({ length: 200 }, (_, index) => ({
  id: `F-${index}`,
  value: `记录 ${index}`
}));
const dsl = createDataTableColumnDsl<Row>();
const tableColumns = [
  dsl.field('id', '编号', { size: 120 }),
  dsl.field('value', '内容', { size: 1200 })
];

function ScrollbarExample() {
  const [selected, setSelected] = useState('');
  const { table } = useDataTable({
    tableId: 'foundation-scrollbars',
    data: tableRows,
    columns: tableColumns,
    rowId: 'id',
    paginationMode: 'client',
    pageSize: 200,
    showRowNumberColumn: false,
    rowActions: [{ label: '查看记录', onClick: (row) => setSelected(row.id) }]
  });
  return (
    <section aria-label='滚动条示例' className='max-w-4xl' data-testid='foundation-scrollbars'>
      <Card className='h-96'>
        <CardContent className='min-h-0 flex-1 px-0'>
          <DataTable table={table} />
        </CardContent>
      </Card>
      <output aria-label='记录操作结果'>{selected}</output>
    </section>
  );
}

export function SharedFoundationExamples() {
  return (
    <>
      <DurationExample />
      <ConditionsExample view='tree' />
      <ConditionsExample view='canvas' />
      <ScrollbarExample />
      <section
        data-slot='sidebar-inset'
        data-testid='workspace-error-frame'
        className='flex h-[800px] flex-col'
      >
        <header className='h-16 shrink-0'>后台顶部栏</header>
        <div className='flex min-h-0 flex-1'>
          <DefaultErrorPage
            code='500'
            title='示例错误'
            description='工作区错误页高度回归'
            alertTitle='运行异常'
            alertDescription='请重试当前操作。'
          />
        </div>
      </section>
    </>
  );
}
