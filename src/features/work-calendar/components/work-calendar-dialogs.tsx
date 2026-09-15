import { DictText } from '@/components/dictionary/dictionary-scope';
import * as React from 'react';

import { Icons } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
  PrepareWorkCalendarPublicationRspDTO,
  TimeClassificationRspDTO
} from '@/lib/api/clients/service';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { downloadTextFile } from '@/lib/browser/download-text-file';

export function WorkCalendarDirtyDialog({
  open,
  onCancel,
  onConfirm
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存修改？</AlertDialogTitle>
          <AlertDialogDescription>
            当前草稿有未保存修改。离开后这些修改会丢失，是否继续？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <Button type='button' variant='destructive' onClick={onConfirm}>
            放弃修改并离开
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ImportJsonDialogProps {
  open: boolean;
  pending: boolean;
  year: number;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<void>;
}

export function ImportJsonDialog({
  open,
  pending,
  year,
  onOpenChange,
  onImport
}: ImportJsonDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onAfterClose={reset}>
        <DialogHeader>
          <DialogTitle>覆盖导入特殊日期</DialogTitle>
          <DialogDescription>
            导入后，当前草稿中的特殊日期将被文件内容完整替换；标准工作时段和已发布版本不受影响。
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Input
            type='file'
            accept='application/json,.json'
            aria-label='选择工作日历 JSON 文件'
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              if (nextFile && nextFile.size > 1024 * 1024) {
                setFile(null);
                setError('文件不能超过 1 MiB。');
                return;
              }
              setFile(nextFile);
              setError(null);
            }}
          />
          <p className='text-xs text-muted-foreground'>仅支持 UTF-8 JSON 文件，最大 1 MiB。</p>
          {file && (
            <p className='rounded-md bg-muted px-3 py-2 text-sm'>
              {file.name} · {formatFileSize(file.size)}
            </p>
          )}
          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => downloadWorkCalendarImportTemplate(year)}
          >
            <Icons.download className='size-4' data-icon='inline-start' />
            导出模版
          </Button>
          <Button
            type='button'
            disabled={!file}
            isLoading={pending}
            onClick={async () => {
              if (!file) return;
              try {
                await onImport(file);
                onOpenChange(false);
              } catch (error) {
                setError(
                  normalizeApiError(error, {
                    fallbackMessage: '导入失败，当前草稿未发生变化。'
                  }).message
                );
              }
            }}
          >
            确认覆盖特殊日期
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DraftEvaluationDialogProps {
  open: boolean;
  pending: boolean;
  year: number;
  onOpenChange: (open: boolean) => void;
  onEvaluate: (localDateTime: string) => Promise<TimeClassificationRspDTO>;
}

export function DraftEvaluationDialog({
  open,
  pending,
  year,
  onOpenChange,
  onEvaluate
}: DraftEvaluationDialogProps) {
  const [value, setValue] = React.useState(`${year}-01-01T10:00`);
  const [result, setResult] = React.useState<TimeClassificationRspDTO | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setValue(`${year}-01-01T10:00`);
    setResult(null);
    setError(null);
  }, [open, year]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>试算已保存草稿</DialogTitle>
          <DialogDescription>
            输入 Asia/Shanghai 本地时间。结果只代表已保存草稿，不是当前生效规则。
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <Input
            type='datetime-local'
            aria-label='草稿试算时间'
            min={`${year}-01-01T00:00`}
            max={`${year}-12-31T23:59`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {error && <p className='text-sm text-destructive'>{error}</p>}
          {result && <EvaluationResult result={result} />}
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            type='button'
            isLoading={pending}
            disabled={!value}
            onClick={async () => {
              try {
                setError(null);
                setResult(await onEvaluate(toBackendDateTime(value)));
              } catch (error) {
                setError(
                  normalizeApiError(error, {
                    fallbackMessage: '试算失败，请确认草稿仍为最新版本。'
                  }).message
                );
              }
            }}
          >
            开始试算
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationResult({ result }: { result: TimeClassificationRspDTO }) {
  return (
    <div className='space-y-3 rounded-lg border bg-muted/30 p-4 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge>
          {<DictText typeCode='WORK_CALENDAR_TIME_CLASSIFICATION' value={result.classification} />}
        </Badge>
        <Badge variant='outline'>
          {<DictText typeCode='WORK_CALENDAR_EFFECTIVE_DAY_KIND' value={result.effectiveDayKind} />}
        </Badge>
        <span className='text-muted-foreground'>
          {result.working ? '处于工作时间' : '非工作时间'}
        </span>
      </div>
      <dl className='grid gap-2 sm:grid-cols-2'>
        <ResultItem label='日期名称' value={result.dateName ?? '—'} />
        <ResultItem
          label='日期特征'
          value={result.traits?.map((trait, index) => (
            <span key={trait}>
              {index > 0 ? '、' : ''}
              <DictText typeCode='WORK_CALENDAR_DAY_TRAIT' value={trait} />
            </span>
          ))}
        />
        <ResultItem
          label='命中时段'
          value={
            result.matchedPeriod ? `${result.matchedPeriod.start}–${result.matchedPeriod.end}` : '—'
          }
        />
        <ResultItem
          label='判定依据'
          value={<DictText typeCode='WORK_CALENDAR_CLASSIFICATION_BASIS' value={result.basis} />}
        />
      </dl>
    </div>
  );
}

function ResultItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='mt-0.5'>{value}</dd>
    </div>
  );
}

interface PublicationDialogProps {
  open: boolean;
  year: number;
  versionNo?: number;
  preparation: PrepareWorkCalendarPublicationRspDTO | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function PublicationDialog({
  open,
  year,
  versionNo,
  preparation,
  pending,
  onOpenChange,
  onConfirm
}: PublicationDialogProps) {
  const diff = preparation?.diffSummary;
  const publishable = preparation?.publishable === true;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <AlertDialogHeader>
          <AlertDialogTitle>
            发布 {year} 年工作日历{versionNo ? ` v${versionNo}` : ''}
          </AlertDialogTitle>
          <AlertDialogDescription>
            发布后该版本不可编辑，并立即成为该年度时间判定的权威快照。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!publishable ? (
          <Alert variant='destructive'>
            <Icons.warning className='size-4' />
            <AlertTitle>全年校验未通过</AlertTitle>
            <AlertDescription>
              {(preparation?.validationIssues ?? ['请修正规则后重新预检。']).map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : (
          <div className='space-y-4'>
            {diff?.initialPublication && <Badge variant='secondary'>该年度首次发布</Badge>}
            <div className='grid gap-3 sm:grid-cols-4'>
              <DiffMetric
                label='标准时段'
                value={diff?.standardPeriodsChanged ? '有变化' : '无变化'}
              />
              <DiffMetric label='新增日期' value={String(diff?.addedCount ?? 0)} />
              <DiffMetric label='删除日期' value={String(diff?.removedCount ?? 0)} />
              <DiffMetric label='修改日期' value={String(diff?.changedCount ?? 0)} />
            </div>
            {(diff?.dateChanges?.length ?? 0) > 0 && (
              <div className='max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3'>
                {diff!.dateChanges!.map((change) => (
                  <div
                    key={change.date}
                    className='grid grid-cols-[6rem_5rem_minmax(0,1fr)] items-center gap-3 text-sm'
                  >
                    <span className='font-mono text-xs'>{change.date}</span>
                    <span>
                      {
                        <DictText
                          typeCode='WORK_CALENDAR_PUBLICATION_CHANGE_TYPE'
                          value={change.changeType}
                        />
                      }
                    </span>
                    <span className='truncate text-right text-muted-foreground'>
                      {change.after?.name ?? change.before?.name ?? '未命名'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          {publishable && (
            <Button type='button' isLoading={pending} onClick={() => void onConfirm()}>
              确认发布
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DiffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border bg-muted/30 p-3'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-1 font-medium'>{value}</p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
}

function downloadWorkCalendarImportTemplate(year: number) {
  const template = {
    schemaVersion: 1,
    year,
    source: '导入模版示例，请修改后使用',
    dateOverrides: [
      {
        date: `${year}-01-01`,
        type: 'public_holiday',
        name: '示例：法定节假日',
        sourceNote: '示例：请填写节假日来源'
      },
      {
        date: `${year}-01-04`,
        type: 'adjusted_workday',
        name: '示例：调休工作日',
        customPeriods: [
          { start: '09:00', end: '12:00' },
          { start: '13:30', end: '18:00' }
        ],
        sourceNote: '示例：请填写调休安排来源'
      },
      {
        date: `${year}-12-31`,
        type: 'other_non_working_day',
        name: '示例：其他非工作日',
        sourceNote: '示例：请填写安排依据'
      }
    ]
  };

  downloadTextFile(
    `${JSON.stringify(template, null, 2)}\n`,
    `work-calendar-${year}-import-template.json`,
    'application/json;charset=utf-8'
  );
}

function toBackendDateTime(value: string) {
  const normalized = value.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}
