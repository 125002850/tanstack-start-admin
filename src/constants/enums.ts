import { Option } from '@/types';

export enum DictStatus {
  ENABLE = 'enable',
  DISABLE = 'disable'
}

export const STATUS_OPTIONS: Option[] = [
  { value: DictStatus.ENABLE, label: '启用' },
  { value: DictStatus.DISABLE, label: '停用' }
];

export function getStatusLabel(code: string | undefined): string {
  return STATUS_OPTIONS.find((opt) => opt.value === code)?.label ?? code ?? '';
}

export const EXPORT_RECORD_STATUS = {
  PROCESSING: 1,
  SUCCESS: 2,
  FAILED: 3
} as const;

export type ExportRecordStatus = (typeof EXPORT_RECORD_STATUS)[keyof typeof EXPORT_RECORD_STATUS];
