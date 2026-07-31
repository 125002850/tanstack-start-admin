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
