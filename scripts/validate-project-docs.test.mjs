// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  validateMarkdownLinks,
  validatePnpmCommands,
  validateProjectDocs,
  validateSkillVersion
} from './validate-project-docs.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeFixture(root, path, source) {
  const file = resolve(root, path);
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, source);
}

describe('project documentation validation', () => {
  const file = resolve('docs/guide.md');

  it('resolves relative links including encoded spaces and fragments', () => {
    const target = resolve('docs/references/API guide.md');
    const source = '[API](references/API%20guide.md#requests)';

    expect(validateMarkdownLinks(file, source, (path) => path === target)).toEqual([]);
  });

  it('reports the source line of a missing local reference', () => {
    const source = '# Guide\n\n[Reference](missing.md)';
    const issues = validateMarkdownLinks(file, source, () => false);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file, line: 3 });
    expect(issues[0].message).toContain('missing.md');
  });

  it('checks angle-bracket links whose filenames contain spaces', () => {
    const issues = validateMarkdownLinks(file, '[Guide](<references/API guide.md>)', () => false);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('references/API guide.md');
  });

  it('resolves angle-bracket links whose filenames contain parentheses', () => {
    const target = resolve('docs/references/API guide (draft).md');
    const source = '[Guide](<references/API guide (draft).md>)';

    expect(validateMarkdownLinks(file, source, (path) => path === target)).toEqual([]);
  });

  it('ignores external links, application routes and illustrative code', () => {
    const source = [
      '[External](https://example.com/guide)',
      '[Route](/dashboard/overview)',
      '[Section](#usage)',
      '```markdown',
      '[Example](missing.md)',
      '```',
      '`[Inline example](missing.md)`'
    ].join('\n');

    expect(validateMarkdownLinks(file, source, () => false)).toEqual([]);
  });

  it('checks actual script names while accepting pnpm built-ins', () => {
    const source = [
      '```bash',
      'pnpm install --frozen-lockfile',
      'pnpm dlx shadcn@latest info --json',
      'pnpm exec vitest run',
      'pnpm run typecheck',
      'OPENAPI_FETCH_TARGET=http://localhost:8080/v3/api-docs pnpm api',
      'pnpm nonexistent',
      '```'
    ].join('\n');
    const issues = validatePnpmCommands(file, source, { typecheck: '', api: '' });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ line: 7 });
    expect(issues[0].message).toContain('nonexistent');
  });

  it('does not interpret comments or TypeScript examples as shell commands', () => {
    const source = [
      '```bash',
      '# pnpm illustrative-script',
      'pnpm --version',
      '```',
      '```ts',
      "const example = 'pnpm illustrative-script'",
      '```'
    ].join('\n');

    expect(validatePnpmCommands(file, source, {})).toEqual([]);
  });

  it('requires the skill version to match the dependency major without blocking patches', () => {
    expect(validateSkillVersion(file, '4.1.10', '^4.2.0')).toEqual([]);
    expect(validateSkillVersion(file, '3.2.0', '^4.1.10')).toHaveLength(1);
    expect(validateSkillVersion(file, undefined, '^4.1.10')).toHaveLength(1);
  });

  it('validates project operation docs without scanning unpatched upstream snapshots', () => {
    const root = mkdtempSync(join(tmpdir(), 'project-docs-'));
    temporaryRoots.push(root);
    writeFixture(root, 'package.json', JSON.stringify({ devDependencies: { vitest: '^4.1.10' } }));
    writeFixture(root, 'README.md', '# README');
    writeFixture(root, 'AGENTS.MD', '# Agents');
    writeFixture(root, '.agents/skills/oig-tanstack-admin/SKILL.md', '[Missing](local.md)');
    writeFixture(root, '.agents/skills/shadcn-ui/SKILL.md', '# Shadcn');
    writeFixture(
      root,
      '.agents/skills/vitest/SKILL.md',
      '---\nmetadata:\n  vitest: "4.1.10"\n---\n# Vitest'
    );
    writeFixture(
      root,
      '.agents/skills/vitest/UPSTREAM.json',
      JSON.stringify({ localPatches: [{ path: 'SKILL.md' }] })
    );
    writeFixture(
      root,
      '.agents/skills/vitest/references/upstream.md',
      '[Missing upstream link](missing.md)'
    );

    const result = validateProjectDocs(root);

    expect(result.files).toBe(5);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('local.md');
  });
});
