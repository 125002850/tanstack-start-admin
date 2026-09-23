import { useDict } from '@/hooks/use-dict';
import { DictionaryScope } from '@/components/dictionary/dictionary-scope';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppForm } from '@/components/ui/tanstack-form';
import {
  evaluateWorkCalendarDraftMutationOptions,
  fetchWorkCalendarYearDetailQueryKey,
  fetchWorkCalendarYearDetailQueryOptions,
  importWorkCalendarDraftMutationOptions,
  prepareWorkCalendarPublicationMutationOptions,
  publishWorkCalendarDraftMutationOptions,
  saveWorkCalendarDraftMutationOptions,
  type PrepareWorkCalendarPublicationRspDTO,
  type TimeClassificationRspDTO,
  type WorkCalendarYearDetailReqDTO,
  type WorkCalendarYearDetailRspDTO
} from '@/lib/api/clients/service';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import { DateOverrideSheet } from './components/date-override-sheet';
import { StandardPeriodsEditor } from './components/standard-periods-editor';
import {
  DraftEvaluationDialog,
  ImportJsonDialog,
  PublicationDialog,
  WorkCalendarDirtyDialog
} from './components/work-calendar-dialogs';
import { Header } from './components/work-calendar-header';
import { CalendarLegend } from './components/work-calendar-legend';
import { YearCalendarGrid } from './components/year-calendar-grid';
import { useWorkCalendarDirtyGuard } from './hooks/use-work-calendar-dirty-guard';
import {
  findChangedDates,
  indexOverrides,
  toDraftFormValue,
  workCalendarDraftSchema,
  type WorkCalendarDateOverrideValue,
  type WorkCalendarDraftFormValue
} from './model/work-calendar-model';
import {
  type WorkCalendarViewMode,
  WorkCalendarYearDetailReqDTOView
} from './model/work-calendar-page-model';
import {
  requireResponse,
  resolveWorkCalendarViewMode,
  toOperationError,
  toSaveRequest,
  WORK_CALENDAR_CLASSIFICATION_BASIS
} from './model/work-calendar-page-model';

interface WorkCalendarPageProps {
  year: number;
  onYearChange: (year: number) => void;
}

export default function WorkCalendarPage(props: WorkCalendarPageProps) {
  return (
    <DictionaryScope
      typeCodes={[
        'WORK_CALENDAR_CLASSIFICATION_BASIS',
        'WORK_CALENDAR_DATE_OVERRIDE_TYPE',
        'WORK_CALENDAR_DAY_TRAIT',
        'WORK_CALENDAR_EFFECTIVE_DAY_KIND',
        'WORK_CALENDAR_HOLIDAY_STATUS',
        'WORK_CALENDAR_PUBLICATION_CHANGE_TYPE',
        'WORK_CALENDAR_TIME_CLASSIFICATION',
        'WORK_CALENDAR_VERSION_STATUS',
        'WORK_CALENDAR_YEAR_VIEW'
      ]}
    >
      <WorkCalendarContent {...props} />
    </DictionaryScope>
  );
}

function WorkCalendarContent({ year, onYearChange }: WorkCalendarPageProps) {
  const [viewSelection, setViewSelection] = React.useState<{
    year: number;
    mode: WorkCalendarViewMode;
  } | null>(null);
  const requestedView = viewSelection?.year === year ? viewSelection.mode : undefined;
  const detailRequest: WorkCalendarYearDetailReqDTO = requestedView
    ? { year, view: requestedView }
    : { year };
  const query = useQuery(fetchWorkCalendarYearDetailQueryOptions(detailRequest));

  if (query.isLoading && !query.data) {
    return <WorkCalendarPageSkeleton />;
  }
  if (query.isError || !query.data) {
    return (
      <Alert variant='destructive'>
        <Icons.alertCircle className='size-4' />
        <AlertTitle>工作日历加载失败</AlertTitle>
        <AlertDescription>
          <p>
            {
              normalizeApiError(query.error, {
                fallbackMessage: `无法读取 ${year} 年工作日历，请稍后重试。`
              }).message
            }
          </p>
          <Button type='button' size='sm' variant='outline' onClick={() => void query.refetch()}>
            重新加载
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  let serverValue: WorkCalendarDraftFormValue;
  try {
    serverValue = toDraftFormValue(query.data, year);
  } catch (error) {
    console.error('Work calendar response contains an unsupported enum value.', error);
    return (
      <Alert variant='destructive'>
        <Icons.alertCircle className='size-4' />
        <AlertTitle>工作日历数据无法识别</AlertTitle>
        <AlertDescription>
          <p>接口返回了当前页面不支持的日期类型。为避免误判，页面已停止展示年度规则。</p>
          <Button type='button' size='sm' variant='outline' onClick={() => void query.refetch()}>
            重新加载
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const viewMode = resolveWorkCalendarViewMode(query.data, requestedView);

  return (
    <WorkCalendarEditor
      year={year}
      detail={query.data}
      detailRequest={detailRequest}
      serverValue={serverValue}
      viewMode={viewMode}
      queryRefreshing={query.isFetching}
      onYearChange={onYearChange}
      onViewModeChange={(mode) => setViewSelection({ year, mode })}
      onReload={() => void query.refetch()}
    />
  );
}

interface WorkCalendarEditorProps {
  year: number;
  detail: WorkCalendarYearDetailRspDTO;
  detailRequest: WorkCalendarYearDetailReqDTO;
  serverValue: WorkCalendarDraftFormValue;
  viewMode: WorkCalendarViewMode;
  queryRefreshing: boolean;
  onYearChange: (year: number) => void;
  onViewModeChange: (mode: WorkCalendarViewMode) => void;
  onReload: () => void;
}

function WorkCalendarEditor({
  year,
  detail,
  detailRequest,
  serverValue,
  viewMode,
  queryRefreshing,
  onYearChange,
  onViewModeChange,
  onReload
}: WorkCalendarEditorProps) {
  const basis = useDict('WORK_CALENDAR_CLASSIFICATION_BASIS');
  const queryClient = useQueryClient();
  const dateTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [dateSheetOpen, setDateSheetOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [evaluationOpen, setEvaluationOpen] = React.useState(false);
  const [publicationOpen, setPublicationOpen] = React.useState(false);
  const [preparation, setPreparation] = React.useState<PrepareWorkCalendarPublicationRspDTO | null>(
    null
  );
  const [operationError, setOperationError] = React.useState<string | null>(null);

  const saveMutation = useMutation(saveWorkCalendarDraftMutationOptions());
  const importMutation = useMutation(importWorkCalendarDraftMutationOptions());
  const evaluateMutation = useMutation(evaluateWorkCalendarDraftMutationOptions());
  const prepareMutation = useMutation(prepareWorkCalendarPublicationMutationOptions());
  const publishMutation = useMutation(publishWorkCalendarDraftMutationOptions());

  const form = useAppForm({
    defaultValues: serverValue,
    validators: { onSubmit: workCalendarDraftSchema },
    onSubmit: async ({ value }) => {
      try {
        setOperationError(null);
        const nextDetail = requireResponse(
          await saveMutation.mutateAsync(toSaveRequest(value)),
          '保存草稿响应缺少数据'
        );
        applyServerDetail(nextDetail, '草稿已保存');
      } catch (error) {
        setOperationError(toOperationError(error, '草稿保存失败，请检查规则后重试。'));
      }
    }
  });
  const values = useStore(form.store, (state) => state.values);
  const dirty = useStore(form.store, (state) => state.isDirty);
  const readOnly = viewMode === WorkCalendarYearDetailReqDTOView.active;
  const dirtyGuard = useWorkCalendarDirtyGuard(dirty);

  React.useEffect(() => {
    if (!dirty) form.reset(serverValue);
  }, [dirty, form, serverValue]);

  const currentOverrideByDate = React.useMemo(
    () => indexOverrides(values.dateOverrides),
    [values.dateOverrides]
  );
  const { changed: changedDates, removed: removedDates } = React.useMemo(
    () => findChangedDates(serverValue.dateOverrides, values.dateOverrides),
    [serverValue.dateOverrides, values.dateOverrides]
  );
  const pendingOverrides = React.useMemo(
    () =>
      new Map(
        [...changedDates].flatMap((date) => {
          const override = currentOverrideByDate.get(date);
          return override ? [[date, override] as const] : [];
        })
      ),
    [changedDates, currentOverrideByDate]
  );
  const handleSelectDate = React.useCallback((date: string, trigger: HTMLButtonElement) => {
    dateTriggerRef.current = trigger;
    setSelectedDate(date);
    setDateSheetOpen(true);
  }, []);

  function applyServerDetail(nextDetail: WorkCalendarYearDetailRspDTO, successMessage: string) {
    queryClient.setQueryData(fetchWorkCalendarYearDetailQueryKey(detailRequest), nextDetail);
    queryClient.setQueryData(fetchWorkCalendarYearDetailQueryKey({ year }), nextDetail);
    form.reset(toDraftFormValue(nextDetail, year));
    setOperationError(null);
    toast.success(successMessage);
  }

  function requireSavedDraft(action: '导入' | '试算' | '发布') {
    if (!values.draftVersionId || values.expectedLockVersion === undefined) {
      toast.warning(`首次配置需先添加标准工作时段并保存草稿，再进行${action}。`);
      return false;
    }
    if (dirty) {
      toast.warning(`${action}只使用已保存草稿，请先保存当前修改。`);
      return false;
    }
    return true;
  }

  async function handlePreparePublication() {
    if (!requireSavedDraft('发布')) return;
    try {
      setOperationError(null);
      const result = requireResponse(
        await prepareMutation.mutateAsync({
          draftVersionId: values.draftVersionId!,
          expectedLockVersion: values.expectedLockVersion!
        }),
        '发布预检响应缺少数据'
      );
      setPreparation(result);
      setPublicationOpen(true);
    } catch (error) {
      setOperationError(toOperationError(error, '发布预检失败，请重新加载草稿后重试。'));
    }
  }

  async function handlePublish() {
    if (
      !preparation?.draftVersionId ||
      preparation.draftLockVersion === undefined ||
      !preparation.contentHash
    ) {
      setOperationError('发布预检结果不完整，请关闭后重新预检。');
      return;
    }
    try {
      const nextDetail = requireResponse(
        await publishMutation.mutateAsync({
          draftVersionId: preparation.draftVersionId,
          expectedLockVersion: preparation.draftLockVersion,
          contentHash: preparation.contentHash
        }),
        '发布响应缺少数据'
      );
      setPublicationOpen(false);
      setPreparation(null);
      applyServerDetail(nextDetail, `${year} 年工作日历已发布`);
      queryClient.setQueryData(
        fetchWorkCalendarYearDetailQueryKey({
          year,
          view: WorkCalendarYearDetailReqDTOView.active
        }),
        nextDetail
      );
      onViewModeChange(WorkCalendarYearDetailReqDTOView.active);
    } catch (error) {
      setOperationError(toOperationError(error, '发布失败，草稿可能已变化，请重新预检。'));
    }
  }

  async function handleImport(file: File) {
    if (!values.draftVersionId || values.expectedLockVersion === undefined) return;
    const nextDetail = requireResponse(
      await importMutation.mutateAsync({
        params: {
          year,
          draftVersionId: values.draftVersionId,
          expectedLockVersion: values.expectedLockVersion
        },
        body: { file }
      }),
      '导入响应缺少数据'
    );
    applyServerDetail(nextDetail, '特殊日期已覆盖导入');
  }

  async function handleEvaluate(localDateTime: string): Promise<TimeClassificationRspDTO> {
    if (!values.draftVersionId || values.expectedLockVersion === undefined) {
      throw new Error('Draft missing');
    }
    return requireResponse(
      await evaluateMutation.mutateAsync({
        draftVersionId: values.draftVersionId,
        expectedLockVersion: values.expectedLockVersion,
        localDateTime
      }),
      '草稿试算响应缺少数据'
    );
  }

  function commitDateOverride(date: string, override: WorkCalendarDateOverrideValue | null) {
    const next = values.dateOverrides.filter((item) => item.date !== date);
    if (override) next.push(override);
    form.setFieldValue(
      'dateOverrides',
      next.toSorted((left, right) => left.date.localeCompare(right.date))
    );
  }

  return (
    <form.AppForm>
      <form.Form className='gap-4 p-0 md:p-0'>
        <WorkCalendarDirtyDialog
          open={dirtyGuard.confirmOpen}
          onCancel={dirtyGuard.cancelDiscard}
          onConfirm={dirtyGuard.confirmDiscard}
        />
        <ImportJsonDialog
          open={importOpen}
          pending={importMutation.isPending}
          year={year}
          onOpenChange={setImportOpen}
          onImport={handleImport}
        />
        <DraftEvaluationDialog
          open={evaluationOpen}
          pending={evaluateMutation.isPending}
          year={year}
          onOpenChange={setEvaluationOpen}
          onEvaluate={handleEvaluate}
        />
        <PublicationDialog
          open={publicationOpen}
          year={year}
          versionNo={detail.draftVersion?.versionNo}
          preparation={preparation}
          pending={publishMutation.isPending}
          onOpenChange={(open) => {
            setPublicationOpen(open);
            if (!open) setPreparation(null);
          }}
          onConfirm={handlePublish}
        />
        {selectedDate && !readOnly && (
          <DateOverrideSheet
            key={selectedDate}
            open={dateSheetOpen}
            date={selectedDate}
            override={currentOverrideByDate.get(selectedDate)}
            standardPeriods={values.standardPeriods}
            onOpenChange={setDateSheetOpen}
            onAfterClose={() => {
              dateTriggerRef.current?.focus();
              dateTriggerRef.current = null;
              setSelectedDate(null);
            }}
            onCommit={commitDateOverride}
          />
        )}

        <Header
          year={year}
          detail={detail}
          dirty={dirty}
          viewMode={viewMode}
          refreshing={queryRefreshing}
          saving={saveMutation.isPending}
          preparing={prepareMutation.isPending}
          onYearChange={onYearChange}
          onViewModeChange={(nextMode) => {
            if (nextMode === viewMode) return;
            if (dirty) {
              toast.warning('当前草稿有未保存修改，请先保存或放弃修改后再切换版本。');
              return;
            }
            onViewModeChange(nextMode);
          }}
          onSave={() => {
            const validation = workCalendarDraftSchema.safeParse(values);
            if (!validation.success) {
              const messages = [...new Set(validation.error.issues.map((issue) => issue.message))];
              setOperationError(`草稿尚未保存：${messages.slice(0, 3).join('；')}`);
              return;
            }
            void form.handleSubmit();
          }}
          onImport={() => requireSavedDraft('导入') && setImportOpen(true)}
          onEvaluate={() => requireSavedDraft('试算') && setEvaluationOpen(true)}
          onPublish={() => void handlePreparePublication()}
        />

        {detail.viewBasis === WORK_CALENDAR_CLASSIFICATION_BASIS.weeklyFallback && (
          <Alert>
            <Icons.warning className='size-4' />
            <AlertTitle>
              {detail.activeVersion ? '该年度尚未发布' : '临时推导 · 非权威结果'}
            </AlertTitle>
            <AlertDescription>
              该年度当前仅按周一至周五工作、周末休息进行临时推导；法定节假日与调休安排未知。
            </AlertDescription>
          </Alert>
        )}

        {operationError && (
          <Alert variant='destructive'>
            <Icons.alertCircle className='size-4' />
            <AlertTitle>操作未完成</AlertTitle>
            <AlertDescription>
              <p>{operationError}</p>
              <Button type='button' size='sm' variant='outline' onClick={onReload}>
                重新加载服务端草稿
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <StandardPeriodsEditor
          periods={values.standardPeriods}
          readOnly={readOnly}
          onChange={(periods) => form.setFieldValue('standardPeriods', periods)}
        />
        <CalendarLegend
          viewBasis={basis.getLabel(detail.viewBasis ?? '')}
          dirty={!readOnly && dirty}
        />
        <YearCalendarGrid
          year={year}
          days={detail.resolvedDays ?? []}
          pendingOverrides={pendingOverrides}
          pendingRemovedDates={removedDates}
          readOnly={readOnly}
          onSelectDate={handleSelectDate}
        />
      </form.Form>
    </form.AppForm>
  );
}

function WorkCalendarPageSkeleton() {
  return (
    <div className='space-y-4' aria-label='工作日历加载中'>
      <Skeleton className='h-32 w-full rounded-xl' />
      <Skeleton className='h-40 w-full rounded-xl' />
      <div className='grid gap-4 lg:grid-cols-2 2xl:grid-cols-3'>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className='h-72 rounded-xl' />
        ))}
      </div>
    </div>
  );
}
