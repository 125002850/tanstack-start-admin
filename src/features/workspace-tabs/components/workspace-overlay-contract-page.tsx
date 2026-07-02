import * as React from 'react';
import type { Column } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';

type ContractOption = {
  id: string;
  label: string;
};

const accountOptions: ContractOption[] = [
  { id: 'account-alpha', label: 'Alpha Account' },
  { id: 'account-beta', label: 'Beta Account' },
  { id: 'account-gamma', label: 'Gamma Account' }
];

const filterOptions = [
  { label: '处理中', value: 'PROCESSING' },
  { label: '已完成', value: 'FINISHED' }
];

function WorkspaceOverlayFacetedFilter() {
  const [filterValue, setFilterValue] = React.useState<unknown>();
  const column = React.useMemo(
    () =>
      ({
        getFilterValue: () => filterValue,
        setFilterValue
      }) as Column<unknown, unknown>,
    [filterValue]
  );

  return <DataTableFacetedFilter column={column} title='任务状态' options={filterOptions} />;
}

function WorkspaceOverlaySearchCombobox({ triggerLabel }: { triggerLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [value, setValue] = React.useState<ContractOption | null>(null);
  const filteredOptions = React.useMemo(() => {
    const keyword = inputValue.trim().toLowerCase();
    if (!keyword) return accountOptions;
    return accountOptions.filter((item) => item.label.toLowerCase().includes(keyword));
  }, [inputValue]);

  return (
    <SearchCombobox
      items={filteredOptions}
      value={value}
      open={open}
      inputValue={inputValue}
      triggerLabel={triggerLabel}
      placeholder='请选择账户'
      searchPlaceholder='搜索账户'
      emptyText='无匹配账户'
      onOpenChange={setOpen}
      onInputValueChange={setInputValue}
      onValueChange={setValue}
      itemToStringLabel={(item) => item?.label ?? ''}
      itemToStringValue={(item) => item?.id ?? ''}
      isItemEqualToValue={(item, currentValue) => item?.id === currentValue?.id}
      getItemKey={(item) => item.id}
      getItemAriaLabel={(item) => item.label}
      renderItem={(item) => item.label}
    />
  );
}

function OverlayCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-wrap items-center gap-3'>{children}</CardContent>
    </Card>
  );
}

export function WorkspaceOverlayContractPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [nestedSheetOpen, setNestedSheetOpen] = React.useState(false);

  return (
    <div data-testid='workspace-overlay-contract-page' className='grid gap-4 lg:grid-cols-2'>
      <OverlayCard title='DataTable Filter'>
        <WorkspaceOverlayFacetedFilter />
      </OverlayCard>

      <OverlayCard title='Select'>
        <Select>
          <SelectTrigger aria-label='契约 Select' data-testid='contract-select-trigger'>
            <SelectValue placeholder='请选择状态' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='pending'>待处理</SelectItem>
              <SelectItem value='done'>已完成</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </OverlayCard>

      <OverlayCard title='Dropdown'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' data-testid='contract-dropdown-trigger'>
              操作菜单
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem>查看详情</DropdownMenuItem>
              <DropdownMenuItem>重新分配</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </OverlayCard>

      <OverlayCard title='SearchCombobox'>
        <WorkspaceOverlaySearchCombobox triggerLabel='契约账户' />
      </OverlayCard>

      <OverlayCard title='Dialog'>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button
            type='button'
            variant='outline'
            data-testid='contract-dialog-trigger'
            onClick={() => setDialogOpen(true)}
          >
            打开弹窗
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>契约弹窗</DialogTitle>
              <DialogDescription>Workspace 浮层关闭契约测试弹窗。</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </OverlayCard>

      <OverlayCard title='Sheet'>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <Button
            type='button'
            variant='outline'
            data-testid='contract-sheet-trigger'
            onClick={() => setSheetOpen(true)}
          >
            打开抽屉
          </Button>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>契约抽屉</SheetTitle>
              <SheetDescription>Workspace 浮层关闭契约测试抽屉。</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </OverlayCard>

      <OverlayCard title='Nested Sheet'>
        <Sheet
          open={nestedSheetOpen}
          onOpenChange={(nextOpen) => {
            setNestedSheetOpen(nextOpen);
          }}
        >
          <Button
            type='button'
            variant='outline'
            data-testid='contract-nested-sheet-trigger'
            onClick={() => setNestedSheetOpen(true)}
          >
            打开嵌套抽屉
          </Button>
          <SheetContent autoFocusFirstField>
            <SheetHeader>
              <SheetTitle>嵌套选择抽屉</SheetTitle>
              <SheetDescription>抽屉内包含一个 SearchCombobox。</SheetDescription>
            </SheetHeader>
            <WorkspaceOverlaySearchCombobox triggerLabel='抽屉内账户' />
          </SheetContent>
        </Sheet>
      </OverlayCard>
    </div>
  );
}
