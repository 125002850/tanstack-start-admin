import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { transform } from 'lightningcss';
import postcss, { type Container, type Plugin } from 'postcss';
import valueParser, { type FunctionNode } from 'postcss-value-parser';

const mixSupport = '(color: color-mix(in lab, red, red))';
const themeSelector = /^\[data-theme=['"]?([\w-]+)['"]?\](\.dark)?$/;
type Palette = Map<string, string>;

function args(node: FunctionNode) {
  const result = [''];
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') result.push('');
    else result[result.length - 1] += valueParser.stringify(child);
  }
  return result.map((part) => part.trim());
}

function resolveVars(value: string, palette: Palette, seen = new Set<string>()): string {
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value !== 'var') return;
    const [name, fallback] = args(node);
    const replacement = palette.get(name!) ?? fallback;
    if (!replacement || seen.has(name!)) throw new Error(`无法静态解析颜色变量 ${name}`);
    Object.assign(node, {
      type: 'word',
      value: resolveVars(replacement, palette, new Set([...seen, name!]))
    });
    return false;
  });
  return parsed.toString();
}

function rgb(value: string) {
  const css = transform({
    filename: 'compat-color.css',
    code: Buffer.from(`a{color:${value}}`),
    targets: { chrome: 109 << 16 },
    minify: true
  }).code.toString();
  const color = postcss.parse(css).first as postcss.Rule;
  const result = (color.first as postcss.Declaration).value;
  if (/color-mix|var\(/.test(result)) throw new Error(`无法转换颜色 ${value}`);
  return result;
}

function channels(value: string) {
  let result: string[] | undefined;
  transform({
    filename: 'compat-channels.css',
    code: Buffer.from(`a{color:${value}}`),
    visitor: {
      Color(color) {
        if (typeof color === 'object' && color.type === 'rgb')
          result = [`${color.r} ${color.g} ${color.b}`, String(color.alpha)];
      }
    }
  });
  if (!result) throw new Error(`不支持的颜色通道 ${value}`);
  return result;
}

/**
 * 项目主题只在 html[data-theme] / .dark 上定义。构建时计算 color-mix 的主题颜色，
 * 仅在不支持 color-mix 的浏览器中使用；运行时透明度仍由 CSS 变量控制。
 * 不模拟任意元素上的主题变量覆盖。新增无法解析的颜色会使构建失败，避免静默丢色。
 */
export function chrome109Colors(themeCss?: string): Plugin {
  return {
    postcssPlugin: 'oig-chrome109-colors',
    OnceExit(root, { result }) {
      const base: Palette = new Map();
      const themes = new Map<string, Palette>();
      const themeDir = resolve('src/styles/themes');
      const files =
        themeCss === undefined
          ? [
              createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
              ...readdirSync(themeDir)
                .filter((file) => file.endsWith('.css'))
                .map((file) => resolve(themeDir, file))
            ]
          : [];
      for (const file of files)
        result.messages.push({ type: 'dependency', plugin: 'oig-chrome109-colors', file });
      const source = postcss.parse(
        themeCss ?? files.map((file) => readFileSync(file, 'utf8')).join('\n')
      );
      source.walkAtRules('theme', (rule) => {
        rule.walkDecls((decl) => {
          base.set(decl.prop, decl.value);
        });
      });
      for (const sheet of [source, root])
        sheet.walkRules((rule) => {
          const selector = rule.selector.trim();
          const isTheme = themeSelector.test(selector);
          if (!isTheme && !/^:root(?:,\s*:host)?$/.test(selector)) return;
          const palette = isTheme ? (themes.get(selector) ?? new Map()) : base;
          rule.each((node) => {
            if (node.type === 'decl' && node.prop.startsWith('--'))
              palette.set(node.prop, node.value);
          });
          if (isTheme) themes.set(selector, palette);
        });
      if (!themes.size) return;
      const palettes = new Map<string, Palette>();
      for (const [selector, palette] of themes) {
        const light = themes.get(selector.replace(/\.dark$/, ''));
        palettes.set(selector, new Map([...base, ...(light ?? []), ...palette]));
      }

      const tokens = new Map<string, { expression: string; channels: boolean }>();
      const fallback = root.clone();
      fallback.walkDecls((decl) => {
        if (!decl.value.includes('color-mix(')) {
          decl.remove();
          return;
        }
        const parsed = valueParser(decl.value);
        let changed = false;
        parsed.walk((node) => {
          if (node.type !== 'function' || node.value !== 'color-mix') return;
          // Tailwind 已为 currentColor 的 placeholder 等场景生成不混色的回退。
          if (/currentcolor/i.test(valueParser.stringify(node))) return false;
          const [, first, second] = args(node);
          const transparentMix = second === 'transparent';
          const split = /^(.*)\s+([\d.]+%|var\(--[\w-]+\))$/.exec(first ?? '');
          const expression = transparentMix && split ? split[1]! : valueParser.stringify(node);
          const id = createHash('sha256')
            .update(`${transparentMix && !!split}:${expression}`)
            .digest('hex')
            .slice(0, 8);
          const token = `--c109-${id}`;
          tokens.set(token, { expression, channels: transparentMix && !!split });
          Object.assign(node, {
            type: 'word',
            value:
              transparentMix && split
                ? `rgb(var(${token}) / calc(var(${token}-alpha) * ${split[2]}))`
                : `var(${token})`
          });
          changed = true;
          return false;
        });
        if (changed) decl.value = parsed.toString();
        else decl.remove();
      });
      const prune = (container: Container) => {
        container.each((node) => {
          if (node.type === 'comment') {
            node.remove();
            return;
          }
          if (!('nodes' in node) || !node.nodes) return;
          prune(node as Container);
          if (!node.nodes.length) {
            node.remove();
            return;
          }
          if (
            node.type === 'atrule' &&
            node.name === 'supports' &&
            node.params.replace(/\s/g, '') === mixSupport.replace(/\s/g, '')
          ) {
            node.replaceWith(...node.nodes);
          }
        });
      };
      prune(fallback);
      const compat = postcss.atRule({ name: 'supports', params: `not ${mixSupport}` });
      const common = postcss.rule({ selector: ':root' });
      const themeRules = new Map(
        [...palettes.keys()].map((selector) => [selector, postcss.rule({ selector })])
      );
      for (const [token, entry] of tokens) {
        const values = [...palettes].map(([selector, palette]) => {
          const color = rgb(resolveVars(entry.expression, palette));
          return { selector, values: entry.channels ? channels(color) : [color] };
        });
        const opaque = entry.channels && values.every(({ values: value }) => value[1] === '1');
        if (opaque)
          fallback.walkDecls((decl) => {
            decl.value = decl.value.replaceAll(`var(${token}-alpha)`, '1');
          });
        for (let index = 0; index < (entry.channels && !opaque ? 2 : 1); index++) {
          const shared = values.every(
            ({ values: value }) => value[index] === values[0]!.values[index]
          );
          for (const { selector, values: value } of shared ? values.slice(0, 1) : values) {
            const rule = shared ? common : themeRules.get(selector)!;
            rule.append({ prop: index ? `${token}-alpha` : token, value: value[index]! });
          }
        }
      }
      compat.append(common, ...themeRules.values(), ...fallback.nodes);
      root.append(compat);
      // 同时处理开发服务器和生产构建的 OKLCH、嵌套及静态渐变语法。
      const compiled = transform({
        filename: root.source?.input.file ?? 'globals.css',
        code: Buffer.from(root.toString()),
        targets: { chrome: 109 << 16 }
      });
      root.removeAll().append(postcss.parse(compiled.code.toString()).nodes);
    }
  };
}
