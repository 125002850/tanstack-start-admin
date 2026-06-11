import { Option } from '@/types';

export enum DictStatus {
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE'
}

export const STATUS_OPTIONS: Option[] = [
  { value: DictStatus.ENABLE, label: '启用' },
  { value: DictStatus.DISABLE, label: '停用' }
];
