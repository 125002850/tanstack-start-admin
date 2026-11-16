import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiErrorPresentation, showApiError, apiErrorDetailsStore } from './error-notification';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: notify } }));

describe('API error presentation', () => {
  beforeEach(() => apiErrorDetailsStore.setState({ error: null }));

  it('keeps short public errors and suppresses aborted requests', () => {
    expect(
      getApiErrorPresentation({ causeBody: { code: 3001001, msg: '名称重复' } })?.summary
    ).toBe('名称重复');
    expect(getApiErrorPresentation({ name: 'AbortError' })).toBeNull();
  });

  it('keeps bounded long details behind a short summary and hides URLs', () => {
    showApiError({
      causeBody: {
        code: 3001001,
        msg: `校验失败\n${'字段'.repeat(3000)} https://private.test/token`
      }
    });
    const [, options] = notify.mock.lastCall!;
    expect(options.action.label).toBe('查看详情');
    options.action.onClick();
    expect(apiErrorDetailsStore.getState().error?.message.length).toBeLessThanOrEqual(4096);
    expect(apiErrorDetailsStore.getState().error?.message).not.toContain('https://');
  });
});
