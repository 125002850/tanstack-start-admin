import { useDict } from '@/hooks/use-dict';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type WorkCalendarYearDetailRspDTO } from '@/lib/api/clients/service';
import { WORK_CALENDAR_TIME_ZONE } from '../model/work-calendar-model';
import {
  type WorkCalendarViewMode,
  WorkCalendarYearDetailReqDTOView
} from '../model/work-calendar-page-model';
import { WorkCalendarVersionList } from './work-calendar-version-list';
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
  onVersionChange: (versionId: number) => void;
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
  onVersionChange,
  onSave,
  onImport,
  onEvaluate,
  onPublish
}: HeaderProps) {
  const basis = useDict('WORK_CALENDAR_CLASSIFICATION_BASIS');
  const draftView = viewMode === WorkCalendarYearDetailReqDTOView.draft;
  const selectedVersion =
    viewMode === 'history'
      ? detail.selectedVersion
      : draftView
        ? detail.draftVersion
        : detail.activeVersion;

  return (
    <header className='flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between'>
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h1 className='text-xl font-semibold tracking-tight'>工作日历</h1>
          <Badge variant='outline'>{WORK_CALENDAR_TIME_ZONE}</Badge>
          {selectedVersion && (
            <Badge variant={viewMode === 'active' ? 'success' : 'secondary'}>
              {draftView ? '草稿' : viewMode === 'active' ? '生效' : '历史'} v
              {selectedVersion.versionNo ?? '—'}
            </Badge>
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
          <span className='text-sm text-muted-foreground'>
            {draftView
              ? (basis.getLabel(detail.viewBasis ?? '') ?? '未知视图')
              : viewMode === 'active'
                ? '当前生效快照（只读）'
                : '历史版本快照（只读）'}
          </span>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <WorkCalendarVersionList
          year={year}
          selectedVersion={selectedVersion}
          activeVersionId={detail.activeVersion?.versionId}
          disabled={dirty || saving || preparing}
          onSelect={onVersionChange}
        />
        {dirty && <span className='text-sm text-muted-foreground'>保存草稿后可切换版本</span>}
        {!draftView && (
          <Button type='button' variant='outline' onClick={() => onViewModeChange('draft')}>
            {detail.draftVersion ? '编辑草稿' : '新建草稿'}
          </Button>
        )}
        {draftView && (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
