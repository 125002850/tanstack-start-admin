import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { Suspense } from 'react';

// Mock TanStack Router hooks used in the component tree
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn(), state: { location: { pathname: '/dashboard/product' } } }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard/product' }),
  useParams: () => ({}),
  useSearch: () => ({})
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;
    return React.createElement(
      'div',
      { 'data-testid': 'scroll-area' },
      React.createElement(
        'div',
        {
          ref: (node: HTMLDivElement | null) => {
            if (node) {
              Object.defineProperty(node, 'clientHeight', { configurable: true, value: 400 });
              Object.defineProperty(node, 'clientWidth', { configurable: true, value: 1200 });
              Object.defineProperty(node, 'offsetHeight', { configurable: true, value: 400 });
              Object.defineProperty(node, 'offsetWidth', { configurable: true, value: 1200 });
              node.getBoundingClientRect = () =>
                ({
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  right: 1200,
                  bottom: 400,
                  width: 1200,
                  height: 400,
                  toJSON: () => ({})
                }) as DOMRect;
            }

            if (typeof viewportRef === 'function') {
              viewportRef(node);
            } else if (viewportRef && 'current' in viewportRef) {
              viewportRef.current = node;
            }
          },
          'data-scroll-target-id': id,
          'data-testid': 'scroll-viewport'
        },
        children
      )
    );
  },
  ScrollBar: () => null
}));

vi.mock('../../api/queries', () => ({
  productsQueryOptions: (filters: { page: number; limit: number }) => ({
    queryKey: ['products', filters],
    queryFn: () =>
      Promise.resolve({
        products: Array.from({ length: filters.limit }, (_, i) => ({
          id: i + 1 + (filters.page - 1) * filters.limit,
          name: `Product ${i + 1}`,
          category: 'test',
          price: 99,
          description: `Description for product ${i + 1}`,
          photo_url: 'https://example.com/photo.jpg'
        })),
        total_products: 2000
      })
  })
}));

import { ProductTable } from './product-tables/index';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, Wrapper };
}

beforeEach(() => {
  localStorage.setItem('app-data-table-per-page', '10');
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  } as typeof ResizeObserver;
  cleanup();
});

describe('ProductTable Suspense lifecycle', () => {
  it('suspends → renders fallback → remounts with data rows', async () => {
    const { Wrapper, queryClient } = createWrapper();

    render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', {}, 'Loading...') },
        React.createElement(ProductTable)
      ),
      { wrapper: Wrapper }
    );

    // 1. Suspense fallback visible during data fetch
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // 2. After query resolves, fallback removed → table remounted
    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // 3. After remount, data rows are present
    await waitFor(
      () => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1);
      },
      { timeout: 5000 }
    );

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
  });

  it('viewport ref is stable after Suspense remount', async () => {
    localStorage.setItem('app-data-table-per-page', '500');
    const { Wrapper, queryClient } = createWrapper();

    const { container } = render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', {}, 'Loading...') },
        React.createElement(ProductTable)
      ),
      { wrapper: Wrapper }
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // After remount, scroll-viewport (mocked ScrollArea) exists and is an HTMLElement
    const viewport = screen.getByTestId('scroll-viewport');
    expect(viewport).toBeVisible();
    expect(viewport).toBeInstanceOf(HTMLElement);
    expect(viewport.tagName).toBe('DIV');

    const tbody = container.querySelector('tbody[data-virtual-enabled="true"]');
    expect(tbody).not.toBeNull();
    expect(tbody?.getAttribute('data-virtual-first-index')).toBe('0');
    expect((viewport as HTMLDivElement).scrollTop).toBe(0);

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
  });

  it('non-virtual render shows all rows at small page size', async () => {
    localStorage.setItem('app-data-table-per-page', '10');
    const { Wrapper, queryClient } = createWrapper();

    render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', {}, 'Loading...') },
        React.createElement(ProductTable)
      ),
      { wrapper: Wrapper }
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // At perPage=10 (below rowCountThreshold=100), ALL 10 rows are rendered
    const rows = screen.getAllByRole('row');
    // header row + 10 data rows = 11
    expect(rows.length).toBe(11);

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
  });
});
