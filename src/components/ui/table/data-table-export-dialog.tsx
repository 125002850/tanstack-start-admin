import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export const DATA_TABLE_EXPORT_MAX_ROWS = 5000;

export interface DataTableExportRange {
  start: number;
  end: number;
}

export interface DataTableExportDialogLabels {
  title?: string;
  description?: (total: number, maxRows: number) => string;
  startLabel?: string;
  endLabel?: string;
  cancelText?: string;
  confirmRangeText?: string;
  packageText?: string;
  packageUnavailableText?: string;
}

interface DataTableExportDialogProps {
  open: boolean;
  total: number;
  maxRows?: number;
  rangeSubmitting?: boolean;
  packageSubmitting?: boolean;
  labels?: DataTableExportDialogLabels;
  onOpenChange: (open: boolean) => void;
  onConfirmRange?: (range: DataTableExportRange) => void | Promise<void>;
  onPackageExport?: () => void | Promise<void>;
}

function getExportRangeCount(range: DataTableExportRange) {
  return range.end - range.start + 1;
}

function parsePositiveInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function validateRange(startValue: string, endValue: string, total: number, maxRows: number) {
  const start = parsePositiveInteger(startValue);
  const end = parsePositiveInteger(endValue);

  if (!start || !end) {
    return { error: '请输入有效的起止序号。' };
  }

  if (start > total || end > total) {
    return { error: `起止序号不能超过当前结果总数 ${total}。` };
  }

  if (end < start) {
    return { error: '结束序号不能小于起始序号。' };
  }

  const count = getExportRangeCount({ start, end });
  if (count > maxRows) {
    return { error: `单次最多导出 ${maxRows} 条。` };
  }

  return { start, end };
}

export function DataTableExportDialog({
  open,
  total,
  maxRows = DATA_TABLE_EXPORT_MAX_ROWS,
  rangeSubmitting = false,
  packageSubmitting = false,
  labels,
  onOpenChange,
  onConfirmRange,
  onPackageExport
}: DataTableExportDialogProps) {
  const startId = React.useId();
  const endId = React.useId();
  const [startValue, setStartValue] = React.useState('1');
  const [endValue, setEndValue] = React.useState(String(Math.min(total, maxRows)));

  React.useEffect(() => {
    if (!open) return;
    setStartValue('1');
    setEndValue(String(Math.min(total, maxRows)));
  }, [maxRows, open, total]);

  const validation = React.useMemo(
    () => validateRange(startValue, endValue, total, maxRows),
    [endValue, maxRows, startValue, total]
  );
  const error = 'error' in validation ? validation.error : undefined;
  const isSubmitting = rangeSubmitting || packageSubmitting;
  const packageUnavailableText = labels?.packageUnavailableText ?? '当前页面暂不支持打包导出。';

  const handleConfirmRange = React.useCallback(async () => {
    if ('error' in validation || !onConfirmRange) return;
    await onConfirmRange({ start: validation.start, end: validation.end });
  }, [onConfirmRange, validation]);

  const handlePackageExport = React.useCallback(async () => {
    if (!onPackageExport) return;
    await onPackageExport();
  }, [onPackageExport]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels?.title ?? '选择导出方式'}</DialogTitle>
          <DialogDescription>
            {labels?.description?.(total, maxRows) ??
              `当前结果共 ${total} 条，单次最多导出 ${maxRows} 条。可选择区间导出，或打包导出全部结果。`}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className='gap-4 sm:grid sm:grid-cols-2'>
          <Field data-invalid={Boolean(error)} data-disabled={!onConfirmRange || isSubmitting}>
            <FieldLabel htmlFor={startId}>{labels?.startLabel ?? '起始序号'}</FieldLabel>
            <Input
              id={startId}
              type='number'
              min={1}
              max={total}
              step={1}
              inputMode='numeric'
              aria-invalid={Boolean(error)}
              disabled={!onConfirmRange || isSubmitting}
              value={startValue}
              onChange={(event) => setStartValue(event.target.value)}
            />
          </Field>
          <Field data-invalid={Boolean(error)} data-disabled={!onConfirmRange || isSubmitting}>
            <FieldLabel htmlFor={endId}>{labels?.endLabel ?? '结束序号'}</FieldLabel>
            <Input
              id={endId}
              type='number'
              min={1}
              max={total}
              step={1}
              inputMode='numeric'
              aria-invalid={Boolean(error)}
              disabled={!onConfirmRange || isSubmitting}
              value={endValue}
              onChange={(event) => setEndValue(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <FieldError>{error}</FieldError>
        {!onPackageExport ? (
          <p className='text-sm text-muted-foreground'>{packageUnavailableText}</p>
        ) : null}

        <DialogFooter>
          <Button variant='outline' disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            {labels?.cancelText ?? '取消'}
          </Button>
          <Button
            variant='outline'
            disabled={!onPackageExport || isSubmitting}
            isLoading={packageSubmitting}
            onClick={handlePackageExport}
          >
            {labels?.packageText ?? '打包导出'}
          </Button>
          <Button
            disabled={Boolean(error) || !onConfirmRange || isSubmitting}
            isLoading={rangeSubmitting}
            onClick={handleConfirmRange}
          >
            {labels?.confirmRangeText ?? '确认导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
