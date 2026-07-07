import { Link } from '@tanstack/react-router';

/**
 * 表格内 TanStack Router 链接单元格。
 *
 * 只处理最常见的“有值则跳转、无值显示 -”场景；更复杂的权限、点击拦截或 Tooltip
 * 应使用自定义 cell 渲染。
 */
interface DataTableRouterLinkCellProps {
  value?: string;
  to: string;
  params: Record<string, string>;
  className?: string;
}

export function DataTableRouterLinkCell({
  value,
  to,
  params,
  className = 'text-primary hover:underline'
}: DataTableRouterLinkCellProps) {
  if (!value) return '-';
  return (
    <Link to={to} params={params} className={className}>
      {value}
    </Link>
  );
}
