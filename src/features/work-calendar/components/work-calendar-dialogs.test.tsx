import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const downloadMocks = vi.hoisted(() => ({
  downloadTextFile: vi.fn()
}));

vi.mock('@/lib/browser/download-text-file', () => ({
  downloadTextFile: downloadMocks.downloadTextFile
}));

import { ImportJsonDialog } from './work-calendar-dialogs';

describe('ImportJsonDialog', () => {
  afterEach(() => {
    cleanup();
    downloadMocks.downloadTextFile.mockReset();
  });

  it('downloads an importable JSON template for the selected year', async () => {
    const user = userEvent.setup();
    render(
      <ImportJsonDialog
        open
        pending={false}
        year={2026}
        onOpenChange={vi.fn()}
        onImport={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '导出模版' }));

    expect(downloadMocks.downloadTextFile).toHaveBeenCalledOnce();
    const [content, fileName, mimeType] = downloadMocks.downloadTextFile.mock.calls[0]!;
    expect(fileName).toBe('work-calendar-2026-import-template.json');
    expect(mimeType).toBe('application/json;charset=utf-8');
    expect(JSON.parse(content)).toEqual({
      schemaVersion: 1,
      year: 2026,
      source: '导入模版示例，请修改后使用',
      dateOverrides: [
        {
          date: '2026-01-01',
          type: 'public_holiday',
          name: '示例：法定节假日',
          sourceNote: '示例：请填写节假日来源'
        },
        {
          date: '2026-01-04',
          type: 'adjusted_workday',
          name: '示例：调休工作日',
          customPeriods: [
            { start: '09:00', end: '12:00' },
            { start: '13:30', end: '18:00' }
          ],
          sourceNote: '示例：请填写调休安排来源'
        },
        {
          date: '2026-12-31',
          type: 'other_non_working_day',
          name: '示例：其他非工作日',
          sourceNote: '示例：请填写安排依据'
        }
      ]
    });
  });
});
