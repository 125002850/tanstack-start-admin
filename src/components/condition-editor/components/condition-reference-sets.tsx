import { createContext, useContext, type ReactNode } from 'react';
import type { ConditionFieldType } from '../model/condition-model';

export interface ConditionReferenceSet {
  readonly code: string;
  readonly label: string;
  readonly fieldType: ConditionFieldType;
}

const ReferenceSetsContext = createContext<readonly ConditionReferenceSet[]>([]);

/** 集合目录由使用方加载；共享编辑器不绑定业务 API 或认证方式。 */
export function ConditionReferenceSetsProvider({
  items,
  children
}: {
  items: readonly ConditionReferenceSet[];
  children: ReactNode;
}) {
  return <ReferenceSetsContext value={items}>{children}</ReferenceSetsContext>;
}

export function useConditionReferenceSets() {
  return useContext(ReferenceSetsContext);
}
