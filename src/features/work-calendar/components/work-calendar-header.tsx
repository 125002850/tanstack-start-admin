import { useDict } from '@/hooks/use-dict';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type WorkCalendarYearDetailRspDTO } from '@/lib/api/clients/service';
import { WORK_CALENDAR_TIME_ZONE } from '../model/work-calendar-model';
import {
  type WorkCalendarViewMode,
  WorkCalendarYearDetailReqDTOView
} from '../model/work-calendar-page-model';
import { WorkCalendarYearControl } from './work-calendar-year-control';

interface HeaderProps {
  year: number;
  detail: WorkCalendarYearDetailRspDTO;
  dirty: boolean;
  viewMode: WorkCalendarViewMode;
  refreshing: boolean;
  saving: boolean;
  preparing: boolean;
  onYearChange: (year: number) => void;
  onViewModeChange: (mode: WorkCalendarViewMode) => void;
  onSave: () => void;
  onImport: () => void;
  onEvaluate: () => void;
  onPublish: () => void;
}

export function Header({
  year,
  detail,
  dirty,
  viewMode,
  refreshing,
  saving,
  preparing,
  onYearChange,
  onViewModeChange,
  onSave,
  onImport,
  onEvaluate,
  onPublish
}: HeaderProps) {
  const basis = useDict('WORK_CALENDAR_CLASSIFICATION_BASIS');
  const draftView = viewMode === WorkCalendarYearDetailReqDTOView.draft;

  return (
    <header className='flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between'>
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h1 className='text-xl font-semibold tracking-tight'>工作日历</h1>
          <Badge variant='outline'>{WORK_CALENDAR_TIME_ZONE}</Badge>
          {detail.activeVersion && <Badge>生效 v{detail.activeVersion.versionNo ?? '—'}</Badge>}
          {detail.draftVersion && (
            <Badge variant='secondary'>草稿 v{detail.draftVersion.versionNo ?? '—'}</Badge>
          )}
          {!detail.activeVersion && !detail.draftVersion && (
            <Badge variant='outline'>首次配置</Badge>
          )}
          {!draftView && <Badge variant='outline'>只读</Badge>}
          {draftView && dirty && <Badge variant='outline'>有未保存修改</Badge>}
          {refreshing && <Icons.spinner className='size-4 animate-spin text-muted-foreground' />}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <WorkCalendarYearControl year={year} onYearChange={onYearChange} />
          {detail.activeVersion && (
            <ToggleGroup
              type='single'
              variant='outline'
              size='sm'
              value={viewMode}
              aria-label='工作日历版本视图'
              onValueChange={(value) => {
                if (
                  value === WorkCalendarYearDetailReqDTOView.draft ||
                  value === WorkCalendarYearDetailReqDTOView.active
                ) {
                  onViewModeChange(value);
                }
              }}
            >
              <ToggleGroupItem value={WorkCalendarYearDetailReqDTOView.draft}>
                {detail.draftVersion ? `草稿 v${detail.draftVersion.versionNo ?? '—'}` : '新草稿'}
              </ToggleGroupItem>
              <ToggleGroupItem value={WorkCalendarYearDetailReqDTOView.active}>
                生效 v{detail.activeVersion.versionNo ?? '—'}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <span className='text-sm text-muted-foreground'>
            {draftView
              ? (basis.getLabel(detail.viewBasis ?? '') ?? '未知视图')
              : '当前生效快照（只读）'}
          </span>
        </div>
      </div>

      {draftView && (
        <div className='flex flex-wrap items-center gap-2'>
          <Button type='button' variant='outline' onClick={onEvaluate}>
            <Icons.clock className='size-4' />
            草稿试算
          </Button>
          <Button type='button' variant='outline' onClick={onImport}>
            <Icons.upload className='size-4' />
            导入 JSON
          </Button>
          {dirty && (
            <Button type='button' variant='outline' isLoading={saving} onClick={onSave}>
              <Icons.save className='size-4' />
              保存草稿
            </Button>
          )}
          <Button type='button' isLoading={preparing} onClick={onPublish}>
            <Icons.checks className='size-4' />
            发布
          </Button>
        </div>
      )}
    </header>
  );
}
