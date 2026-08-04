import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_SPEC_PATH = 'openapi/specs/openapi.json';

export const REQUIRED_OPERATIONS = [
  {
    method: 'post',
    operationId: 'iamAuthLogin',
    path: '/api/iam/auth/login'
  },
  {
    method: 'post',
    operationId: 'iamStaffPage',
    path: '/api/iam/staff/page'
  },
  {
    method: 'post',
    operationId: 'systemDictGlobalItemsByType',
    path: '/api/system/dict/global/items/by-type'
  },
  {
    method: 'post',
    operationId: 'systemDictGlobalItemsOptions',
    path: '/api/system/dict/global/items/options'
  }
];

export function validateOpenApiContract(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('OpenAPI 契约校验失败：文档根节点必须是对象。');
  }

  const missingOperations = REQUIRED_OPERATIONS.filter(({ method, operationId, path }) => {
    return document.paths?.[path]?.[method]?.operationId !== operationId;
  });

  if (missingOperations.length > 0) {
    const details = missingOperations
      .map(
        ({ method, operationId, path }) =>
          `- ${method.toUpperCase()} ${path}（operationId: ${operationId}）`
      )
      .join('\n');

    throw new Error(
      [
        'OpenAPI 契约与当前前端不匹配，已停止生成 API client。',
        '请确认 OPENAPI_FETCH_TARGET 指向包含本地 IAM 能力的正确后端。',
        '缺少或不匹配的必需操作：',
        details
      ].join('\n')
    );
  }
}

export async function validateOpenApiContractFile(specPath = DEFAULT_SPEC_PATH) {
  const source = await readFile(specPath, 'utf8');
  const document = JSON.parse(source);
  validateOpenApiContract(document);
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
  try {
    await validateOpenApiContractFile(process.argv[2]);
    console.log(`OpenAPI 契约校验通过：${process.argv[2] ?? DEFAULT_SPEC_PATH}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
