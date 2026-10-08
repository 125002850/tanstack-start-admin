// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'bundle-budget-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));
it('rejects empty build output and output without JavaScript', () => {
  for (const content of ['', 'index.html']) {
    if (content) writeFileSync(join(directory, content), '<html></html>');
    const result = spawnSync(process.execPath, ['scripts/check-bundle-budget.mjs', directory], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No built JavaScript assets found');
  }
});
it.each(['12bytes', '1.5', '-1', ' ', '9007199254740992'])('rejects invalid budget %s', value => {
  writeFileSync(join(directory, 'app.js'), 'let a=1;');
  const result = spawnSync(process.execPath, ['scripts/check-bundle-budget.mjs', directory], {
    env: { ...process.env, BUNDLE_BUDGET_TOTAL_BYTES: value }, encoding: 'utf8'
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('must be a non-negative integer');
});
it('accepts valid built JavaScript', () => {
  writeFileSync(join(directory, 'app.js'), 'let a=1;');
  expect(() => execFileSync(process.execPath, ['scripts/check-bundle-budget.mjs', directory])).not.toThrow();
});
