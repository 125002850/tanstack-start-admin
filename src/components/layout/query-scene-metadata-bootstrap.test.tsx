import { QueryClient, QueryClientProvider, focusManager, useQuery } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  QUERY_SCENE_METADATA_STALE_TIME,
  querySceneMetadataQueryOptions
} from '@/lib/api/query-scene-metadata';
import { querySceneMetadataFixture } from '@/test/query-scene-metadata';
import { QuerySceneMetadataBootstrap } from './query-scene-metadata-bootstrap';

function PageSubscriber() {
  useQuery(querySceneMetadataQueryOptions());
  return null;
}

describe('query scene metadata bootstrap', () => {
  let client: QueryClient;
  const fetchMetadata = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMetadata.mockReset().mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: 200, data: querySceneMetadataFixture }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );
    vi.stubGlobal('fetch', fetchMetadata);
  });

  afterEach(() => {
    cleanup();
    client.clear();
    focusManager.setFocused(undefined);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shares initialization with page subscriptions, then refreshes once at expiry', async () => {
    const prefetch = client.prefetchQuery(querySceneMetadataQueryOptions());
    render(
      <QueryClientProvider client={client}>
        <QuerySceneMetadataBootstrap />
        <PageSubscriber />
        <PageSubscriber />
      </QueryClientProvider>
    );
    await act(async () => {
      await prefetch;
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_SCENE_METADATA_STALE_TIME - 2);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(2);

    fetchMetadata.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_SCENE_METADATA_STALE_TIME);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(3);
    expect(client.getQueryData(querySceneMetadataQueryOptions().queryKey)).toEqual(
      querySceneMetadataFixture
    );
  });

  it('refreshes stale metadata on return to the window without polling while hidden', async () => {
    await client.prefetchQuery(querySceneMetadataQueryOptions());
    render(
      <QueryClientProvider client={client}>
        <QuerySceneMetadataBootstrap />
      </QueryClientProvider>
    );
    focusManager.setFocused(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUERY_SCENE_METADATA_STALE_TIME + 1);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(2);
  });
});
