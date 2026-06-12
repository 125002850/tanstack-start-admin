import { defineClientManifests } from '@oig/react-query-generator/codegen';
import { loadEnv } from 'vite';

const codegenEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const appGateway = process.env.APP_GATEWAY ?? codegenEnv.APP_GATEWAY;

export default defineClientManifests([
  {
    slug: 'service',
    source: {
      target: 'openapi/specs/java-demo.json',
      fetchTarget: 'http://localhost:8080/v3/api-docs'
    },
    outputDir: 'src/lib/api/clients/service/generated',
    ...(appGateway
      ? {
          transportProfile: {
            basePath: appGateway
          }
        }
      : {})
  }
]);
