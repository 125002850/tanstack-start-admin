import * as React from 'react';
import type { WorkspaceTabId } from '../types';
import { useWorkspaceTabStore } from '../utils/store';

type WorkspaceSlotErrorFallback = React.ReactNode | ((error: Error) => React.ReactNode);

interface WorkspaceSlotErrorBoundaryProps {
  tagId: WorkspaceTabId;
  fallback: WorkspaceSlotErrorFallback;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Per-slot error boundary.
 * When a keep-alive slot crashes it disables keep-alive for that tag
 * so the route falls back through the regular Outlet + inline rendering path.
 */
export class WorkspaceSlotErrorBoundary extends React.Component<
  WorkspaceSlotErrorBoundaryProps,
  State
> {
  constructor(props: WorkspaceSlotErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { tagId } = this.props;
    useWorkspaceTabStore.getState().disableKeepAlive(tagId);
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.error(
        `[WorkspaceSlotErrorBoundary] tag "${tagId}" keep-alive host disabled due to error:`,
        error,
        info.componentStack
      );
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback(this.state.error)
        : this.props.fallback;
    }
    return this.props.children;
  }
}
