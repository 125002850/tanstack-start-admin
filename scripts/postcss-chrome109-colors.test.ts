// @vitest-environment node
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { chrome109Colors } from './postcss-chrome109-colors';

const palette = `
  [data-theme='test'] { --primary: #ff0000; --background: #ffffff; }
  [data-theme='test'].dark { --primary: #0000ff; --background: #000000; }
`;

describe('Chrome 109 主题颜色回退', () => {
  it('保留现代颜色，并为亮暗主题生成不同的 RGB 通道与动态透明度', async () => {
    const { css } = await postcss([chrome109Colors(palette)]).process(
      `
      .selection { background: color-mix(in oklab, var(--primary) var(--amount), transparent); }
      .surface { background: color-mix(in oklab, var(--primary) 20%, var(--background)); }
    `,
      { from: undefined }
    );
    expect(css).toContain('color-mix(in oklab');
    expect(css).toContain('@supports not (color: color-mix');
    expect(css).toContain('255 0 0');
    expect(css).toContain('0 0 255');
    expect(css).toContain('var(--amount)');
    expect(css).toMatch(/\.dark\s*\{/);
    const fallback = postcss
      .parse(css)
      .nodes.find((node) => node.type === 'atrule' && node.params.startsWith('not '));
    expect(fallback?.toString().split('{').slice(1).join('{')).not.toContain('color-mix(');
  });

  it('保持 media/layer/pseudo 作用域，移除 Tailwind 的现代混色保护条件', async () => {
    const { css } = await postcss([chrome109Colors(palette)]).process(
      `
      @layer utilities {
        @media (hover:hover) {
          @supports (color: color-mix(in lab, red, red)) {
            .item:hover { background: color-mix(in oklab, var(--primary) 10%, transparent); }
          }
        }
      }
    `,
      { from: undefined }
    );
    const fallback = postcss
      .parse(css)
      .nodes.find((node) => node.type === 'atrule' && node.params.startsWith('not '));
    expect(fallback?.toString()).toContain('@layer utilities');
    expect(fallback?.toString()).toContain('@media (hover: hover)');
    expect(fallback?.toString()).toContain('.item:hover');
    expect(fallback?.toString().match(/@supports/g)).toHaveLength(1);
  });

  it('遇到未知局部颜色或循环变量时阻止构建', async () => {
    await expect(
      postcss([chrome109Colors(palette)]).process(
        '.item { color:color-mix(in oklab,var(--unknown) 20%,transparent); }',
        { from: undefined }
      )
    ).rejects.toThrow('无法静态解析颜色变量 --unknown');
    await expect(
      postcss([chrome109Colors(`[data-theme='test'] { --a:var(--b);--b:var(--a); }`)]).process(
        '.item { color:color-mix(in oklab,var(--a) 20%,transparent); }',
        { from: undefined }
      )
    ).rejects.toThrow('无法静态解析颜色变量');
  });
});
