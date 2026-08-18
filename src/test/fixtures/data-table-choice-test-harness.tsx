import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableEditChangeEvent, DataTableEditSnapshot } from '@/types/data-table';

export type ChoiceTestRow = {
  id: number;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
  ownerId: number | null;
  ownerIds: number[];
};

export const choiceTestColumnDsl = createDataTableColumnDsl<ChoiceTestRow>();
export const STATIC_CHOICE_TEST_COLUMNS = [
  choiceTestColumnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [
      { value: 'DRAFT', label: '草稿' },
      { value: 'READY', label: '就绪' }
    ],
    edit: { selectionMode: 'single', allowEmpty: false }
  }),
  choiceTestColumnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [
      { value: 1, label: '管理员' },
      { value: 2, label: '审计员' },
      { value: 3, label: '访客' }
    ],
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  })
];

const CHOICE_TEST_ROWS: ChoiceTestRow[] = [
  { id: 1, status: 'DRAFT', roleIds: [1], ownerId: 42, ownerIds: [42] },
  { id: 2, status: null, roleIds: [99], ownerId: 43, ownerIds: [43] }
];

export function createChoiceTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 }
    }
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

export function EditableChoiceTestTable({
  columns = STATIC_CHOICE_TEST_COLUMNS,
  onChange = () => undefined,
  onSnapshot
}: {
  columns?: typeof STATIC_CHOICE_TEST_COLUMNS;
  onChange?: (event: DataTableEditChangeEvent<ChoiceTestRow>) => void;
  onSnapshot?: (snapshot: DataTableEditSnapshot<ChoiceTestRow>) => void;
}) {
  const { table, editing } = useDataTable({
    tableId: 'editable-choice-test',
    columns,
    data: CHOICE_TEST_ROWS,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return (
    <>
      <button type='button' onClick={() => onSnapshot?.(editing.getSnapshot())}>
        读取草稿
      </button>
      <DataTable table={table} virtualization={false} />
    </>
  );
}

export function getChoiceTestCell(columnId: string, index = 0) {
  return document.querySelectorAll<HTMLTableCellElement>(`td[data-cell-column-id="${columnId}"]`)[
    index
  ]!;
}

export function installChoiceTestDomMocks() {
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
  Element.prototype.scrollIntoView ??= vi.fn();
}
