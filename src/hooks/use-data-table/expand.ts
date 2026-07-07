import type { Row } from '@tanstack/react-table';

/**
 * DataTable 行展开状态工具。
 *
 * 展开态只保存字符串 rowKey；这里统一处理 DOM id、rowKey 序列化和从当前 rowModel 找回
 * 业务行数据的逻辑。
 */
/** 为展开面板生成稳定的 DOM id，优先复用 tableId。 */
export function getStableExpandPanelId(tableId: string | undefined, reactId: string) {
  const stableId = reactId.replace(/[:]/g, '');
  return `data-table-expand-panel-${tableId ?? stableId}`;
}

/** 统一把行主键解析成字符串，方便展开状态比较。 */
export function getExpandRowKeyValue<TData>(
  row: TData,
  rowKey: keyof TData & string
): string | null {
  const value = row[rowKey];

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return null;
}

/** 从当前页数据里找出与 expandedRowKey 对应的那一行。 */
export function findExpandedRow<TData>({
  rows,
  expandedRowKey,
  rowKey
}: {
  rows: Array<Row<TData>>;
  expandedRowKey: string | null;
  rowKey: keyof TData & string;
}): TData | null {
  if (!expandedRowKey) {
    return null;
  }

  return (
    rows.find((row) => getExpandRowKeyValue(row.original, rowKey) === expandedRowKey)?.original ??
    null
  );
}
