import type {
  DataTableFilterOption,
  DataTableRemoteFilterOptions,
  DataTableRemoteFilterPage
} from '@/types/data-table';
import { iamStaffPage, type StaffRspDTO } from '@/lib/api/clients/service';

type StaffFilterValueField = 'staffId' | 'staffCode' | 'username';

interface IamStaffRemoteFilterConfig {
  valueField?: StaffFilterValueField;
}

function staffFilterValue(staff: StaffRspDTO, field: StaffFilterValueField) {
  const value = staff[field];
  if (typeof value === 'number') return String(value);
  return value?.trim() || null;
}

export function toStaffFilterOption(
  staff: StaffRspDTO,
  valueField: StaffFilterValueField = 'staffCode'
): DataTableFilterOption | null {
  const value = staffFilterValue(staff, valueField);
  if (!value) return null;

  const primaryLabel = staff.staffName?.trim() || staff.username?.trim() || value;
  const staffCode = staff.staffCode?.trim();
  return {
    value,
    label:
      staffCode && staffCode !== primaryLabel ? `${primaryLabel}（${staffCode}）` : primaryLabel,
    keywords: [staff.username, staff.staffName, staff.staffCode, staff.phone].filter(
      (keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0
    )
  };
}

/**
 * IAM 员工远程筛选数据源。默认以工号作为筛选值，也可按目标接口契约切换为员工 ID 或用户名。
 */
export function createIamStaffRemoteFilterOptions({
  valueField = 'staffCode'
}: IamStaffRemoteFilterConfig = {}): DataTableRemoteFilterOptions {
  return {
    pageSize: 20,
    labels: {
      searchPlaceholder: '搜索姓名 / 工号 / 用户名 / 手机号',
      emptyText: '未找到匹配员工'
    },
    loadOptions: async ({
      keyword,
      pageNo,
      pageSize,
      signal
    }): Promise<DataTableRemoteFilterPage> => {
      const page = await iamStaffPage(
        { pageNo, pageSize, keyword: keyword || undefined },
        { signal }
      );
      return {
        total: page?.total ?? 0,
        items: (page?.list ?? []).flatMap((staff) => {
          const option = toStaffFilterOption(staff, valueField);
          return option ? [option] : [];
        })
      };
    }
  };
}
