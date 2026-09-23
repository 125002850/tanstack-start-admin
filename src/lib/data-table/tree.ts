import type { ColumnDef, ExpandedState, Row, TableOptions } from '@tanstack/react-table';

/** 树列保持可见；所有 accessor 使用原始兄弟索引，避免筛选投影改变业务值。 */
export function resolveTreeColumns<TData>(
  columns: ColumnDef<TData>[],
  columnId: string,
  originalIndexes: ReadonlyMap<TData, number>
) {
  let matches = 0;
  const visit = (column: ColumnDef<TData>): ColumnDef<TData> => {
    if ('columns' in column && column.columns) {
      return { ...column, columns: column.columns.map(visit) };
    }
    if ('accessorFn' in column && column.accessorFn) {
      const accessorFn = column.accessorFn;
      column = {
        ...column,
        accessorFn: (row, index) => accessorFn(row, originalIndexes.get(row) ?? index)
      };
    }
    const id =
      column.id ??
      ('accessorKey' in column ? String(column.accessorKey).replaceAll('.', '_') : undefined);
    if (id !== columnId) return column;
    matches += 1;
    return { ...column, enableHiding: false };
  };
  const result = columns.map(visit);
  if (matches !== 1 || ['select', 'actions', '__rowNumber'].includes(columnId)) {
    throw new Error('[DataTable tree] columnId must identify one business leaf column.');
  }
  return result;
}

/**
 * 快照化 children getter；校验循环/重复挂载，避免递归行模型栈溢出。
 * 不复制、改写业务记录，也不假设 children 的字段名称。
 */
export function prepareTreeData<TData>(
  data: TData[],
  getSubRows: TableOptions<TData>['getSubRows']
) {
  if (!getSubRows) throw new Error('[DataTable tree] getSubRows is required.');
  const children = new Map<TData, TData[] | undefined>();
  const originalIndexes = new Map<TData, number>();
  const stack = data.map((row, index) => ({ row, index })).toReversed();
  while (stack.length) {
    const { row, index } = stack.pop()!;
    if (children.has(row)) {
      throw new Error('[DataTable tree] A node cannot be cyclic or attached more than once.');
    }
    const subRows = getSubRows(row, index);
    if (subRows !== undefined && !Array.isArray(subRows)) {
      throw new Error(
        '[DataTable tree] getSubRows must synchronously return an array or undefined.'
      );
    }
    children.set(row, subRows);
    originalIndexes.set(row, index);
    for (let i = (subRows?.length ?? 0) - 1; i >= 0; i -= 1) {
      stack.push({ row: subRows![i], index: i });
    }
  }
  // TanStack 的 core row model 以 data 引用为缓存键；children getter 改变也必须更新快照。
  return { data: [...data], getSubRows: (row: TData) => children.get(row), originalIndexes };
}

export function getTreeNodeIds<TData>(rows: Row<TData>[]) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) {
      throw new Error('[DataTable tree] Row IDs must be unique across the entire loaded tree.');
    }
    ids.add(row.id);
  }
  return ids;
}

export function pruneTreeExpanded(
  expanded: ExpandedState,
  ids: ReadonlySet<string>
): ExpandedState {
  if (expanded === true) return expanded;
  const keys = Object.keys(expanded);
  if (keys.every((id) => ids.has(id))) return expanded;
  return Object.fromEntries(keys.filter((id) => ids.has(id)).map((id) => [id, expanded[id]]));
}
