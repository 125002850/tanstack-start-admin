// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStyleSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const lightGreenThemeSource = readStyleSource('src/styles/themes/light-green.css');

function getCssBlock(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);
  const blockStart = source.indexOf('{', selectorIndex);
  const blockEnd = source.indexOf('}', blockStart);

  if (selectorIndex < 0 || blockStart < 0 || blockEnd < 0) {
    throw new Error(`未找到 CSS 选择器：${selector}`);
  }

  return source.slice(blockStart + 1, blockEnd);
}

describe('浅春主题样式', () => {
  it('Sidebar accent 在明暗模式下直接复用 accent', () => {
    const lightTheme = getCssBlock(lightGreenThemeSource, "[data-theme='light-green']");
    const darkTheme = getCssBlock(lightGreenThemeSource, "[data-theme='light-green'].dark");
    const accentPattern = /--sidebar-accent:\s*var\(--accent\);/;

    expect(lightTheme).toMatch(accentPattern);
    expect(darkTheme).toMatch(accentPattern);
  });
});

describe('主题组件 token 归属', () => {
  it.each([
    ['zen', '--data-table-header-background'],
    ['astro-vista', '--data-table-header-background'],
    ['vercel', '--data-table-row-selected-background'],
    ['mono', '--data-table-row-selected-background'],
    ['claude', '--data-table-row-selected-background'],
    ['supabase', '--data-table-row-expanded-background']
  ])('%s 在自身主题文件声明 %s', (theme, token) => {
    const source = readStyleSource(`src/styles/themes/${theme}.css`);

    expect(getCssBlock(source, `[data-theme='${theme}']`)).toContain(`${token}:`);
  });

  it.each(['supabase', 'whatsapp'])('%s 通过语义 token 定制 Sidebar active 状态', (theme) => {
    const source = readStyleSource(`src/styles/themes/${theme}.css`);
    const themeBlock = getCssBlock(source, `[data-theme='${theme}']`);

    expect(themeBlock).toContain('--sidebar-active-background: var(--sidebar-primary);');
    expect(themeBlock).toContain('--sidebar-active-foreground: var(--sidebar-primary-foreground);');
  });

  it('theme.css 只消费通用 Sidebar active token，不包含主题名分支', () => {
    const source = readStyleSource('src/styles/theme.css');

    expect(source).toContain('--sidebar-active-background, var(--sidebar-accent)');
    expect(source).toContain('--sidebar-active-foreground, var(--sidebar-accent-foreground)');
    expect(source).not.toMatch(
      /\[data-theme='(?:supabase|light-green|whatsapp|zen|astro-vista|vercel|mono)'\]/
    );
  });
});
