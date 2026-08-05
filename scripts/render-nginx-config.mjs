import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER = '${APP_BASE_PATH}';
const TEMPLATE_PATH = fileURLToPath(new URL('../nginx.conf.template', import.meta.url));
const OUTPUT_PATH = '/tmp/nginx.conf';
const appBasePath = process.env.APP_BASE_PATH;

if (!appBasePath || !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(appBasePath)) {
  throw new Error(
    'APP_BASE_PATH must be a non-root absolute path without a trailing slash, for example /tanstack-start-admin'
  );
}

const template = readFileSync(TEMPLATE_PATH, 'utf8');

if (!template.includes(PLACEHOLDER)) {
  throw new Error(`Nginx template does not contain ${PLACEHOLDER}`);
}

writeFileSync(OUTPUT_PATH, template.replaceAll(PLACEHOLDER, appBasePath));
