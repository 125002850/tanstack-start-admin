import type { InfobarContent } from '@/components/ui/infobar';

export const usersInfoContent: InfobarContent = {
  title: 'Users — Feature-Local Internal State Pattern',
  sections: [
    {
      title: 'Overview',
      description:
        'This page demonstrates data fetching with React Query using V2 feature-local internal state. Table pagination, sorting, and filtering are managed entirely within the component via useDataTable internal mode — no URL sync, no external state adapter, no workspace definition bridging.',
      links: [
        {
          title: 'TanStack Query SSR Docs',
          url: 'https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr'
        }
      ]
    },
    {
      title: 'Route Loader + Client Hydration',
      description:
        "The route's loader function calls queryClient.ensureQueryData() to prefetch data on the server. TanStack Router with Query automatically handles dehydration and hydration — the client starts with cached data, no loading spinner on first render.",
      links: []
    },
    {
      title: 'Internal State with useDataTable',
      description:
        'Pagination, search, and role filters are managed as React state internal to the table component. The useDataTable hook (V2 internal mode) owns pagination/sorting/column-filter state via useState. API query filters are derived from table.getState() and synced via useEffect. Page size preference is seeded from localStorage via useDataTablePageSize. Table state is never written back to the URL.',
      links: [
        {
          title: 'TanStack Table Docs',
          url: 'https://tanstack.com/table/latest'
        }
      ]
    },
    {
      title: 'Products vs Users Pattern',
      description:
        'Both pages use the same V2 architecture: feature-local internal state → useSuspenseQuery with filters derived from table state → useDataTable in internal mode. The WorkspacePageBoundary handles tab registration; table state lives entirely within the page component and is preserved across tab switches by Activity keep-alive.',
      links: []
    }
  ]
};
