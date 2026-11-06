import { describe, expect, it } from 'vitest';
import {
  executionDuration,
  executionPollInterval,
  executionStatusLabel,
  executionStatusVariant
} from './execution';

describe('执行状态与刷新边界', () => {
  it('刚触发但尚未创建记录时保持快速刷新，之后恢复低频', () => {
    expect(executionPollInterval([], 1000, 1001)).toBe(3000);
    expect(executionPollInterval([], 1000, 31000)).toBe(15000);
    expect(executionPollInterval([{ status: 'running' }], 1000, 61000)).toBe(3000);
    expect(executionPollInterval([{ status: 'success' }], 1000, 61000)).toBe(15000);
  });
  it('展示运行和结束时长，未知状态不误报成功', () => {
    expect(executionDuration({ status: 'running', durationMillis: 61000 })).toBe(
      '已运行 1 分 1 秒'
    );
    expect(executionDuration({ status: 'success', durationMillis: 999 })).toBe('耗时 0 秒');
    expect(executionDuration({ status: 'failed' })).toBe('—');
    expect(executionStatusLabel('interrupted')).toBe('interrupted');
    expect(executionStatusVariant('interrupted')).toBe('outline');
  });
});
