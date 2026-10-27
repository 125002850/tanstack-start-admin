import '@/styles/globals.css';
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImagePreview } from '@/components/image-preview';
import ThemeProvider from '@/components/themes/theme-provider';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import { TextDiff } from '@/components/text-diff/text-diff';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MultipleChoiceCombobox } from '@/components/ui/choice-combobox';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTableContent } from '@/components/data-table/core/data-table-content';
import { useDataTable } from '@/hooks/use-data-table';
import { useFormErrorNavigation } from '@/hooks/use-form-error-navigation';
import { useWorkspaceDirtyGuard } from '@/features/workspace-tabs/hooks/use-workspace-dirty-guard';
import { WorkspaceDirtyGuardDialog } from '@/features/workspace-tabs/components/workspace-dirty-guard-dialog';

const choices = [
  { value: 'A', label: '候选 A' },
  { value: 'B', label: '候选 B' }
];
const picture = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="${fill}"/><circle cx="800" cy="500" r="180" fill="white"/></svg>`
  )}`;
const images = [
  { id: 'first', src: picture('#186b80'), width: 1600, height: 1000, title: '第一张图片' },
  { id: 'second', src: picture('#805518'), width: 1600, height: 1000, title: '第二张图片' }
];
type Row = { id: string } & Record<string, string>;
const dsl = createDataTableColumnDsl<Row>();
const columns = [
  dsl.field('id', '编号', { size: 120 }),
  ...Array.from({ length: 28 }, (_, i) => dsl.field(`c${i}`, `字段 ${i}`, { size: 120 }))
];
const rows: Row[] = Array.from({ length: 400 }, (_, i) => ({
  id: `R-${String(i).padStart(4, '0')}`,
  ...Object.fromEntries(Array.from({ length: 28 }, (_, j) => [`c${j}`, `${i}:${j}`]))
}));

function PreviewExample() {
  const [outer, setOuter] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  return (
    <>
      <Button onClick={() => setOuter(true)}>打开附件详情</Button>
      <Dialog open={outer} onOpenChange={setOuter}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>附件详情</DialogTitle>
          <Button onClick={() => setOpen(true)}>查看分组图片</Button>
          <ImagePreview
            open={open}
            onOpenChange={setOpen}
            images={images}
            index={index}
            onIndexChange={setIndex}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChoiceExample() {
  const [value, setValue] = useState<string[]>(['A']);
  return (
    <MultipleChoiceCombobox
      options={choices}
      value={value}
      onValueChange={setValue}
      triggerLabel='分类选择'
      placeholder='选择分类'
      header={<Button onClick={() => setValue(['A', 'B'])}>选择全部候选</Button>}
    />
  );
}

function ErrorNavigationExample() {
  const [section, setSection] = useState<'first' | 'second'>('first');
  const email = useRef<HTMLInputElement>(null);
  const navigation = useFormErrorNavigation({
    issues: [] as { path: string }[],
    fields: [{ path: 'email', section: 'second' as const }],
    onActivateSection: setSection,
    onFocus: () => email.current?.focus()
  });
  return (
    <div>
      <Button onClick={() => navigation.navigateToFirstError([{ path: 'email' }])}>
        定位首个错误
      </Button>
      {section === 'second' && (
        <Field>
          <FieldLabel htmlFor='error-email'>邮箱</FieldLabel>
          <Input id='error-email' ref={email} />
        </Field>
      )}
    </div>
  );
}

function DirtyExample() {
  const [value, setValue] = useState('');
  const guard = useWorkspaceDirtyGuard(value.length > 0);
  return (
    <div>
      <Field>
        <FieldLabel htmlFor='dirty-value'>未保存内容</FieldLabel>
        <Input id='dirty-value' value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
      <Button onClick={() => router.history.push('/done')}>离开示例页</Button>
      <WorkspaceDirtyGuardDialog
        confirmState={guard.confirmState}
        onCancel={guard.cancelDiscard}
        onConfirm={guard.confirmDiscard}
      />
    </div>
  );
}

function ExamplePage() {
  const { table } = useDataTable({
    tableId: 'shared-ui-virtual-content',
    data: rows,
    columns,
    rowId: 'id',
    paginationMode: 'client',
    pageSize: 2000,
    showRowNumberColumn: false,
    initialState: { columnPinning: { left: ['id'] } }
  });
  return (
    <main className='flex max-w-full flex-col gap-6 p-6'>
      <PreviewExample />
      <ChoiceExample />
      <ErrorNavigationExample />
      <DirtyExample />
      <TextDiff before={'{\n  "name": "old"\n}'} after={'{\n  "name": "new"\n}'} language='json' />
      <DataTableContent
        table={table}
        label='虚拟明细表'
        data-testid='virtual-detail'
        className='h-72 w-full max-w-3xl'
        virtualization={{ mode: 'on', columnVirtualizationMode: 'on' }}
      />
    </main>
  );
}

const rootRoute = createRootRoute({ component: Outlet });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ExamplePage
});
const doneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/done',
  component: () => <p>已离开示例页</p>
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, doneRoute]),
  history: createMemoryHistory({ initialEntries: ['/'] })
});
createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute='class' defaultTheme='light' enableSystem={false}>
    <ActiveThemeProvider initialTheme='supabase'>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ActiveThemeProvider>
  </ThemeProvider>
);
