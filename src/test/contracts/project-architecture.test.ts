// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = resolve(PROJECT_ROOT, 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function readProjectFile(path: string) {
  return readFileSync(resolve(PROJECT_ROOT, path), 'utf8');
}

function toProjectPath(path: string) {
  return relative(PROJECT_ROOT, path).replaceAll('\\', '/');
}

function collectFiles(root: string, accept: (path: string) => boolean): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(path, accept));
      continue;
    }

    if (entry.isFile() && accept(path)) {
      files.push(path);
    }
  }

  return files.toSorted();
}

function collectSourceFiles(root = SRC_ROOT) {
  return collectFiles(root, (path) => SOURCE_EXTENSIONS.has(extname(path)));
}

function normalizeSource(source: string) {
  return source.replace(/\s+/g, ' ');
}

function collectModuleSpecifiers(source: string): string[] {
  const moduleSpecifiers: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bvi\.mock\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g;

  for (const match of source.matchAll(pattern)) {
    moduleSpecifiers.push(match[2]!);
  }

  return moduleSpecifiers;
}

function isTestFile(path: string) {
  return path.endsWith('.test.ts') || path.endsWith('.test.tsx');
}

describe('project architecture contracts', () => {
  it('does not keep unused page metadata on dashboard routes', () => {
    const violations = collectFiles(resolve(SRC_ROOT, 'routes/dashboard'), (path) =>
      path.endsWith('.tsx')
    )
      .filter((path) => /\bpage\s*:\s*\{/.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('keeps route document metadata free of starter dashboard branding', () => {
    const starterDashboardPattern =
      /TanStack Dashboard|Dashboard Starter|Dashboard with TanStack Start and Shadcn|Dashboard\s*:/;
    const violations = collectFiles(resolve(SRC_ROOT, 'routes'), (path) => path.endsWith('.tsx'))
      .filter((path) => starterDashboardPattern.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('requires workspace Screen routes to provide a disabled-mode render fallback', () => {
    const violations = collectFiles(resolve(SRC_ROOT, 'routes/dashboard'), (path) =>
      path.endsWith('.tsx')
    )
      .filter((path) => {
        const source = normalizeSource(readFileSync(path, 'utf8'));
        return (
          /render=\{\(\) => <[A-Z][A-Za-z0-9]*Screen\b/.test(source) &&
          !source.includes('renderWhenDisabled=')
        );
      })
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('keeps Management pages free of PageContainer ownership', () => {
    const violations = collectFiles(resolve(SRC_ROOT, 'features'), (path) =>
      path.endsWith('management-page.tsx')
    )
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return (
          source.includes('@/components/layout/page-container') || /<PageContainer\b/.test(source)
        );
      })
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('requires feature and route tables to use the shared DataTable runtime', () => {
    const businessSourcePrefixes = ['src/features/', 'src/routes/'];
    const forbiddenTablePatterns = [
      {
        reason: 'imports the Shadcn Table primitives',
        pattern: /from ['"]@\/components\/ui\/table['"]/
      },
      {
        reason: 'calls useReactTable directly',
        pattern: /\buseReactTable\s*\(/
      },
      {
        reason: 'renders a raw or locally defined Table',
        pattern: /<(?:table|Table)(?=[\s>])/
      }
    ];
    const violations = collectSourceFiles()
      .filter((path) => {
        const projectPath = toProjectPath(path);
        return businessSourcePrefixes.some((prefix) => projectPath.startsWith(prefix));
      })
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return forbiddenTablePatterns
          .filter(({ pattern }) => pattern.test(source))
          .map(({ reason }) => ({ path: toProjectPath(path), reason }));
      });

    expect(violations).toEqual([]);
  });

  it('keeps business DataTable imports on the approved public modules', () => {
    const businessPrefixes = ['src/features/', 'src/routes/'];
    const publicModules = new Set([
      '@/components/data-table/core/data-table',
      '@/components/data-table/columns/data-table-column-factory',
      '@/components/data-table/toolbar/data-table-toolbar',
      '@/hooks/use-data-table',
      '@/types/data-table'
    ]);
    const preciseExceptions = new Set([
      // Contract page intentionally exercises the standalone filter overlay.
      'src/features/workspace-tabs/components/workspace-overlay-contract-page.tsx::@/components/data-table/filters/data-table-faceted-filter',
      // Integration test verifies the same overlay survives workspace transitions.
      'src/features/workspace-tabs/components/workspace-routing.integration.test.tsx::@/components/data-table/filters/data-table-faceted-filter',
      // The department integration test replaces this internal panel to isolate table behavior.
      'src/features/iam/components/dept-data-table.test.tsx::@/components/data-table/toolbar/data-table-view-options'
    ]);
    const violations = collectSourceFiles()
      .filter((path) => {
        const projectPath = toProjectPath(path);
        return businessPrefixes.some((prefix) => projectPath.startsWith(prefix));
      })
      .flatMap((path) => {
        const projectPath = toProjectPath(path);
        return collectModuleSpecifiers(readFileSync(path, 'utf8'))
          .filter(
            (specifier) =>
              (specifier.startsWith('@/components/data-table/') ||
                specifier === '@/hooks/use-data-table' ||
                specifier === '@/types/data-table') &&
              !publicModules.has(specifier) &&
              !preciseExceptions.has(`${projectPath}::${specifier}`)
          )
          .map((specifier) => ({ path: projectPath, specifier }));
      });

    expect(violations).toEqual([]);
  });

  it('limits business imports from the DataTable hooks entry by symbol kind', () => {
    const runtimeSymbols = new Set(['useDataTable', 'useDslDataTable']);
    const typeSymbols = new Set([
      'DataTableDslComposeCondition',
      'DataTableDslCondition',
      'DataTableDslDateTimeCondition',
      'DataTableDslPageRequestBase',
      'DataTableDslSortItem',
      'DataTableDslTextCondition',
      'PaginatedResponse',
      'QueryOptionsFactory',
      'QueryStateSubset',
      'RefreshBehavior',
      'RefreshProps',
      'UseDataTableProps',
      'UseDslDataTableProps',
      'UseDslDataTableResult'
    ]);
    const importPattern =
      /import\s+(type\s+)?\{([^;]*?)\}\s+from\s+['"]@\/hooks\/use-data-table['"]/g;
    const violations = collectSourceFiles()
      .filter((path) => {
        const projectPath = toProjectPath(path);
        return projectPath.startsWith('src/features/') || projectPath.startsWith('src/routes/');
      })
      .flatMap((path) => {
        const projectPath = toProjectPath(path);
        const source = readFileSync(path, 'utf8');
        const imports: Array<{ path: string; symbol: string; kind: 'runtime' | 'type' }> = [];

        for (const match of source.matchAll(importPattern)) {
          const declarationIsTypeOnly = Boolean(match[1]);
          for (const rawSpecifier of match[2]!.split(',')) {
            const specifier = rawSpecifier.trim();
            if (!specifier) continue;
            const isTypeOnly = declarationIsTypeOnly || specifier.startsWith('type ');
            const symbol = specifier
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0]!
              .trim();
            const allowed = isTypeOnly ? typeSymbols : runtimeSymbols;
            if (!allowed.has(symbol)) {
              imports.push({ path: projectPath, symbol, kind: isTypeOnly ? 'type' : 'runtime' });
            }
          }
        }

        return imports;
      });

    expect(violations).toEqual([]);
  });

  it('keeps DataTable subsystem dependencies pointing inward', () => {
    const componentTestExceptions = new Set([
      'src/components/data-table/cells/data-table-cell-tooltip.test.tsx::@/features/workspace-tabs/utils/page-overlays'
    ]);
    const componentViolations = collectSourceFiles(
      resolve(SRC_ROOT, 'components/data-table')
    ).flatMap((path) => {
      const projectPath = toProjectPath(path);
      return collectModuleSpecifiers(readFileSync(path, 'utf8'))
        .filter(
          (specifier) =>
            specifier.startsWith('@/features/') &&
            !componentTestExceptions.has(`${projectPath}::${specifier}`)
        )
        .map((specifier) => ({ path: projectPath, specifier }));
    });
    const forbiddenLibImports = new Set([
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@tanstack/react-router'
    ]);
    const libViolations = collectSourceFiles(resolve(SRC_ROOT, 'lib/data-table'))
      .filter((path) => !isTestFile(toProjectPath(path)))
      .flatMap((path) =>
        collectModuleSpecifiers(readFileSync(path, 'utf8'))
          .filter(
            (specifier) =>
              forbiddenLibImports.has(specifier) || specifier.startsWith('@/components/')
          )
          .map((specifier) => ({ path: toProjectPath(path), specifier }))
      );
    const hookViolations = collectSourceFiles(resolve(SRC_ROOT, 'hooks/use-data-table'))
      .filter((path) => !isTestFile(toProjectPath(path)))
      .flatMap((path) =>
        collectModuleSpecifiers(readFileSync(path, 'utf8'))
          .filter((specifier) => specifier.startsWith('@/components/data-table/'))
          .map((specifier) => ({ path: toProjectPath(path), specifier }))
      );
    const sharedTypeImports = collectModuleSpecifiers(readProjectFile('src/types/data-table.ts'));

    expect(componentViolations).toEqual([]);
    expect(libViolations).toEqual([]);
    expect(hookViolations).toEqual([]);
    expect(
      sharedTypeImports.filter(
        (specifier) => specifier.startsWith('@/config/') || specifier.startsWith('@/components/')
      )
    ).toEqual([]);
  });

  it('does not restore removed DataTable compatibility surfaces', () => {
    const productionBusinessFiles = collectSourceFiles()
      .map((path) => ({ path, projectPath: toProjectPath(path) }))
      .filter(
        ({ projectPath }) =>
          (projectPath.startsWith('src/features/') || projectPath.startsWith('src/routes/')) &&
          !isTestFile(projectPath)
      );
    const removedPropPattern =
      /\b(?:statusDeps|enableAdvancedFilter|isProductTableVirtualizationEnabled)\b/;
    const removedPropViolations = productionBusinessFiles
      .filter(({ path }) => removedPropPattern.test(readFileSync(path, 'utf8')))
      .map(({ projectPath }) => projectPath);

    expect(removedPropViolations).toEqual([]);
    expect(existsSync(resolve(SRC_ROOT, 'components/data-table/index.ts'))).toBe(false);
    expect(existsSync(resolve(SRC_ROOT, 'components/data-table/index.tsx'))).toBe(false);
    expect(existsSync(resolve(SRC_ROOT, 'components/data-table.ts'))).toBe(false);
    expect(existsSync(resolve(SRC_ROOT, 'components/data-table.tsx'))).toBe(false);
  });

  it('keeps the package-drill fixture on the five public DataTable modules', () => {
    const fixtureSource = readProjectFile('src/test/fixtures/data-table-public-consumer.tsx');
    const dataTableImports = collectModuleSpecifiers(fixtureSource).filter(
      (specifier) =>
        specifier.startsWith('@/components/data-table/') ||
        specifier === '@/hooks/use-data-table' ||
        specifier === '@/types/data-table'
    );

    expect(new Set(dataTableImports)).toEqual(
      new Set([
        '@/components/data-table/core/data-table',
        '@/components/data-table/columns/data-table-column-factory',
        '@/components/data-table/toolbar/data-table-toolbar',
        '@/hooks/use-data-table',
        '@/types/data-table'
      ])
    );
  });

  it('centralizes icon library imports through the Icons module', () => {
    const iconImportPattern =
      /from ['"](?:@radix-ui\/react-icons|@tabler\/icons-react|lucide-react|lucide)['"]/;
    const violations = collectSourceFiles()
      .filter((path) => {
        const projectPath = toProjectPath(path);
        return (
          projectPath !== 'src/components/icons.tsx' &&
          !projectPath.endsWith('.test.ts') &&
          !projectPath.endsWith('.test.tsx')
        );
      })
      .filter((path) => iconImportPattern.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('keeps shadcn iconLibrary aligned with the central Icons module', () => {
    const componentsConfig = JSON.parse(readProjectFile('components.json')) as {
      iconLibrary?: string;
    };
    const iconsSource = readProjectFile('src/components/icons.tsx');

    expect(componentsConfig.iconLibrary).toBe('tabler');
    expect(iconsSource).toContain("from '@tabler/icons-react'");
  });

  it('only reads VITE environment variables through src/config/env.ts', () => {
    const envReadPattern = /import\.meta\.env(?:\.[A-Z0-9_]*VITE_|[\s\S]{0,120}VITE_)/;
    const violations = collectSourceFiles()
      .filter((path) => toProjectPath(path) !== 'src/config/env.ts')
      .filter((path) => envReadPattern.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });

  it('keeps API calls on the shared transport boundary', () => {
    const allowedFetchCallers = new Set(['src/lib/api/sso/bootstrap.ts']);
    const directFetchViolations = collectSourceFiles()
      .filter((path) => {
        const projectPath = toProjectPath(path);
        return (
          !projectPath.endsWith('.test.ts') &&
          !projectPath.endsWith('.test.tsx') &&
          !allowedFetchCallers.has(projectPath)
        );
      })
      .filter((path) => /\bfetch\s*\(/.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(existsSync(resolve(PROJECT_ROOT, 'src/lib/api-client.ts'))).toBe(false);
    expect(directFetchViolations).toEqual([]);
  });
});
