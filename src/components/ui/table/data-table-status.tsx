import { IconFilePlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export type DataTableStatusType = 'onboarding' | 'empty' | 'error' | 'permission';

export interface DataTableStatusAction {
  label: string;
  onClick: () => void;
}

export interface DataTableStatusConfig {
  type: DataTableStatusType;
  title?: string;
  description?: string;
  primaryAction?: DataTableStatusAction;
  secondaryAction?: DataTableStatusAction;
}

export interface DataTableStatusContext {
  rows: { length: number };
  totalCount: number;
  hasFilters: boolean;
}

export type DataTableStatusFactory = (
  ctx: DataTableStatusContext
) => DataTableStatusConfig | undefined;

interface DataTableStatusProps {
  status: DataTableStatusConfig;
  colSpan?: number;
  className?: string;
}

interface DataTableStatusCardProps {
  config: DataTableStatusConfig;
  className?: string;
}

interface DataTableStatusInlineProps {
  config: DataTableStatusConfig;
  colSpan: number;
}

const STATUS_DEFAULTS: Record<
  DataTableStatusType,
  { icon: React.ReactNode; title: string; description: string }
> = {
  onboarding: {
    icon: <IconFilePlus className='h-7 w-7' />,
    title: '暂无数据',
    description: '当前模块暂未添加任何数据，创建第一条记录开始使用。'
  },
  empty: {
    icon: <Icons.search className='h-10 w-10' />,
    title: '未找到匹配记录',
    description: '尝试调整关键词或筛选条件。'
  },
  error: {
    icon: <Icons.alertCircle className='h-10 w-10' />,
    title: '数据加载失败',
    description: '请检查网络连接后重试。'
  },
  permission: {
    icon: <Icons.lock className='h-10 w-10' />,
    title: '暂无访问权限',
    description: '你当前没有查看此数据的权限。'
  }
};

function StatusCard({ config, className }: DataTableStatusCardProps) {
  const defaults = STATUS_DEFAULTS[config.type];
  const title = config.title ?? defaults.title;
  const description = config.description ?? defaults.description;

  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-center rounded-lg border border-dashed bg-gradient-to-b from-muted/30 to-transparent px-4 py-24',
        className
      )}
    >
      <div className='flex max-w-sm flex-col items-center gap-4 text-center'>
        <div className='flex h-14 w-14 items-center justify-center rounded-full bg-muted/50'>
          <span className='text-muted-foreground'>{defaults.icon}</span>
        </div>
        <div className='space-y-1.5'>
          <h3 className='text-base font-semibold'>{title}</h3>
          {description && <p className='text-sm text-muted-foreground'>{description}</p>}
        </div>
        {(config.primaryAction || config.secondaryAction) && (
          <div className='flex gap-2'>
            {config.primaryAction && (
              <Button size='sm' onClick={config.primaryAction.onClick}>
                {config.primaryAction.label}
              </Button>
            )}
            {config.secondaryAction && (
              <Button variant='outline' size='sm' onClick={config.secondaryAction.onClick}>
                {config.secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusInline({ config, colSpan }: DataTableStatusInlineProps) {
  const defaults = STATUS_DEFAULTS[config.type];
  const title = config.title ?? defaults.title;
  const description = config.description ?? defaults.description;

  return (
    <TableBody>
      <TableRow>
        <TableCell colSpan={colSpan}>
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <span className='text-muted-foreground/30 mb-4'>{defaults.icon}</span>
            <h3 className='text-sm font-medium'>{title}</h3>
            {description && <p className='text-muted-foreground mt-1 text-sm'>{description}</p>}
            {(config.primaryAction || config.secondaryAction) && (
              <div className='mt-4 flex gap-2'>
                {config.primaryAction && (
                  <Button variant='outline' size='sm' onClick={config.primaryAction.onClick}>
                    {config.primaryAction.label}
                  </Button>
                )}
                {config.secondaryAction && (
                  <Button variant='ghost' size='sm' onClick={config.secondaryAction.onClick}>
                    {config.secondaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  );
}

export function DataTableStatus({ status: config, colSpan = 1, className }: DataTableStatusProps) {
  switch (config.type) {
    case 'onboarding':
      return <StatusCard config={config} className={className} />;
    case 'empty':
    case 'error':
    case 'permission':
      return <StatusInline config={config} colSpan={colSpan} />;
    default: {
      const _: never = config.type;
      return null;
    }
  }
}
