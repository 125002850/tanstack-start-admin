import { describe, it, expect } from 'vitest';

const routeModules = import.meta.glob('/src/routes/dashboard/**/*.tsx', {
  eager: true
});
const routeSources = import.meta.glob<string>('/src/routes/dashboard/**/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default'
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

function getClosable(mod: unknown): boolean | undefined {
  const route = (mod as Record<string, unknown>)?.Route as
    | { options?: { staticData?: { workspace?: { closable?: boolean } } } }
    | undefined;
  return route?.options?.staticData?.workspace?.closable;
}

function getTitle(mod: unknown): string | undefined {
  const route = (mod as Record<string, unknown>)?.Route as
    | { options?: { staticData?: { title?: string } } }
    | undefined;
  return route?.options?.staticData?.title;
}

function getNav(mod: unknown):
  | {
      visible?: boolean;
      group?: string;
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
              visible?: boolean;
              group?: string;
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
// - iam/index: 重定向路由，无实际页面内容
// - dashboard/index: 重定向路由，无实际页面内容
const keepAliveFalsePaths = new Set([
  '/src/routes/dashboard/system-management/index.tsx',
  '/src/routes/dashboard/iam/index.tsx',
  '/src/routes/dashboard/forms/index.tsx',
  '/src/routes/dashboard/index.tsx'
]);

const standardWorkspacePageRoutePaths = new Set([
  '/src/routes/dashboard/overview.tsx',
  '/src/routes/dashboard/kanban.tsx',
  '/src/routes/dashboard/notifications.tsx',
  '/src/routes/dashboard/elements/icons.tsx',
  '/src/routes/dashboard/forms/basic.tsx',
  '/src/routes/dashboard/forms/multi-step.tsx',
  '/src/routes/dashboard/forms/sheet-form.tsx',
  '/src/routes/dashboard/forms/advanced.tsx',
  '/src/routes/dashboard/forms/overlay-contract.tsx',
  '/src/routes/dashboard/system-management/dictionaries.tsx',
  '/src/routes/dashboard/system-management/export-center.tsx',
  '/src/routes/dashboard/iam/staff.tsx',
  '/src/routes/dashboard/iam/dept.tsx',
  '/src/routes/dashboard/iam/role.tsx',
  '/src/routes/dashboard/iam/menu.tsx',
  '/src/routes/dashboard/iam/log/login.tsx',
  '/src/routes/dashboard/iam/log/operation.tsx',
  '/src/routes/dashboard/account/profile.tsx',
  '/src/routes/dashboard/account/password.tsx'
]);

// Hidden development/demo routes remain addressable for deep links and local UI checks,
// but they must not become visible business navigation or KBar entries.
const hiddenDevelopmentDemoRoutePaths = new Set([
  '/src/routes/dashboard/chat.tsx',
  '/src/routes/dashboard/kanban.tsx',
  '/src/routes/dashboard/notifications.tsx',
  '/src/routes/dashboard/elements/icons.tsx',
  '/src/routes/dashboard/forms/basic.tsx',
  '/src/routes/dashboard/forms/multi-step.tsx',
  '/src/routes/dashboard/forms/sheet-form.tsx',
  '/src/routes/dashboard/forms/advanced.tsx',
  '/src/routes/dashboard/forms/overlay-contract.tsx'
]);

function normalizeSource(source: string): string {
  return source.replace(/\s+/g, ' ');
}

describe('dashboard route inventory', () => {
  it('discovers at least the known set of dashboard sub-routes', () => {
    const routePaths = allPaths.map(extractRoutePath).toSorted();
    expect(routePaths).toEqual(
      expect.arrayContaining([
        '/dashboard/',
        '/dashboard/overview',
        '/dashboard/chat',
        '/dashboard/kanban',
        '/dashboard/notifications',
        '/dashboard/elements/icons',
        '/dashboard/system-management/',
        '/dashboard/system-management/dictionaries',
        '/dashboard/system-management/export-center',
        '/dashboard/iam/',
        '/dashboard/iam/staff',
        '/dashboard/iam/dept',
        '/dashboard/iam/role',
        '/dashboard/iam/menu',
        '/dashboard/iam/log/login',
        '/dashboard/iam/log/operation',
        '/dashboard/account/profile',
        '/dashboard/account/password',
        '/dashboard/forms/',
        '/dashboard/forms/basic',
        '/dashboard/forms/multi-step',
        '/dashboard/forms/sheet-form',
        '/dashboard/forms/advanced',
        '/dashboard/forms/overlay-contract'
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
    const dictionariesRoute =
      routeModules['/src/routes/dashboard/system-management/dictionaries.tsx'];
    expect(dictionariesRoute).toBeDefined();
    expect(getTagEnabled(dictionariesRoute)).not.toBe(false);
    expect(getNav(dictionariesRoute)).toMatchObject({
      visible: true,
      group: 'systemManagement'
    });
    expect(getNav(dictionariesRoute)?.parentId).toBeUndefined();
  });

  it('redirect group roots are hidden from navigation', () => {
    const routeFiles = ['/src/routes/dashboard/system-management/index.tsx'];

    for (const routeFile of routeFiles) {
      const route = routeModules[routeFile];
      expect(route).toBeDefined();
      expect(getKeepAlive(route)).toBe(false);
      expect(getTagEnabled(route)).toBe(false);
      expect(getNav(route)?.visible).toBe(false);
    }
  });

  it('documents hidden development/demo routes as non-business surfaces', () => {
    for (const routeFile of hiddenDevelopmentDemoRoutePaths) {
      const route = routeModules[routeFile];
      expect(route, `${extractRoutePath(routeFile)} route missing`).toBeDefined();
      expect(
        getTitle(route),
        `${extractRoutePath(routeFile)} should use demo-specific title`
      ).toMatch(/^开发示例：/);
      expect(getNav(route), `${extractRoutePath(routeFile)} nav missing`).toMatchObject({
        visible: false,
        group: 'components'
      });
    }
  });

  it('system management routes are top-level items in their group', () => {
    const expectations = [
      ['/src/routes/dashboard/system-management/dictionaries.tsx', 'systemManagement'],
      ['/src/routes/dashboard/system-management/export-center.tsx', 'systemManagement']
    ] as const;

    for (const [routeFile, group] of expectations) {
      const nav = getNav(routeModules[routeFile]);
      expect(nav).toMatchObject({
        visible: true,
        group
      });
      expect(nav?.parentId).toBeUndefined();
    }
  });

  it('standard workspace pages use WorkspacePageRoute for container and disabled-mode rendering', () => {
    for (const filePath of standardWorkspacePageRoutePaths) {
      const routePath = extractRoutePath(filePath);
      expect(routeSources[filePath], `${routePath} route source missing`).toBeDefined();
      const normalizedSource = normalizeSource(routeSources[filePath]);

      expect(normalizedSource, `${routePath} must use WorkspacePageRoute`).toContain(
        'WorkspacePageRoute'
      );
      expect(
        normalizedSource,
        `${routePath} should not hand-roll WorkspacePageBoundary container routing`
      ).not.toContain('<WorkspacePageBoundary');
    }
  });

  it('workspace route components keep lifecycle flags in route metadata', () => {
    for (const [filePath, source] of Object.entries(routeSources)) {
      const normalizedSource = normalizeSource(source);
      if (
        !normalizedSource.includes('WorkspacePageBoundary') &&
        !normalizedSource.includes('WorkspacePageRoute')
      ) {
        continue;
      }

      expect(
        normalizedSource,
        `${extractRoutePath(filePath)} must not pass keepAlive/closable to workspace route components`
      ).not.toMatch(/<WorkspacePage(?:Boundary|Route)\b[^>]*(?:keepAlive|closable)=/);
    }

    expect(getClosable(routeModules['/src/routes/dashboard/overview.tsx'])).toBe(false);
  });

  it('dashboard workspace route components derive tabId from the current route path', () => {
    for (const [filePath, source] of Object.entries(routeSources)) {
      const normalizedSource = normalizeSource(source);
      if (
        !normalizedSource.includes('WorkspacePageBoundary') &&
        !normalizedSource.includes('WorkspacePageRoute')
      ) {
        continue;
      }

      expect(
        normalizedSource,
        `${extractRoutePath(filePath)} should use the implicit current-route tabId`
      ).not.toMatch(/<WorkspacePage(?:Boundary|Route)\b[^>]*\btabId=/);
    }
  });

  it('dashboard routes no longer hand-roll PageContainer-only Screen wrappers', () => {
    for (const [filePath, source] of Object.entries(routeSources)) {
      const normalizedSource = normalizeSource(source);
      expect(
        normalizedSource,
        `${extractRoutePath(filePath)} should use WorkspacePageRoute instead of route-local Screen render wrappers`
      ).not.toMatch(/render=\{\(\) => <[A-Z][A-Za-z0-9]*Screen\b/);
    }
  });

  it('dictionaries route uses WorkspacePageRoute with the management page body', () => {
    const source = routeSources['/src/routes/dashboard/system-management/dictionaries.tsx'];
    expect(source).toBeDefined();

    const normalizedSource = normalizeSource(source);
    expect(normalizedSource).toContain('WorkspacePageRoute');
    expect(normalizedSource).toContain('render={() => <DictionaryManagementPage />}');
    expect(normalizedSource).not.toContain('DictionaryManagementScreen');
  });

  it('export center route uses WorkspacePageRoute with the management page body', () => {
    const source = routeSources['/src/routes/dashboard/system-management/export-center.tsx'];
    expect(source).toBeDefined();

    const normalizedSource = normalizeSource(source);
    expect(normalizedSource).toContain('WorkspacePageRoute');
    expect(normalizedSource).toContain('render={() => <ExportCenterManagementPage />}');
    expect(normalizedSource).not.toContain('ExportCenterScreen');
  });
});
