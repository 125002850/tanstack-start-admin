import { useDict } from '@/hooks/use-dict';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTableFilterTrigger } from '@/components/data-table/filters/data-table-filter-trigger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SingleChoiceCombobox } from '@/components/ui/choice-combobox';
import {
  listWorkCalendarVersionsQueryOptions,
  type WorkCalendarVersionSummaryRspDTO
} from '@/lib/api/clients/service';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { SILENT_QUERY_META } from '@/lib/query-client';
import { formatDateTime } from '@/lib/formatters/date';

interface WorkCalendarVersionListProps {
  year: number;
  selectedVersion?: WorkCalendarVersionSummaryRspDTO;
  activeVersionId?: number;
  disabled: boolean;
  onSelect: (versionId: number) => void;
}

export function WorkCalendarVersionList({
  year,
  selectedVersion,
  activeVersionId,
  disabled,
  onSelect
}: WorkCalendarVersionListProps) {
  const status = useDict('WORK_CALENDAR_VERSION_STATUS');
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const selectedVersionId = selectedVersion?.versionId;
  const query = useQuery({
    ...listWorkCalendarVersionsQueryOptions({ year }),
    enabled: open,
    meta: SILENT_QUERY_META
  });
  const versions = query.data ?? [];
  const search = inputValue.trim().toLowerCase();
  const options = versions.flatMap((version) =>
    version.versionId === undefined
      ? []
      : [
          {
            value: version.versionId,
            label: `v${version.versionNo ?? '—'} ${getStatusLabel(version)}`,
            labelContent: (
              <span className='inline-flex items-center gap-2'>
                <span>v{version.versionNo ?? '—'}</span>
                <Badge
                  variant={
                    version.versionId === activeVersionId
                      ? 'success'
                      : version.status
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {getStatusLabel(version)}
                </Badge>
              </span>
            ),
            description: getVersionDescription(version),
            keywords: [
              version.status === 'draft'
                ? (version.updatedByName ?? '')
                : (version.publishedByName ?? '')
            ],
            disabled: disabled || query.isLoading
          }
        ]
  );

  function getStatusLabel(version: WorkCalendarVersionSummaryRspDTO) {
    if (version.versionId === activeVersionId) return '生效';
    if (version.status === 'draft') return '草稿';
    if (version.status === 'published') return '历史发布';
    return status.getLabel(version.status ?? '') ?? '未知状态';
  }

  function getVersionDescription(version: WorkCalendarVersionSummaryRspDTO) {
    const isDraft = version.status === 'draft';
    const timestamp = isDraft ? version.updatedAt : version.publishedAt;
    const operator = isDraft ? version.updatedByName : version.publishedByName;
    return timestamp ? `${formatDateTime(timestamp)} · ${operator ?? '—'}` : undefined;
  }

  return (
    <SingleChoiceCombobox
      options={options}
      value={selectedVersionId ?? null}
      open={open}
      inputValue={inputValue}
      searchMode='local'
      triggerLabel='历史版本'
      placeholder='历史版本'
      searchPlaceholder='搜索版本号、状态或操作人'
      emptyText={search ? '未找到匹配版本' : '该年度暂无已保存版本'}
      loadingText='版本列表加载中…'
      isLoading={query.isLoading}
      isError={query.isError}
      errorText={
        normalizeApiError(query.error, { fallbackMessage: '无法读取历史版本，请重试。' }).message
      }
      allowEmpty={false}
      contentClassName='data-table-filter-popover w-72 max-w-[calc(100vw-2rem)]'
      renderTrigger={(triggerProps) => (
        <DataTableFilterTrigger
          {...triggerProps}
          title='历史版本'
          state={
            selectedVersion?.versionId !== undefined
              ? {
                  status: 'active',
                  selection: {
                    kind: 'labels',
                    count: 1,
                    items: [
                      {
                        key: selectedVersion.versionId,
                        label: `v${selectedVersion.versionNo ?? '—'}`
                      }
                    ]
                  }
                }
              : { status: 'idle' }
          }
        />
      )}
      onOpenChange={setOpen}
      onInputValueChange={setInputValue}
      onValueChange={(versionId) => {
        if (disabled || query.isLoading || versionId === null) return;
        if (versionId !== selectedVersionId) onSelect(versionId);
      }}
    >
      {query.isError ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='w-full'
          isLoading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          重新加载版本
        </Button>
      ) : null}
    </SingleChoiceCombobox>
  );
}
