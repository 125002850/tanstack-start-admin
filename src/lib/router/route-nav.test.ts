import { describe, expect, it } from 'vitest';

import { buildNavGroupsFromRoutes } from './route-nav';

describe('route nav', () => {
  it('carries route menuKey into nav items', () => {
    const groups = buildNavGroupsFromRoutes({
      dictionaries: {
        id: '/dashboard/system-management/dictionaries',
        fullPath: '/dashboard/system-management/dictionaries',
        options: {
          staticData: {
            label: '字典管理',
            nav: {
              visible: true,
              group: 'systemManagement',
              order: 10,
              menuKey: 'dict-management'
            }
          }
        }
      }
    });

    expect(groups[0]?.items[0]?.menuKey).toBe('dict-management');
  });
});
