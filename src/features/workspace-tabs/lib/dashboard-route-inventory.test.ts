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
      isContainer?: true;
      menuKey?: string;
      icon?: string;
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
              isContainer?: true;
              menuKey?: string;
              icon?: string;
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
// - basic-settings/index: 重定向路由，无实际页面内容
// - system-management/index: 重定向路由，无实际页面内容
// - log-management/index: 重定向路由，无实际页面内容
// - dashboard/index: 重定向路由，无实际页面内容
// - account/profile, account/password: 账号功能迁入侧边栏 Sheet，路由仅保留兼容重定向
const keepAliveFalsePaths = new Set([
  '/src/routes/dashboard/basic-settings/index.tsx',
  '/src/routes/dashboard/system-management/index.tsx',
  '/src/routes/dashboard/log-management/index.tsx',
  '/src/routes/dashboard/forms/index.tsx',
  '/src/routes/dashboard/index.tsx',
  '/src/routes/dashboard/account/profile.tsx',
  '/src/routes/dashboard/account/password.tsx'
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
  '/src/routes/dashboard/basic-settings/staff.tsx',
  '/src/routes/dashboard/basic-settings/dept.tsx',
  '/src/routes/dashboard/basic-settings/role.tsx',
  '/src/routes/dashboard/basic-settings/menu.tsx',
  '/src/routes/dashboard/log-management/login.tsx',
  '/src/routes/dashboard/log-management/operation.tsx'
]);

const accountOverlayRedirectRoutePaths = new Set([
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
        '/dashboard/basic-settings/',
        '/dashboard/basic-settings/staff',
        '/dashboard/basic-settings/dept',
        '/dashboard/basic-settings/role',
        '/dashboard/basic-settings/menu',
        '/dashboard/log-management/',
        '/dashboard/log-management/login',
        '/dashboard/log-management/operation',
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

  it('every discovered route has a staticData with a label or menuKey', () => {
    for (const filePath of allPaths) {
      const mod = routeModules[filePath] as {
        Route?: {
          options?: {
            staticData?: {
              label?: string;
              title?: string;
              nav?: { menuKey?: string };
            };
          };
        };
      };
      const staticData = mod?.Route?.options?.staticData;
      const identity = staticData?.label ?? staticData?.title ?? staticData?.nav?.menuKey;
      expect(identity, `${extractRoutePath(filePath)} missing identifying metadata`).toBeTruthy();
    }
  });

  it('system-management dictionaries route participates in workspace tabs', () => {
    const dictionariesRoute =
      routeModules['/src/routes/dashboard/system-management/dictionaries.tsx'];
    expect(dictionariesRoute).toBeDefined();
    expect(getTagEnabled(dictionariesRoute)).not.toBe(false);
    expect(getNav(dictionariesRoute)?.menuKey).toBe('mdm_dict');
    expect(getNav(dictionariesRoute)?.parentId).toBeUndefined();
  });

  it('redirect group roots are hidden from navigation', () => {
    const routeFiles = [
      '/src/routes/dashboard/basic-settings/index.tsx',
      '/src/routes/dashboard/system-management/index.tsx',
      '/src/routes/dashboard/log-management/index.tsx'
    ];

    for (const routeFile of routeFiles) {
      const route = routeModules[routeFile];
      expect(route).toBeDefined();
      expect(getKeepAlive(route)).toBe(false);
      expect(getTagEnabled(route)).toBe(false);
      expect(getNav(route)?.isContainer).toBe(true);
    }
  });

  it('account overlay redirect routes are hidden from navigation and workspace tabs', () => {
    for (const routeFile of accountOverlayRedirectRoutePaths) {
      const route = routeModules[routeFile];
      expect(route, `${extractRoutePath(routeFile)} route missing`).toBeDefined();
      expect(getKeepAlive(route)).toBe(false);
      expect(getTagEnabled(route)).toBe(false);
      expect(getNav(route)).toMatchObject({
        visible: false,
        group: 'account'
      });
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
      ['/src/routes/dashboard/system-management/dictionaries.tsx', 'mdm_dict'],
      ['/src/routes/dashboard/system-management/export-center.tsx', 'export_center']
    ] as const;

    for (const [routeFile, menuKey] of expectations) {
      const nav = getNav(routeModules[routeFile]);
      expect(nav).toMatchObject({ menuKey });
      expect(nav?.isContainer).toBeUndefined();
      expect(nav?.parentId).toBeUndefined();
    }
  });

  it('management routes keep titles, groups and menu keys aligned with the target menu tree', () => {
    const expectations = [
      [
        '/src/routes/dashboard/basic-settings/staff.tsx',
        '基础设置：员工管理',
        'basicSettings',
        'iam_staff'
      ],
      [
        '/src/routes/dashboard/basic-settings/dept.tsx',
        '基础设置：部门管理',
        'basicSettings',
        'iam_dept'
      ],
      [
        '/src/routes/dashboard/basic-settings/role.tsx',
        '基础设置：角色管理',
        'basicSettings',
        'iam_role'
      ],
      [
        '/src/routes/dashboard/basic-settings/menu.tsx',
        '基础设置：菜单管理',
        'basicSettings',
        'iam_menu'
      ],
      [
        '/src/routes/dashboard/system-management/dictionaries.tsx',
        '系统管理：字典管理',
        'systemManagement',
        'mdm_dict'
      ],
      [
        '/src/routes/dashboard/system-management/export-center.tsx',
        '系统管理：导出中心',
        'systemManagement',
        'export_center'
      ],
      [
        '/src/routes/dashboard/log-management/login.tsx',
        '日志管理：登录日志',
        'logManagement',
        'iam_login_log'
      ],
      [
        '/src/routes/dashboard/log-management/operation.tsx',
        '日志管理：操作日志',
        'logManagement',
        'iam_operation_log'
      ]
    ] as const;

    for (const [routeFile, title, group, menuKey] of expectations) {
      const route = routeModules[routeFile];
      expect(route, `${routeFile} route missing`).toBeDefined();
      expect(getTitle(route)).toBe(title);
      expect(getNav(route)?.group).toBe(group);
      expect(getNav(route)?.menuKey).toBe(menuKey);
    }
  });

  it('uses domain-specific icons for department and role management', () => {
    expect(getNav(routeModules['/src/routes/dashboard/basic-settings/dept.tsx'])?.icon).toBe(
      'department'
    );
    expect(getNav(routeModules['/src/routes/dashboard/basic-settings/role.tsx'])?.icon).toBe(
      'role'
    );
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
