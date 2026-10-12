import type { DataTableDslCondition } from '@/hooks/use-data-table';
import type {
  DataTableDslConditionType,
  DataTableDslOperator,
  Option
} from '@/components/data-table/filters/types';
import type { QuerySceneLimitsRspDTO } from '@/lib/api/clients/service';

export interface DataTableAdvancedSearchField {
  columnId: string;
  field: string;
  label: string;
  conditionType: DataTableDslConditionType;
  operators: DataTableDslOperator[];
  options: Option[];
  dateMode: 'date' | 'dateTime';
}

export interface DataTableQueryScheme {
  id: number;
  sceneCode: string;
  schemeName: string;
  contentJson: string;
  schemaVersion: number;
  defaultScheme: boolean;
  version: number;
}

export interface DataTableAdvancedSearchRuntime {
  sceneCode: string;
  fields: DataTableAdvancedSearchField[];
  limits?: QuerySceneLimitsRspDTO;
  condition?: DataTableDslCondition;
  conditionCount: number;
  summary: string;
  applyCondition: (condition?: DataTableDslCondition) => boolean | void;
  clearAll: () => void;
  schemes: DataTableQueryScheme[];
  selectedSchemeId?: number;
  dirty: boolean;
  loadingSchemes: boolean;
  mutatingScheme: boolean;
  applyScheme: (schemeId?: number) => void;
  saveAs: (schemeName: string, defaultScheme: boolean) => Promise<void>;
  overwriteSelected: () => Promise<void>;
  renameSelected: (schemeName: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  setSelectedAsDefault: (enabled: boolean) => Promise<void>;
}

export interface DataTableAdvancedSearchConfig {
  field?: string;
  conditionType: DataTableDslConditionType;
  operators?: readonly DataTableDslOperator[];
}
