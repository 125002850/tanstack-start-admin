import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useDataTable } from '@/hooks/use-data-table';

type PermissionTreeNode = {
  id: string;
  label: string;
  code: string;
  kind: string;
  scope: string;
  appliesTo: string;
  children?: PermissionTreeNode[];
};

const resourceNames = ['客户数据', '订单数据', '合同数据'];
const permissionTree: PermissionTreeNode[] = Array.from({ length: 30 }, (_, index) => {
  const ordinal = String(index + 1).padStart(2, '0');
  const id = `resource-${ordinal}`;
  return {
    id,
    label: resourceNames[index] ?? `业务资源 ${ordinal}`,
    code: `business_resource_${ordinal}`,
    kind: '资源',
    scope: '按授权规则合并',
    appliesTo: '当前角色',
    children: [
      {
        id: `${id}-base`,
        label: '基础授权',
        code: 'SELF',
        kind: '授权规则',
        scope: '本人',
        appliesTo: '全部任职员工'
      },
      {
        id: `${id}-extra`,
        label: '追加授权',
        code: 'ALL',
        kind: '授权规则',
        scope: '全部数据',
        appliesTo: '指定 2 位员工',
        children: ['张三', '李四'].map((label, employeeIndex) => ({
          id: `${id}-employee-${employeeIndex + 1}`,
          label,
          code: `EMP00${employeeIndex + 1}`,
          kind: '适用员工',
          scope: '全部数据',
          appliesTo: '有效任职期间'
        }))
      }
    ]
  };
});

const columnDsl = createDataTableColumnDsl<PermissionTreeNode>({
  tableId: 'data-table-tree-example'
});
const columns = [
  columnDsl.field('label', '资源 / 授权 / 员工', { size: 'xxl' }),
  columnDsl.field('code', '编码', { size: 'xl' }),
  columnDsl.field('kind', '节点类型', { size: 'sm' }),
  columnDsl.field('scope', '数据范围', { size: 'lg' }),
  columnDsl.field('appliesTo', '适用对象', { size: 'lg' })
];

export function DataTableTreeExamplePage() {
  const { table, selectedRows, clearSelectedRows } = useDataTable({
    tableId: 'data-table-tree-example',
    data: permissionTree,
    columns,
    rowId: 'id',
    getSubRows: (row) => row.children,
    tree: { columnId: 'label' },
    showSelectColumn: true
  });

  return (
    <Card className='flex min-h-0 flex-1 flex-col' data-testid='data-table-tree-example'>
      <CardHeader>
        <CardTitle>树形表格示例</CardTitle>
        <CardDescription>
          30 个资源、授权规则和员工共用一组列。点击箭头逐层展开；勾选只作用于当前节点。
        </CardDescription>
        <CardAction>
          <Badge variant='secondary' data-testid='tree-selected-count'>
            已选 {selectedRows.length} 个节点
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col'>
        <DataTable table={table} showPagination={false} virtualization={{ mode: 'on' }}>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' onClick={() => table.toggleAllRowsExpanded(true)}>
              全部展开
            </Button>
            <Button variant='outline' onClick={() => table.toggleAllRowsExpanded(false)}>
              全部收起
            </Button>
            <Button
              variant='outline'
              disabled={selectedRows.length === 0}
              onClick={clearSelectedRows}
            >
              清空选择
            </Button>
          </div>
        </DataTable>
      </CardContent>
    </Card>
  );
}
