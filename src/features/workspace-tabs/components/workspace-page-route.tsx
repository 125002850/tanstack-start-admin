import type { ComponentProps, ReactNode } from 'react';

import PageContainer, {
  PageContent,
  type PageContentSizing
} from '@/components/layout/page-container';

import type { WorkspacePageBoundaryProps } from '../types';
import { WorkspacePageBoundary } from './workspace-page-boundary';

type PageContainerProps = Omit<ComponentProps<typeof PageContainer>, 'children' | 'contentSizing'>;

interface WorkspacePageRouteProps extends Omit<
  WorkspacePageBoundaryProps,
  'render' | 'renderWhenDisabled'
> {
  contentSizing?: PageContentSizing;
  render: () => ReactNode;
  pageContainerProps?: PageContainerProps;
}

export function WorkspacePageRoute({
  contentSizing = 'flow',
  render,
  pageContainerProps,
  ...boundaryProps
}: WorkspacePageRouteProps) {
  return (
    <WorkspacePageBoundary
      {...boundaryProps}
      render={() => (
        <PageContainer {...pageContainerProps} contentSizing={contentSizing}>
          {render()}
        </PageContainer>
      )}
      renderWhenDisabled={() => <PageContent contentSizing={contentSizing}>{render()}</PageContent>}
    />
  );
}
