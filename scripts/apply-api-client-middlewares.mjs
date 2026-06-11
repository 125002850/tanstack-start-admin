import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GENERATED_MUTATOR_DIR = path.resolve('openapi/.generated');
const BASE_PATH_PATTERN = /const basePath = ("[^"]+"|'[^']+');/;

function patchMutatorSource(source) {
  const basePathMatch = source.match(BASE_PATH_PATTERN);

  if (!basePathMatch) {
    return source;
  }

  const basePath = basePathMatch[1];

  return [
    "import { createApiClientCustomInstance } from '@/lib/api/transport';",
    '',
    `const basePath = ${basePath};`,
    '',
    'export const customInstance = createApiClientCustomInstance(basePath);',
    ''
  ].join('\n');
}

async function main() {
  const fileNames = await readdir(GENERATED_MUTATOR_DIR);
  const mutatorNames = fileNames.filter((fileName) => fileName.endsWith('-orval-mutator.ts'));

  await Promise.all(
    mutatorNames.map(async (fileName) => {
      const filePath = path.join(GENERATED_MUTATOR_DIR, fileName);
      const source = await readFile(filePath, 'utf8');
      const patched = patchMutatorSource(source);

      if (patched !== source) {
        await writeFile(filePath, patched);
      }
    })
  );
}

await main();
