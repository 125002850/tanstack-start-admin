// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalsSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
const lightGreenThemeSource = readFileSync(
  resolve(process.cwd(), 'src/styles/themes/light-green.css'),
  'utf8'
);

function getCssBlock(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);
  const blockStart = source.indexOf('{', selectorIndex);
  const blockEnd = source.indexOf('}', blockStart);

  if (selectorIndex < 0 || blockStart < 0 || blockEnd < 0) {
    throw new Error(`未找到 CSS 选择器：${selector}`);
  }

  return source.slice(blockStart + 1, blockEnd);
}

describe('共享主题样式', () => {
  it('浅春主题的 Sidebar accent 在明暗模式下直接复用 accent', () => {
    const lightTheme = getCssBlock(lightGreenThemeSource, "[data-theme='light-green']");
    const darkTheme = getCssBlock(lightGreenThemeSource, "[data-theme='light-green'].dark");
    const accentPattern = /--sidebar-accent:\s*var\(--accent\);/;

    expect(lightTheme).toMatch(accentPattern);
    expect(darkTheme).toMatch(accentPattern);
  });

  it('cell range focus 使用 outline 强调且不覆盖其他 box shadow', () => {
    const focusStyle = getCssBlock(
      globalsSource,
      "[data-slot='table-cell'][data-cell-range-focus='true']:focus-visible"
    );

    expect(focusStyle).toMatch(/outline-color:\s*color-mix\(/);
    expect(focusStyle).not.toMatch(/box-shadow:/);
  });
});
