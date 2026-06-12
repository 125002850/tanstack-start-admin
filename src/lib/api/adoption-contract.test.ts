import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('OpenAPI package adoption contract', () => {
  it('drives generation through the published openapi-client CLI', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['openapi:fetch']).toContain('openapi-client fetch-spec');
    expect(packageJson.scripts?.codegen).toContain('openapi-client generate');
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

  it('removes the embedded codegen and runtime core directories', () => {
    expect(existsSync(resolve(process.cwd(), 'tools/codegen'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/lib/api/core'))).toBe(false);
  });

  it('ignores the CLI shim directory generated under openapi/.generated', () => {
    const gitignoreSource = readProjectFile('.gitignore');

    expect(gitignoreSource).toContain('openapi/.generated/');
  });
});
