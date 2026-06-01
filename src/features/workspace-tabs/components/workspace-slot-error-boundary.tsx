import * as React from 'react'
import type { WorkspaceTabId } from '../types'
import { useWorkspaceTabStore } from '../utils/store'

interface WorkspaceSlotErrorBoundaryProps {
  tagId: WorkspaceTabId
  fallback: React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
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
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { tagId } = this.props
    useWorkspaceTabStore.getState().disableKeepAlive(tagId)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.error(
        `[WorkspaceSlotErrorBoundary] tag "${tagId}" keep-alive host disabled due to error:`,
        error,
        info.componentStack,
      )
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
