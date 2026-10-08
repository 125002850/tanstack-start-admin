import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
const ensureLogin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/sso/queries', () => ({ ensureSsoLoginInfo: ensureLogin }));
import { defineRouteMeta } from './app-route-meta';
import { RouteAccessForbiddenError } from './route-access';

describe('功能开关路由守卫', () => {
  it('关闭时隐藏菜单并拒绝直达路由，不请求登录信息', () => {
    const route = defineRouteMeta({
      label: '示例',
      feature: { key: 'example', enabled: false },
      nav: { visible: true, group: 'examples', order: 1, menuKey: 'example-menu' }
    });
    expect(route.staticData.nav?.visible).toBe(false);
    expect(() => route.beforeLoad?.({ context: { queryClient: {} as QueryClient } })).toThrow(
      RouteAccessForbiddenError
    );
    expect(ensureLogin).not.toHaveBeenCalled();
  });
  it('开启后仍校验原有菜单权限', async () => {
    ensureLogin.mockResolvedValue({ menuData: [] });
    const route = defineRouteMeta({
      label: '示例',
      feature: { key: 'example', enabled: true },
      nav: { visible: true, group: 'examples', order: 1, menuKey: 'example-menu' }
    });
    expect(route.staticData.nav?.visible).toBe(true);
    await expect(
      route.beforeLoad?.({ context: { queryClient: {} as QueryClient } })
    ).rejects.toMatchObject({ status: 403, menuKey: 'example-menu' });
  });
});
