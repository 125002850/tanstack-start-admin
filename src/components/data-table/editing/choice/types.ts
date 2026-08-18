export type DataTableChoiceValue = string | number;

export interface DataTableChoiceOption<TValue extends DataTableChoiceValue = DataTableChoiceValue> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export interface DataTableRemoteOptionPage<TValue extends DataTableChoiceValue> {
  items: DataTableChoiceOption<TValue>[];
  total?: number;
}

export interface DataTableRemoteOptions<TValue extends DataTableChoiceValue> {
  loadOptions(params: {
    keyword: string;
    pageNo: number;
    pageSize: number;
    signal: AbortSignal;
  }): Promise<DataTableRemoteOptionPage<TValue>>;
  resolveOptions?(params: {
    values: readonly TValue[];
    signal: AbortSignal;
  }): Promise<DataTableChoiceOption<TValue>[]>;
  debounceMs?: number;
  pageSize?: number;
}

export type DataTableEditableChoiceType = 'enum' | 'select' | 'remoteSelect';
