// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const lightGreenThemeSource = readFileSync(
  resolve(process.cwd(), 'src/styles/themes/light-green.css'),
  'utf8'
);

function getCssBlock(selector: string) {
  const selectorIndex = lightGreenThemeSource.indexOf(selector);
  const blockStart = lightGreenThemeSource.indexOf('{', selectorIndex);
  const blockEnd = lightGreenThemeSource.indexOf('}', blockStart);

  if (selectorIndex < 0 || blockStart < 0 || blockEnd < 0) {
    throw new Error(`未找到 CSS 选择器：${selector}`);
  }

  return lightGreenThemeSource.slice(blockStart + 1, blockEnd);
}

describe('浅春主题样式', () => {
  it('Sidebar accent 在明暗模式下直接复用 accent', () => {
    const lightTheme = getCssBlock("[data-theme='light-green']");
    const darkTheme = getCssBlock("[data-theme='light-green'].dark");
    const accentPattern = /--sidebar-accent:\s*var\(--accent\);/;

    expect(lightTheme).toMatch(accentPattern);
    expect(darkTheme).toMatch(accentPattern);
  });
});
