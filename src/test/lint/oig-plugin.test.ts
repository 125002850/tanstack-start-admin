// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OXLINT_BIN = resolve(PROJECT_ROOT, 'node_modules/oxlint/bin/oxlint');
const OIG_PLUGIN_URL = pathToFileURL(resolve(PROJECT_ROOT, 'tools/oxlint/oig-plugin.mjs')).href;
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    if (!directory.startsWith(join(tmpdir(), 'oig-oxlint-'))) {
      throw new Error(`拒绝清理非测试临时目录：${directory}`);
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

function runOxlint(source: string, options: string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), 'oig-oxlint-'));
  tempDirectories.push(directory);
  const sourcePath = join(directory, 'fixture.ts');
  const configPath = join(directory, '.oxlintrc.json');

  writeFileSync(sourcePath, source);
  writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: [OIG_PLUGIN_URL],
      rules: {
        'oig/no-implicit-empty-to-undefined': 'error',
        'oig/no-empty-string-to-undefined-in-update': 'error'
      }
    })
  );

  const result = spawnSync(
    process.execPath,
    [OXLINT_BIN, '--config', configPath, ...options, sourcePath],
    { cwd: PROJECT_ROOT, encoding: 'utf8' }
  );

  return {
    result,
    source: () => readFileSync(sourcePath, 'utf8')
  };
}

describe('oig OxLint plugin', () => {
  it('reports truthiness-based undefined conversion at a request boundary', () => {
    const { result } = runOxlint(`
      mutation.mutateAsync({
        description: value.description || undefined
      });
    `);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('oig(no-implicit-empty-to-undefined)');
  });

  it('does not report the same syntax outside a request boundary', () => {
    const { result } = runOxlint(`
      const viewState = {
        busy: loading || undefined
      };
    `);

    expect(result.status).toBe(0);
  });

  it('applies a safe helper fix in an explicit Create Request Mapper', () => {
    const { result, source } = runOxlint(
      `
        function toCreateUserRequest(value) {
          return { remark: value.remark || undefined };
        }
      `,
      ['--fix']
    );

    expect(result.status).toBe(0);
    expect(source()).toContain(
      "import { emptyStringToUndefined } from '@/lib/api/request-values';"
    );
    expect(source()).toContain('remark: emptyStringToUndefined(value.remark)');
  });

  it('keeps the general request diagnostic suggestion-only under --fix', () => {
    const { result, source } = runOxlint(
      `mutation.mutateAsync({ remark: value.remark || undefined });`,
      ['--fix']
    );

    expect(result.status).toBe(1);
    expect(source()).toContain('value.remark || undefined');
    expect(source()).not.toContain('emptyStringToUndefined');
  });

  it('can apply the helper suggestion when explicitly requested', () => {
    const { result, source } = runOxlint(
      `mutation.mutateAsync({ remark: value.remark || undefined });`,
      ['--fix-suggestions']
    );

    expect(result.status).toBe(0);
    expect(source()).toContain('remark: emptyStringToUndefined(value.remark)');
  });

  it('rejects the create-only helper in Update/Save Request Mappers', () => {
    const { result } = runOxlint(`
      import { emptyStringToUndefined } from '@/lib/api/request-values';

      function toUpdateUserRequest(value) {
        return { remark: emptyStringToUndefined(value.remark) };
      }
    `);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('oig(no-empty-string-to-undefined-in-update)');
  });
});
