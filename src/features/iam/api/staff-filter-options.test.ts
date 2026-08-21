import { beforeEach, describe, expect, it, vi } from 'vitest';

import { iamStaffPage } from '@/lib/api/clients/service';
import { createIamStaffRemoteFilterOptions, toStaffFilterOption } from './staff-filter-options';

vi.mock('@/lib/api/clients/service', () => ({
  iamStaffPage: vi.fn()
}));

describe('IAM staff remote filter options', () => {
  beforeEach(() => {
    vi.mocked(iamStaffPage).mockReset();
  });

  it('formats a stable employee label and supports different value contracts', () => {
    const staff = {
      staffId: 7,
      staffCode: 'E007',
      username: 'zhangsan',
      staffName: '张三'
    };

    expect(toStaffFilterOption(staff)).toMatchObject({ value: 'E007', label: '张三（E007）' });
    expect(toStaffFilterOption(staff, 'staffId')).toMatchObject({ value: '7' });
    expect(toStaffFilterOption(staff, 'username')).toMatchObject({ value: 'zhangsan' });
  });

  it('forwards pagination, keyword and AbortSignal to the staff page API', async () => {
    vi.mocked(iamStaffPage).mockResolvedValue({
      total: 1,
      list: [{ staffId: 7, staffCode: 'E007', username: 'zhangsan', staffName: '张三' }]
    });
    const signal = new AbortController().signal;
    const remoteOptions = createIamStaffRemoteFilterOptions();

    await expect(
      remoteOptions.loadOptions({ keyword: '张三', pageNo: 2, pageSize: 20, signal })
    ).resolves.toMatchObject({
      total: 1,
      items: [{ value: 'E007', label: '张三（E007）' }]
    });
    expect(iamStaffPage).toHaveBeenCalledWith(
      { pageNo: 2, pageSize: 20, keyword: '张三' },
      { signal }
    );
  });
});
