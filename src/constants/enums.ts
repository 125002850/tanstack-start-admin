import { Option } from '@/types';

export enum DictStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED'
}

export const STATUS_OPTIONS: Option[] = [
  { value: DictStatus.ENABLED, label: '启用' },
  { value: DictStatus.DISABLED, label: '停用' }
];
