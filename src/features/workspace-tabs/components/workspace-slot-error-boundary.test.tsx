import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary';
import { useWorkspaceTabStore } from '../utils/store';

function BrokenChild({ error }: { error: Error }): React.ReactNode {
  throw error;
}

describe('WorkspaceSlotErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useWorkspaceTabStore.setState({ disabledKeepAliveIds: new Set() });
  });

  it('passes the caught error to a functional fallback without classifying its message', () => {
    const error = new SyntaxError(
      "The requested module '/src/lib/api/clients/service/index.ts' does not provide an export named 'mdmDictGlobalItemsByType'"
    );

    render(
      <WorkspaceSlotErrorBoundary
        tagId='/dashboard/system-management/dictionaries'
        fallback={(caughtError) => <div>页面模块加载失败：{caughtError.message}</div>}
      >
        <BrokenChild error={error} />
      </WorkspaceSlotErrorBoundary>
    );

    expect(screen.getByText(`页面模块加载失败：${error.message}`)).toBeInTheDocument();
  });

  it('preserves the configured fallback for unrelated errors', () => {
    render(
      <WorkspaceSlotErrorBoundary tagId='/dashboard/overview' fallback={<div>通用页面错误</div>}>
        <BrokenChild error={new Error('chart rendering failed')} />
      </WorkspaceSlotErrorBoundary>
    );

    expect(screen.getByText('通用页面错误')).toBeInTheDocument();
  });
});
