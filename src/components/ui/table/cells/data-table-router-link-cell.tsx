import { Link } from '@tanstack/react-router';

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
