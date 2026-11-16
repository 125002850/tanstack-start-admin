// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { collectAppRouteMenuKeys, extractDefineRouteMetaMenuKeys } from '../../../vite.sso-mock';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTemporaryRoutesRoot() {
  const root = mkdtempSync(join(tmpdir(), 'oig-vite-sso-mock-'));
  temporaryRoots.push(root);
  return root;
}

describe('Vite SSO mock route menu discovery', () => {
  it('extracts literal nav menu keys only from imported defineRouteMeta calls', () => {
    const source = `
      import { defineRouteMeta as defineMeta } from '@/lib/router/app-route-meta';

      const ignored = { nav: { menuKey: 'not-a-route' } };
      const first = defineMeta({ nav: { menuKey: 'beta' } });
      const second = defineMeta({ nav: { menuKey: \`alpha\` } });
      // defineMeta({ nav: { menuKey: 'commented-out' } });
    `;

    expect(extractDefineRouteMetaMenuKeys(source)).toEqual(['alpha', 'beta']);
  });

  it('rejects dynamic menu keys that cannot be granted safely by the local mock', () => {
    const source = `
      import { defineRouteMeta } from '@/lib/router/app-route-meta';

      const permission = 'dynamic';
      defineRouteMeta({ nav: { menuKey: permission } });
    `;

    expect(() => extractDefineRouteMetaMenuKeys(source, 'dynamic-route.tsx')).toThrow(
      'dynamic-route.tsx: defineRouteMeta nav.menuKey must be a non-empty string literal'
    );
  });

  it('recursively collects, deduplicates, and sorts route menu keys', () => {
    const routesRoot = createTemporaryRoutesRoot();
    const nestedRoot = join(routesRoot, 'nested');
    mkdirSync(nestedRoot);
    writeFileSync(
      join(routesRoot, 'first.tsx'),
      `
        import { defineRouteMeta } from '@/lib/router/app-route-meta';
        defineRouteMeta({ nav: { menuKey: 'zeta' } });
      `
    );
    writeFileSync(
      join(nestedRoot, 'second.ts'),
      `
        import { defineRouteMeta } from '@/lib/router/app-route-meta';
        defineRouteMeta({ nav: { menuKey: 'alpha' } });
        defineRouteMeta({ nav: { menuKey: 'zeta' } });
      `
    );
    writeFileSync(join(nestedRoot, 'ignored.js'), "menuKey: 'ignored'");

    expect(collectAppRouteMenuKeys(routesRoot)).toEqual(['alpha', 'zeta']);
  });
});
