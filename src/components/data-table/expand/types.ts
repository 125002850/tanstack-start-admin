import type { ReactNode } from 'react';

export type ExpandRowKeyField<TData> = Extract<
  {
    [K in keyof TData]-?: TData[K] extends string | number ? K : never;
  }[keyof TData],
  string
>;

export interface ExpandTab<TData, TId extends string = string> {
  id: TId;
  label: string;
  icon?: ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  render: (row: TData) => ReactNode;
}

export interface ExpandTableSizing {
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface ExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  TTabs extends readonly ExpandTab<TData, string>[]
> {
  rowKey: TKey;
  tabs: TTabs;
  defaultTab?: TTabs[number]['id'];
  tableSizing?: ExpandTableSizing;
}

export interface ExpandTabEdge<TData> extends Omit<ExpandTab<TData, string>, 'id'> {
  id: string;
}

export interface ExpandConfigEdge<TData> {
  rowKey: keyof TData & string;
  tabs: readonly ExpandTabEdge<TData>[];
  defaultTab?: string;
  tableSizing?: ExpandTableSizing;
}
