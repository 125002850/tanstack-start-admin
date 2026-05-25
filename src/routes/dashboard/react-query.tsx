import { createFileRoute } from '@tanstack/react-router';
import { pokemonOptions } from '@/features/react-query-demo/api/queries';
import { PokemonInfo } from '@/features/react-query-demo/components/pokemon-info';
import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import { PokemonSkeleton } from '@/features/react-query-demo/components/pokemon-skeleton';
import { reactQueryInfoContent } from '@/features/react-query-demo/info-content';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: 'React Query',
  title: 'Dashboard: React Query',
  nav: {
    visible: true,
    group: 'components',
    order: 20,
    icon: 'code',
  },
  page: {
    title: 'React Query',
    description: 'Server prefetch + client hydration + suspense query pattern.',
    infoContent: reactQueryInfoContent,
  },
});

export const Route = createFileRoute('/dashboard/react-query')({
  ...meta,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(pokemonOptions(25));
  },
  component: ReactQueryPage
});

function ReactQueryPage() {
  return (
    <PageContainer>
      <Suspense fallback={<PokemonSkeleton />}>
        <PokemonInfo />
      </Suspense>
    </PageContainer>
  );
}
