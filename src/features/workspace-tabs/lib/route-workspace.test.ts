import { describe, it, expect } from 'vitest';
import { resolveRouteWorkspaceConfig, resolveRouteTagTitle } from './route-workspace';
import type { AppRouteStaticData } from '@/lib/router/app-route-meta';

describe('resolveRouteWorkspaceConfig', () => {
  it('defaults tagEnabled to true', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/overview');
    expect(cfg.tagEnabled).toBe(true);
  });

  it('defaults keepAlive to true', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/overview');
    expect(cfg.keepAlive).toBe(true);
  });

  it('defaults dashboard home closable to false', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/overview');
    expect(cfg.closable).toBe(false);
  });

  it('normalizes trailing slash before applying home closable default', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/overview/');
    expect(cfg.closable).toBe(false);
  });

  it('defaults non-home closable to true', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/system-management/dictionaries');
    expect(cfg.closable).toBe(true);
  });

  it('defaults instanceStrategy to global for routes without path params', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/system-management/dictionaries');
    expect(cfg.instanceStrategy).toBe('global');
  });

  it('defaults instanceStrategy to by-params for routes with $ path params', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/items/$itemId');
    expect(cfg.instanceStrategy).toBe('by-params');
  });

  it('uses explicit tagEnabled over default', () => {
    const staticData: AppRouteStaticData = {
      label: 'Test',
      workspace: { tagEnabled: false }
    };
    const cfg = resolveRouteWorkspaceConfig('/dashboard/test', staticData);
    expect(cfg.tagEnabled).toBe(false);
  });

  it('uses explicit keepAlive over default', () => {
    const staticData: AppRouteStaticData = {
      label: 'Test',
      workspace: { keepAlive: false }
    };
    const cfg = resolveRouteWorkspaceConfig('/dashboard/test', staticData);
    expect(cfg.keepAlive).toBe(false);
  });

  it('uses explicit closable over default', () => {
    const staticData: AppRouteStaticData = {
      label: 'Test',
      workspace: { closable: false }
    };
    const cfg = resolveRouteWorkspaceConfig('/dashboard/test', staticData);
    expect(cfg.closable).toBe(false);
  });

  it('uses explicit instanceStrategy over path-param default', () => {
    const staticData: AppRouteStaticData = {
      label: 'Test',
      workspace: { instanceStrategy: 'global' }
    };
    const cfg = resolveRouteWorkspaceConfig('/dashboard/items/$itemId', staticData);
    expect(cfg.instanceStrategy).toBe('global');
  });

  it('returns defaults when staticData is undefined', () => {
    const cfg = resolveRouteWorkspaceConfig('/dashboard/overview', undefined);
    expect(cfg).toEqual({
      tagEnabled: true,
      keepAlive: true,
      closable: false,
      instanceStrategy: 'global'
    });
  });

  it('returns defaults when workspace field is absent', () => {
    const staticData: AppRouteStaticData = { label: 'Test' };
    const cfg = resolveRouteWorkspaceConfig('/dashboard/test', staticData);
    expect(cfg).toEqual({
      tagEnabled: true,
      keepAlive: true,
      closable: true,
      instanceStrategy: 'global'
    });
  });
});

describe('resolveRouteTagTitle', () => {
  it('returns label when available', () => {
    const staticData: AppRouteStaticData = {
      label: 'Label',
      title: 'Document Title'
    };
    expect(resolveRouteTagTitle(staticData)).toBe('Label');
  });

  it('falls back to title when label is missing', () => {
    const staticData = {
      label: undefined,
      title: 'Document Title'
    } as unknown as AppRouteStaticData;
    expect(resolveRouteTagTitle(staticData)).toBe('Document Title');
  });

  it('falls back to label when it is the only route title source', () => {
    const staticData: AppRouteStaticData = { label: 'My Label' };
    expect(resolveRouteTagTitle(staticData)).toBe('My Label');
  });

  it('falls back to routeId when title and label are nullish', () => {
    const staticData = { label: undefined } as unknown as AppRouteStaticData;
    expect(resolveRouteTagTitle(staticData, '/dashboard/test')).toBe('/dashboard/test');
  });

  it('returns empty string when nothing is provided', () => {
    expect(resolveRouteTagTitle(undefined, undefined)).toBe('');
  });

  it('prioritizes label over title', () => {
    const staticData: AppRouteStaticData = {
      title: 'Doc Title',
      label: 'Nav Label'
    };
    expect(resolveRouteTagTitle(staticData)).toBe('Nav Label');
  });

  it('handles undefined staticData with a routeId', () => {
    expect(resolveRouteTagTitle(undefined, '/fallback')).toBe('/fallback');
  });
});
