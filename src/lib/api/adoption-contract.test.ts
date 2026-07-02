// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function toProjectPath(path: string) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
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

const originalAppGateway = process.env.APP_GATEWAY;

afterEach(() => {
  if (originalAppGateway === undefined) {
    delete process.env.APP_GATEWAY;
  } else {
    process.env.APP_GATEWAY = originalAppGateway;
  }
});

describe('OpenAPI package adoption contract', () => {
  it('drives generation through the published openapi-client CLI', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['openapi:fetch']).toContain('openapi-client fetch-spec');
    expect(packageJson.scripts?.codegen).toContain('openapi-client generate');
    expect(packageJson.scripts?.codegen).not.toContain('apply-api-client-middlewares');
    expect(packageJson.scripts?.codegen).not.toContain('tools/codegen/scripts/generate.ts');
    expect(packageJson.scripts?.['codegen:check']).toContain('pnpm codegen');
    expect(packageJson.scripts?.['codegen:check']).toContain('tsc --noEmit');
  });

  it('loads client manifests from openapi/clients.ts via the package codegen API', () => {
    expect(existsSync(resolve(process.cwd(), 'openapi/clients.ts'))).toBe(true);

    const manifestSource = readProjectFile('openapi/clients.ts');
    expect(manifestSource).toContain(
      "import { defineClientManifests } from '@oig/react-query-generator/codegen';"
    );
  });

  it('maps APP_GATEWAY into manifest transportProfile.basePath', async () => {
    process.env.APP_GATEWAY = '/__test_gateway__';
    vi.resetModules();

    const manifestModule = await import(
      `${pathToFileURL(resolve(process.cwd(), 'openapi/clients.ts')).href}?t=${Date.now()}`
    );

    expect(manifestModule.default[0]?.transportProfile?.basePath).toBe('/__test_gateway__');
  });

  it('imports generated runtime helpers from @oig/react-query-generator/core', () => {
    const sdkSource = readProjectFile('src/lib/api/clients/service/generated/sdk.ts');
    const queriesSource = readProjectFile('src/lib/api/clients/service/generated/queries.ts');
    const mutationsSource = readProjectFile('src/lib/api/clients/service/generated/mutations.ts');

    expect(sdkSource).toContain("@oig/react-query-generator/core");
    expect(queriesSource).toContain("@oig/react-query-generator/core");
    expect(mutationsSource).toContain("@oig/react-query-generator/core");
    expect(sdkSource).not.toContain("@/lib/api/core");
    expect(queriesSource).not.toContain("@/lib/api/core");
    expect(mutationsSource).not.toContain("@/lib/api/core");
  });

  it('relies on the package generator for generated-file typecheck suppression', () => {
    const sdkSource = readProjectFile('src/lib/api/clients/service/generated/sdk.ts');
    const queriesSource = readProjectFile('src/lib/api/clients/service/generated/queries.ts');
    const mutationsSource = readProjectFile('src/lib/api/clients/service/generated/mutations.ts');
    const orchestrationSource = readProjectFile(
      'src/lib/api/clients/service/generated/orchestration.ts'
    );

    expect(sdkSource).toMatch(/^\/\/ @ts-nocheck\n\/\*\*\n \* AUTO-GENERATED FILE/);
    expect(queriesSource).toMatch(/^\/\/ @ts-nocheck\n\/\*\*\n \* AUTO-GENERATED FILE/);
    expect(mutationsSource).toMatch(/^\/\/ @ts-nocheck\n\/\*\*\n \* AUTO-GENERATED FILE/);
    expect(orchestrationSource).toMatch(/^\/\/ @ts-nocheck\n\/\*\*\n \* AUTO-GENERATED FILE/);
  });

  it('removes the embedded codegen and runtime core directories', () => {
    expect(existsSync(resolve(process.cwd(), 'tools/codegen'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/lib/api/core'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'scripts/apply-api-client-middlewares.mjs'))).toBe(
      false
    );
  });

  it('ignores the CLI shim directory generated under openapi/.generated', () => {
    const gitignoreSource = readProjectFile('.gitignore');

    expect(gitignoreSource).toContain('openapi/.generated/');
  });

  it('keeps feature and adapter imports off the OpenAPI CLI shim', () => {
    const roots = [
      resolve(process.cwd(), 'src/features')
    ];
    const sourceExtensions = new Set(['.ts', '.tsx']);
    const shimImportPattern =
      /from\s+['"][^'"]*(?:openapi\/\.generated|service-orval-mutator)[^'"]*['"]/;

    const violations = roots
      .flatMap((root) => collectFiles(root, (path) => sourceExtensions.has(extname(path))))
      .filter((path) => shimImportPattern.test(readFileSync(path, 'utf8')))
      .map(toProjectPath);

    expect(violations).toEqual([]);
  });
});
