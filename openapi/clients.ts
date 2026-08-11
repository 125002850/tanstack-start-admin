import { defineClientManifests } from '@oig/react-query-generator/codegen';
import { loadEnv } from 'vite';

const codegenEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const appGateway = process.env.APP_GATEWAY ?? codegenEnv.APP_GATEWAY;
const openapiFetchTarget =
  process.env.OPENAPI_FETCH_URL ??
  codegenEnv.OPENAPI_FETCH_URL ??
  'http://localhost:8080/v3/api-docs';

export default defineClientManifests([
  {
    slug: 'service',
    source: {
      target: 'openapi/specs/openapi.json',
      fetchTarget: openapiFetchTarget
    },
    outputDir: 'src/lib/api/clients/service/generated',
    transportBinding: 'core-singleton',
    voidEnvelopeSchemas: ['RVoid'],
    ...(appGateway
      ? {
          transportProfile: {
            basePath: appGateway
          }
        }
      : {})
  }
]);
