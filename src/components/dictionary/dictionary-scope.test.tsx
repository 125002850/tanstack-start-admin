import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDict } from '@/hooks/use-dict';

const serviceMocks = vi.hoisted(() => ({
  systemDictGlobalItemsOptions: vi.fn()
}));

vi.mock('@/lib/api/clients/service', () => ({
  systemDictGlobalItemsOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalItemsOptions(...args)
}));

import { DictionaryScope } from './dictionary-scope';

function DictionaryConsumers() {
  const status = useDict('IAM_STATUS');
  const menuType = useDict('IAM_MENU_TYPE');
  return (
    <div>
      <span>{status.getLabel('ENABLED')}</span>
      <span>{menuType.getLabel('DIR')}</span>
    </div>
  );
}

describe('DictionaryScope', () => {
  it('loads all declared dictionaries once for every nested consumer', async () => {
    serviceMocks.systemDictGlobalItemsOptions.mockResolvedValue([
      {
        dictTypeCode: 'IAM_STATUS',
        items: [{ code: 'ENABLED', name: '启用', status: 'enable', sortOrder: 1 }]
      },
      {
        dictTypeCode: 'IAM_MENU_TYPE',
        items: [{ code: 'DIR', name: '目录', status: 'enable', sortOrder: 1 }]
      }
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DictionaryScope typeCodes={['IAM_STATUS', 'IAM_MENU_TYPE']}>
          <DictionaryConsumers />
        </DictionaryScope>
      </QueryClientProvider>
    );

    expect(await screen.findByText('启用')).toBeInTheDocument();
    expect(screen.getByText('目录')).toBeInTheDocument();
    await waitFor(() => expect(serviceMocks.systemDictGlobalItemsOptions).toHaveBeenCalledTimes(1));
    expect(serviceMocks.systemDictGlobalItemsOptions).toHaveBeenCalledWith(
      { dictTypeCodes: ['IAM_MENU_TYPE', 'IAM_STATUS'] },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
