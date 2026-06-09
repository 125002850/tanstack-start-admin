import { describe, it, expect } from 'vitest';

const routeModules = import.meta.glob('/src/routes/dashboard/**/*.tsx', {
  eager: true
});

function extractRoutePath(filePath: string): string {
  let path = filePath.replace('/src/routes/dashboard/', '/dashboard/').replace('.tsx', '');

  if (path.endsWith('/index')) {
    path = path.replace(/\/index$/, '/');
  }

  return path;
}

function getKeepAlive(mod: unknown): boolean | undefined {
  const route = (mod as Record<string, unknown>)?.Route as
    | { options?: { staticData?: { workspace?: { keepAlive?: boolean } } } }
    | undefined;
  return route?.options?.staticData?.workspace?.keepAlive;
}

function getTagEnabled(mod: unknown): boolean | undefined {
  const route = (mod as Record<string, unknown>)?.Route as
    | { options?: { staticData?: { workspace?: { tagEnabled?: boolean } } } }
    | undefined;
  return route?.options?.staticData?.workspace?.tagEnabled;
}

function getNav(mod: unknown):
  | {
      kind?: string;
      linkable?: boolean;
      parentId?: string;
    }
  | undefined {
  const route = (mod as Record<string, unknown>)?.Route as
    | {
        options?: {
          staticData?: {
            nav?: {
              kind?: string;
              linkable?: boolean;
              parentId?: string;
            };
          };
        };
      }
    | undefined;
  return route?.options?.staticData?.nav;
}

const allPaths = Object.keys(routeModules);

// Routes that explicitly opt out of keepAlive (keepAlive=false) with documented reasons:
// - forms/index: 重定向路由，无实际页面内容
// - system-management/index: 重定向路由，无实际页面内容
// - dashboard/index: 重定向路由，无实际页面内容
const keepAliveFalsePaths = new Set([
  '/src/routes/dashboard/system-management/index.tsx',
  '/src/routes/dashboard/forms/index.tsx',
  '/src/routes/dashboard/index.tsx'
]);

describe('dashboard route inventory', () => {
  it('discovers at least the known set of dashboard sub-routes', () => {
    const routePaths = allPaths.map(extractRoutePath).toSorted();
    expect(routePaths).toEqual(
      expect.arrayContaining([
        '/dashboard/',
        '/dashboard/overview',
        '/dashboard/chat',
        '/dashboard/users',
        '/dashboard/kanban',
        '/dashboard/notifications',
        '/dashboard/react-query',
        '/dashboard/system-management/',
        '/dashboard/system-management/dictionaries',
        '/dashboard/forms/',
        '/dashboard/forms/basic',
        '/dashboard/forms/multi-step',
        '/dashboard/forms/sheet-form',
        '/dashboard/forms/advanced',
        '/dashboard/elements/icons',
        '/dashboard/product/',
        '/dashboard/product/$productId'
      ])
    );
  });

  it('only explicitly opt-out routes have keepAlive=false', () => {
    for (const filePath of allPaths) {
      const routePath = extractRoutePath(filePath);
      const keepAlive = getKeepAlive(routeModules[filePath]);

      if (keepAliveFalsePaths.has(filePath)) {
        expect(
          keepAlive,
          `${routePath} must explicitly set keepAlive: false, got ${keepAlive}`
        ).toBe(false);
      } else {
        expect(
          keepAlive,
          `${routePath} should default to keepAlive (keepAlive !== false), got ${keepAlive}`
        ).not.toBe(false);
      }
    }
  });

  it('every discovered route has a staticData with a label', () => {
    for (const filePath of allPaths) {
      const mod = routeModules[filePath] as {
        Route?: { options?: { staticData?: { label?: string } } };
      };
      const label = mod?.Route?.options?.staticData?.label;
      expect(label, `${extractRoutePath(filePath)} missing label`).toBeTruthy();
    }
  });

  it('system-management dictionaries route participates in workspace tabs', () => {
    const dictionariesRoute = routeModules['/src/routes/dashboard/system-management/dictionaries.tsx'];
    expect(dictionariesRoute).toBeDefined();
    expect(getTagEnabled(dictionariesRoute)).not.toBe(false);
    expect(getNav(dictionariesRoute)?.parentId).toBe('/dashboard/system-management');
  });

  it('system-management route is a non-linkable container menu', () => {
    const systemManagementRoute = routeModules['/src/routes/dashboard/system-management/index.tsx'];
    expect(systemManagementRoute).toBeDefined();
    expect(getKeepAlive(systemManagementRoute)).toBe(false);
    expect(getTagEnabled(systemManagementRoute)).toBe(false);
    expect(getNav(systemManagementRoute)).toMatchObject({
      kind: 'container',
      linkable: false
    });
  });
});
