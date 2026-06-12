import { defineClientManifests } from '@oig/react-query-generator/codegen';

export default defineClientManifests([
  {
    slug: 'service',
    source: {
      target: 'openapi/specs/java-demo.json',
      fetchTarget: 'http://localhost:8080/v3/api-docs'
    },
    outputDir: 'src/lib/api/clients/service/generated'
  }
]);
