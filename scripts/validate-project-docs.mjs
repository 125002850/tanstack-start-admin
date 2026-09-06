import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function markdownLines(source) {
  let fence;
  return source.split(/\r?\n/).map((text, index) => {
    const marker = text.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) {
        fence = { marker: marker[1], language: marker[2].trim().toLowerCase().split(/\s+/)[0] };
      } else if (
        marker[1][0] === fence.marker[0] &&
        marker[1].length >= fence.marker.length &&
        !marker[2].trim()
      ) {
        fence = undefined;
      }
      return { text: '', line: index + 1 };
    }
    return { text, line: index + 1, language: fence?.language };
  });
}

export function validateMarkdownLinks(file, source, exists = existsSync) {
  const issues = [];
  for (const { text, line, language } of markdownLines(source)) {
    if (language !== undefined) continue;
    const prose = text.replace(/`+[^`]*`+/g, '');
    for (const match of prose.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
      const target = match[1] ?? match[2];
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(target)) continue;
      try {
        const path = resolve(dirname(file), decodeURIComponent(target.split('#')[0]));
        if (!exists(path)) {
          issues.push({ file, line, message: `相对链接不存在：${target}` });
        }
      } catch {
        issues.push({ file, line, message: `相对链接编码无效：${target}` });
      }
    }
  }
  return issues;
}

const PNPM_COMMANDS = new Set([
  'add',
  'config',
  'dlx',
  'exec',
  'help',
  'install',
  'list',
  'remove',
  'update',
  'why'
]);
const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'powershell', 'pwsh']);

export function validatePnpmCommands(file, source, scripts) {
  const issues = [];
  for (const { text, line, language } of markdownLines(source)) {
    if (!SHELL_LANGUAGES.has(language) || text.trimStart().startsWith('#')) continue;
    for (const match of text.matchAll(/\bpnpm\s+(?:(run)\s+)?([\w:-]+)/g)) {
      const command = match[2];
      if (command.startsWith('-')) continue;
      if (!match[1] && PNPM_COMMANDS.has(command)) continue;
      if (!Object.hasOwn(scripts, command)) {
        issues.push({ file, line, message: `package.json 未声明脚本：${command}` });
      }
    }
  }
  return issues;
}

export function validateSkillVersion(file, version, dependency) {
  const skillMajor = version?.match(/^(\d+)\./)?.[1];
  const dependencyMajor = dependency?.match(/^[~^]?(\d+)\./)?.[1];
  return skillMajor && skillMajor === dependencyMajor
    ? []
    : [{ file, line: 1, message: `skill 版本 ${version ?? '未声明'} 与依赖 ${dependency} 不匹配` }];
}

function collectMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.name === 'vendor') return [];
    if (entry.isDirectory()) return collectMarkdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

function collectPatchedUpstreamMarkdownFiles(skillsRoot) {
  return readdirSync(skillsRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const skillDirectory = join(skillsRoot, entry.name);
    const manifest = join(skillDirectory, 'UPSTREAM.json');
    if (!existsSync(manifest)) return [];
    const upstream = JSON.parse(readFileSync(manifest, 'utf8'));
    return (upstream.localPatches ?? [])
      .map((patch) => resolve(skillDirectory, patch.path))
      .filter((file) => file.endsWith('.md'));
  });
}

export function validateProjectDocs(root = process.cwd()) {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const skillsRoot = resolve(root, '.agents/skills');
  const readme = resolve(root, 'README.md');
  const localSkillDocs = ['oig-tanstack-admin', 'shadcn-ui'].flatMap((skill) =>
    collectMarkdownFiles(resolve(skillsRoot, skill))
  );
  const files = [
    ...new Set([
      readme,
      resolve(root, 'AGENTS.MD'),
      ...localSkillDocs,
      ...collectPatchedUpstreamMarkdownFiles(skillsRoot)
    ])
  ];
  const issues = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const skillPath = relative(skillsRoot, file).replaceAll('\\', '/');
    // 通用 reference 的示例项目可以定义自己的 scripts；项目入口必须使用真实命令。
    const checksCommands =
      file === readme ||
      skillPath.startsWith('oig-tanstack-admin/') ||
      skillPath === 'shadcn-ui/SKILL.md';
    return [
      ...validateMarkdownLinks(file, source),
      ...(checksCommands ? validatePnpmCommands(file, source, packageJson.scripts ?? {}) : [])
    ];
  });
  const vitestSkill = resolve(skillsRoot, 'vitest/SKILL.md');
  const source = readFileSync(vitestSkill, 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const version = frontmatter.match(/^\s{2}vitest:\s*["']?(\d+\.\d+\.\d+)/m)?.[1];
  issues.push(...validateSkillVersion(vitestSkill, version, packageJson.devDependencies?.vitest));
  return { files: files.length, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateProjectDocs();
  for (const issue of result.issues) {
    console.error(`${relative(process.cwd(), issue.file)}:${issue.line} ${issue.message}`);
  }
  if (result.issues.length) {
    process.exitCode = 1;
  } else {
    console.log(`文档校验通过：${result.files} 个文件。`);
  }
}
