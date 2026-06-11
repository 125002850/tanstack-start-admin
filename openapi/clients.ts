import { defineClientManifests } from '@oig/react-query-generator/codegen';

export default defineClientManifests([
  {
    name: 'dict',
    source: {
      kind: 'file',
      target: 'openapi/specs/java-demo.json',
      fetchTarget: 'http://localhost:8080/v3/api-docs',
      snapshotTarget: 'openapi/snapshots'
    },
    includeTags: ['全局字典'],
    outputDir: 'src/lib/api/clients/dict/generated',
    queryKeyPrefix: ['dict'],
    queryClientImport: {
      from: '@/lib/query-client',
      name: 'getQueryClient'
    },
    transportProfile: {
      viaBff: true,
      basePath: '/api',
      credentials: 'same-origin'
    },
    responseProfile: {
      wrapper: 'data',
      successCode: 200
    },
    normalizationProfiles: {
      dictionaryTypesPage: {
        fieldAliases: {
          createBy: 'createdBy',
          createTime: 'createdAt',
          updateBy: 'updatedBy',
          updateTime: 'updatedAt'
        },
        enumAliases: {
          status: {
            ENABLE: 'ENABLED',
            DISABLE: 'DISABLED'
          }
        },
        scalarCoercions: {
          createdBy: 'number-to-string',
          updatedBy: 'number-to-string'
        },
        projection: 'page-item'
      },
      dictionaryItemsList: {
        fieldAliases: {
          createBy: 'createdBy',
          createTime: 'createdAt',
          updateBy: 'updatedBy',
          updateTime: 'updatedAt'
        },
        enumAliases: {
          status: {
            ENABLE: 'ENABLED',
            DISABLE: 'DISABLED'
          }
        },
        scalarCoercions: {
          createdBy: 'number-to-string',
          updatedBy: 'number-to-string'
        },
        projection: 'list'
      }
    },
    overrides: {
      listGlobalTypes: {
        kind: 'query',
        suspense: true,
        queryKeySegments: ['global-types', 'list'],
        orchestration: {
          defaultRequest: {
            pageNo: 1,
            pageSize: 200
          },
          normalizationProfile: 'dictionaryTypesPage',
          exportAs: 'dictionaryTypesBase'
        }
      },
      listGlobalItemsByType: {
        kind: 'query',
        suspense: true,
        queryKeySegments: ['global-items', 'by-type'],
        orchestration: {
          normalizationProfile: 'dictionaryItemsList',
          exportAs: 'dictionaryItemsBase'
        }
      },
      createGlobalType: {
        kind: 'mutation',
        queryKeySegments: ['global-types', 'create'],
        invalidate: [{ target: ['dict', 'global-types', 'list'], scope: 'prefix' }]
      },
      updateGlobalType: {
        kind: 'mutation',
        queryKeySegments: ['global-types', 'update'],
        invalidate: [{ target: ['dict', 'global-types', 'list'], scope: 'prefix' }]
      },
      deleteGlobalType: {
        kind: 'mutation',
        queryKeySegments: ['global-types', 'delete'],
        invalidate: [{ target: ['dict', 'global-types', 'list'], scope: 'prefix' }]
      },
      createGlobalItem: {
        kind: 'mutation',
        queryKeySegments: ['global-items', 'create'],
        invalidate: [
          { target: ['dict', 'global-items', 'by-type'], scope: 'prefix' },
          {
            target: ['dict', 'global-items', 'by-type'],
            scope: 'exact',
            fromParams: ['dictTypeCode']
          }
        ]
      },
      updateGlobalItem: {
        kind: 'mutation',
        queryKeySegments: ['global-items', 'update'],
        invalidate: [
          { target: ['dict', 'global-items', 'by-type'], scope: 'prefix' },
          {
            target: ['dict', 'global-items', 'by-type'],
            scope: 'exact',
            fromParams: ['dictTypeCode']
          }
        ]
      },
      deleteGlobalItem: {
        kind: 'mutation',
        queryKeySegments: ['global-items', 'delete'],
        invalidate: [{ target: ['dict', 'global-items', 'by-type'], scope: 'prefix' }]
      }
    },
    recommendedMaxOperations: 50
  },
  {
    name: 'file-storage',
    source: {
      kind: 'file',
      target: 'openapi/specs/java-demo.json',
      fetchTarget: 'http://localhost:8080/v3/api-docs',
      snapshotTarget: 'openapi/snapshots'
    },
    includeTags: ['文件存储'],
    outputDir: 'src/lib/api/clients/file-storage/generated',
    queryKeyPrefix: ['file-storage'],
    queryClientImport: {
      from: '@/lib/query-client',
      name: 'getQueryClient'
    },
    transportProfile: {
      viaBff: true,
      basePath: '/api',
      credentials: 'same-origin'
    },
    responseProfile: {
      wrapper: 'data',
      successCode: 200
    },
    overrides: {
      fetchTempUrl: {
        kind: 'query',
        suspense: true,
        queryKeySegments: ['temp-url', 'fetch']
      },
      fetchDirectUploadCredential: {
        kind: 'query',
        suspense: true,
        queryKeySegments: ['direct-upload-credential', 'fetch']
      },
      upload: {
        alias: 'uploadFileObject',
        kind: 'mutation',
        multipart: true,
        queryKeySegments: ['object', 'upload']
      },
      delete: {
        alias: 'deleteFileObject',
        kind: 'mutation',
        queryKeySegments: ['object', 'delete']
      }
    },
    recommendedMaxOperations: 50
  }
]);
