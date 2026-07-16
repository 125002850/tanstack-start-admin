import { describe, expect, it } from 'vitest';

import { defineRouteMeta } from './app-route-meta';

describe('app route meta', () => {
  it('adds a route access guard when nav metadata declares a menu key', () => {
    const meta = defineRouteMeta({
      label: '字典管理',
      nav: {
        visible: true,
        group: 'systemManagement',
        order: 10,
        menuKey: 'dict-management'
      }
    });

    expect(meta).toHaveProperty('beforeLoad');
    expect(meta.beforeLoad).toBeTypeOf('function');
  });

  it('keeps routes without a menu key unrestricted', () => {
    const meta = defineRouteMeta({
      label: '概览',
      nav: {
        visible: true,
        group: 'overview',
        order: 10
      }
    });

    expect(meta).not.toHaveProperty('beforeLoad');
  });
});
