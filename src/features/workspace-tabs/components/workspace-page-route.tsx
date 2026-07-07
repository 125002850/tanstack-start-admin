import type { ComponentProps, ReactNode } from 'react';

import PageContainer from '@/components/layout/page-container';

import type { WorkspacePageBoundaryProps } from '../types';
import { WorkspacePageBoundary } from './workspace-page-boundary';

type PageContainerProps = Omit<ComponentProps<typeof PageContainer>, 'children'>;

interface WorkspacePageRouteProps extends Omit<
  WorkspacePageBoundaryProps,
  'render' | 'renderWhenDisabled'
> {
  render: () => ReactNode;
  pageContainerProps?: PageContainerProps;
}

export function WorkspacePageRoute({
  render,
  pageContainerProps,
  ...boundaryProps
}: WorkspacePageRouteProps) {
  return (
    <WorkspacePageBoundary
      {...boundaryProps}
      render={() => <PageContainer {...pageContainerProps}>{render()}</PageContainer>}
      renderWhenDisabled={render}
    />
  );
}
