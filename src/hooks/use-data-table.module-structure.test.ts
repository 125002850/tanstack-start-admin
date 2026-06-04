import { describe, expect, it } from 'vitest';

describe('useDataTable module structure', () => {
  it('exposes the hook through the folder entrypoint without changing the public import', async () => {
    const publicModule = await import('@/hooks/use-data-table');
    const directoryEntryLoaders = import.meta.glob('./use-data-table/index.ts');
    const directoryEntryLoader = directoryEntryLoaders['./use-data-table/index.ts'];

    expect(directoryEntryLoader).toBeTypeOf('function');

    if (!directoryEntryLoader) {
      return;
    }

    const directoryEntryModule = (await directoryEntryLoader()) as typeof import(
      '@/hooks/use-data-table'
    );

    expect(directoryEntryModule?.useDataTable).toBe(publicModule.useDataTable);
  });

  it('keeps the legacy file entrypoint available for dev-server compatibility', async () => {
    const publicModule = await import('@/hooks/use-data-table');
    const legacyEntryLoaders = import.meta.glob('./use-data-table.ts');
    const legacyEntryLoader = legacyEntryLoaders['./use-data-table.ts'];

    expect(legacyEntryLoader).toBeTypeOf('function');

    if (!legacyEntryLoader) {
      return;
    }

    const legacyEntryModule = (await legacyEntryLoader()) as typeof import('@/hooks/use-data-table');

    expect(legacyEntryModule.useDataTable).toBe(publicModule.useDataTable);
  });
});
